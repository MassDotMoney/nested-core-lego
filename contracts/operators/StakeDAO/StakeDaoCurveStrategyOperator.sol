// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.14;

import "./../../Withdrawer.sol";
import "./StakeDaoStrategyStorage.sol";
import "./../../interfaces/external/IWETH.sol";
import "./../../libraries/OperatorHelpers.sol";
import "./../../libraries/ExchangeHelpers.sol";
import "./../../libraries/StakingLPVaultHelpers.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./../../libraries/CurveHelpers/CurveHelpers.sol";
import "./../../interfaces/external/ICurvePool/ICurvePool.sol";
import "./../../interfaces/external/ICurvePool/ICurvePoolETH.sol";
import "./../../interfaces/external/ICurvePool/ICurvePoolNonETH.sol";
import "./../../interfaces/external/IStakingVault/IStakeDaoStrategy.sol";

/// @title StakeDAO Curve strategy operator
/// @notice Deposit/Withdraw in a StakeDAO strategy
contract StakeDaoCurveStrategyOperator {
    StakeDaoStrategyStorage public immutable operatorStorage;

    /// @dev ETH address
    address public immutable eth;

    /// @dev WETH contract
    IWETH private immutable weth;

    /// @dev Withdrawer
    Withdrawer private immutable withdrawer;

    constructor(
        address[] memory strategies,
        CurvePool[] memory pools,
        Withdrawer _withdrawer,
        address _eth,
        address _weth
    ) {
        uint256 strategiesLength = strategies.length;
        require(strategiesLength == pools.length, "SDCSO: INVALID_POOLS_LENGTH");
        operatorStorage = new StakeDaoStrategyStorage();

        for (uint256 i; i < strategiesLength; i++) {
            operatorStorage.addStrategy(strategies[i], pools[i]);
        }

        operatorStorage.transferOwnership(msg.sender);

        eth = _eth;
        weth = IWETH(_weth);
        withdrawer = _withdrawer;
    }

    /// @notice Add liquidity in a Curve pool that includes ETH,
    ///         deposit the LP token in a StakeDAO strategy and receive
    ///         the StakeDAO strategy token
    /// @param strategy The StakeDAO strategy address to deposit into
    /// @param amount The amount of token to add liquidity
    /// @param minStrategyAmount The minimum of StakeDAO strategy token expected
    /// @return amounts Array of amounts :
    ///         - [0] : The strategy token received amount
    ///         - [1] : The token deposited amount
    /// @return tokens Array of token addresses
    ///         - [0] : The strategy token received address
    ///         - [1] : The token deposited address
    function depositETH(
        address strategy,
        uint256 amount,
        uint256 minStrategyAmount
    ) public payable returns (uint256[] memory amounts, address[] memory tokens) {
        require(amount != 0, "SDCSO: INVALID_AMOUNT");

        (address pool, uint96 poolCoinAmount, address lpToken) = operatorStorage.strategies(strategy);
        require(pool != address(0), "SDCSO: INVALID_STRATEGY");

        uint256 strategyBalanceBefore = IERC20(strategy).balanceOf(address(this));
        uint256 ethBalanceBefore = weth.balanceOf(address(this));

        ExchangeHelpers.setMaxAllowance(IERC20(address(weth)), address(withdrawer));

        // withdraw ETH from WETH
        withdrawer.withdraw(amount);

        StakingLPVaultHelpers._addLiquidityAndDepositETH(
            strategy,
            ICurvePoolETH(pool),
            IERC20(lpToken),
            poolCoinAmount,
            eth,
            amount
        );

        (amounts, tokens) = OperatorHelpers.getOutputAmounts(
            IERC20(address(weth)),
            ethBalanceBefore,
            amount,
            IERC20(strategy),
            strategyBalanceBefore,
            minStrategyAmount
        );
    }

    /// @notice Add liquidity to a Curve pool using the input token,
    ///         deposit the LP token in a StakeDAO strategy and receive
    ///         the strategy token
    /// @param strategy The StakeDAO strategy address in wich to deposit the LP token
    /// @param token The input token to use for adding liquidity
    /// @param amount The input token amount to use for adding liquidity
    /// @param minStrategyToken The minimum strategy token expected
    /// @return amounts Array of amounts :
    ///         - [0] : The received strategy token amount
    ///         - [1] : The deposited token amount
    /// @return tokens Array of token addresses
    ///         - [0] : The received strategy token address
    ///         - [1] : The deposited token address
    function deposit(
        address strategy,
        address token,
        uint256 amount,
        uint256 minStrategyToken
    ) external payable returns (uint256[] memory amounts, address[] memory tokens) {
        require(amount != 0, "SDCSO: INVALID_AMOUNT");
        (address pool, uint96 poolCoinAmount, address lpToken) = operatorStorage.strategies(strategy);
        require(pool != address(0), "SDCSO: INVALID_STRATEGY");

        uint256 strategyBalanceBefore = IERC20(strategy).balanceOf(address(this));
        uint256 tokenBalanceBefore = IERC20(token).balanceOf(address(this));

        StakingLPVaultHelpers._addLiquidityAndDeposit(
            strategy,
            ICurvePoolNonETH(pool),
            IERC20(lpToken),
            poolCoinAmount,
            token,
            amount
        );

        (amounts, tokens) = OperatorHelpers.getOutputAmounts(
            IERC20(token),
            tokenBalanceBefore,
            amount,
            IERC20(strategy),
            strategyBalanceBefore,
            minStrategyToken
        );
    }

    /// @notice Withdraw the LP token from the StakeDAO strategy,
    ///         remove ETH liquidity from the Curve pool
    ///         and receive one of the Curve pool token
    /// @param strategy The StakeDAO strategy address to withdraw from
    /// @param amount The amount to withdraw
    /// @param minAmountOut The minimum of output token expected
    /// @return amounts Array of amounts :
    ///         - [0] : The token received amount
    ///         - [1] : The strategy token deposited amount
    /// @return tokens Array of token addresses
    ///         - [0] : The token received address
    ///         - [1] : The strategy token deposited address
    function withdrawETH(
        address strategy,
        uint256 amount,
        uint256 minAmountOut
    ) external payable returns (uint256[] memory amounts, address[] memory tokens) {
        require(amount != 0, "SDCSO: INVALID_AMOUNT");

        (address pool, uint96 poolCoinAmount, address lpToken) = operatorStorage.strategies(strategy);
        require(pool != address(0), "SDCSO: INVALID_STRATEGY");

        uint256 strategyBalanceBefore = IERC20(strategy).balanceOf(address(this));
        uint256 tokenBalanceBefore = weth.balanceOf(address(this));

        StakingLPVaultHelpers._withdrawAndRemoveLiquidity128(
            strategy,
            amount,
            ICurvePool(pool),
            IERC20(lpToken),
            poolCoinAmount,
            eth
        );

        (amounts, tokens) = OperatorHelpers.getOutputAmounts(
            IERC20(strategy),
            strategyBalanceBefore,
            amount,
            IERC20(address(weth)),
            tokenBalanceBefore,
            minAmountOut
        );
    }

    /// @notice Withdraw the LP token from the StakeDAO strategy,
    ///         remove the liquidity from the Curve pool
    ///         (using int128 for the curvePool.remove_liquidity_one_coin
    ///         coin index parameter) and receive one of the
    ///         Curve pool token
    /// @param strategy The StakeDAO strategy address to withdraw from
    /// @param amount The amount to withdraw
    /// @param outputToken Output token to receive
    /// @param minAmountOut The minimum of output token expected
    /// @return amounts Array of amounts :
    ///         - [0] : The token received amount
    ///         - [1] : The strategy token deposited amount
    /// @return tokens Array of token addresses
    ///         - [0] : The token received address
    ///         - [1] : The strategy token deposited address
    function withdraw128(
        address strategy,
        uint256 amount,
        IERC20 outputToken,
        uint256 minAmountOut
    ) external payable returns (uint256[] memory amounts, address[] memory tokens) {
        require(amount != 0, "SDCSO: INVALID_AMOUNT");

        (address pool, uint96 poolCoinAmount, address lpToken) = operatorStorage.strategies(strategy);
        require(pool != address(0), "SDCSO: INVALID_STRATEGY");

        uint256 strategyBalanceBefore = IERC20(strategy).balanceOf(address(this));
        uint256 tokenBalanceBefore = outputToken.balanceOf(address(this));

        StakingLPVaultHelpers._withdrawAndRemoveLiquidity128(
            strategy,
            amount,
            ICurvePool(pool),
            IERC20(lpToken),
            poolCoinAmount,
            address(outputToken)
        );

        (amounts, tokens) = OperatorHelpers.getOutputAmounts(
            IERC20(strategy),
            strategyBalanceBefore,
            amount,
            outputToken,
            tokenBalanceBefore,
            minAmountOut
        );
    }

    /// @notice Withdraw the LP token from the StakeDAO strategy,
    ///         remove the liquidity from the Curve pool
    ///         (using uint256 for the curvePool.remove_liquidity_one_coin
    ///         coin index parameter) and receive one of the
    ///         Curve pool token
    /// @param strategy The StakeDAO strategy address to withdraw from
    /// @param amount The amount to withdraw
    /// @param outputToken Output token to receive
    /// @param minAmountOut The minimum of output token expected
    /// @return amounts Array of amounts :
    ///         - [0] : The token received amount
    ///         - [1] : The strategy token deposited amount
    /// @return tokens Array of token addresses
    ///         - [0] : The token received address
    ///         - [1] : The strategy token deposited address
    function withdraw256(
        address strategy,
        uint256 amount,
        IERC20 outputToken,
        uint256 minAmountOut
    ) external payable returns (uint256[] memory amounts, address[] memory tokens) {
        require(amount != 0, "SDCSO: INVALID_AMOUNT");

        (address pool, uint96 poolCoinAmount, address lpToken) = operatorStorage.strategies(strategy);
        require(pool != address(0), "SDCSO: INVALID_STRATEGY");

        uint256 strategyBalanceBefore = IERC20(strategy).balanceOf(address(this));
        uint256 tokenBalanceBefore = outputToken.balanceOf(address(this));

        StakingLPVaultHelpers._withdrawAndRemoveLiquidity256(
            strategy,
            amount,
            ICurvePoolNonETH(pool),
            IERC20(lpToken),
            poolCoinAmount,
            address(outputToken)
        );

        (amounts, tokens) = OperatorHelpers.getOutputAmounts(
            IERC20(strategy),
            strategyBalanceBefore,
            amount,
            outputToken,
            tokenBalanceBefore,
            minAmountOut
        );
    }
}
