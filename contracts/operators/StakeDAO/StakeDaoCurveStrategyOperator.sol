// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.11;

import "./../../Withdrawer.sol";
import "./StakeDaoStrategyStorage.sol";
import "../../libraries/CurveHelpers.sol";
import "./../../interfaces/external/IWETH.sol";
import "./../../libraries/ExchangeHelpers.sol";
import "../../interfaces/external/IStakeDaoStrategy.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../interfaces/external/ICurvePool/ICurvePool.sol";
import "../../interfaces/external/ICurvePool/ICurvePoolETH.sol";
import "../../interfaces/external/ICurvePool/ICurvePoolNonETH.sol";

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

    /// @notice Add liquidity in a Curve pool that inculde ETH,
    ///         deposit the LP token in a StaeDAO strategy and receive
    ///         the StaeDAO strategy shares
    /// @param strategy The StaeDAO strategy address to deposit into
    /// @param amount The amount of token to add liquidity
    /// @param minStrategyAmount The minimum of StaeDAO strategy shares expected
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
        require(amount != 0, "YCVO: INVALID_AMOUNT");

        (address pool, uint96 poolCoinAmount, address lpToken) = operatorStorage.strategies(strategy);
        require(pool != address(0), "YCVO: INVALID_STRATEGY");

        uint256 strategyBalanceBefore = IERC20(strategy).balanceOf(address(this));
        uint256 ethBalanceBefore = weth.balanceOf(address(this));

        _addLiquidityAndDepositETH(strategy, ICurvePoolETH(pool), IERC20(lpToken), poolCoinAmount, amount);

        (amounts, tokens) = CurveHelpers.getOutputAmounts(
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
    ///         the strategy's token.
    /// @param strategy The stakeDAO strategy address in wich to deposit the LP token
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
        require(amount != 0, "YCVO: INVALID_AMOUNT");
        (address pool, uint96 poolCoinAmount, address lpToken) = operatorStorage.strategies(strategy);
        require(pool != address(0), "YCVO: INVALID_STRATEGY");

        uint256 strategyBalanceBefore = IERC20(strategy).balanceOf(address(this));
        uint256 tokenBalanceBefore = IERC20(token).balanceOf(address(this));

        _addLiquidityAndDeposit(strategy, ICurvePoolNonETH(pool), IERC20(lpToken), poolCoinAmount, token, amount);

        (amounts, tokens) = CurveHelpers.getOutputAmounts(
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
    ///         and receive one of the curve pool token
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
        require(amount != 0, "YCVO: INVALID_AMOUNT");

        (address pool, uint96 poolCoinAmount, address lpToken) = operatorStorage.strategies(strategy);
        require(pool != address(0), "YCVO: INVALID_STRATEGY");

        uint256 strategyBalanceBefore = IERC20(strategy).balanceOf(address(this));
        uint256 tokenBalanceBefore = weth.balanceOf(address(this));

        _withdrawAndRemoveLiquidity128(strategy, amount, ICurvePool(pool), IERC20(lpToken), poolCoinAmount, eth);

        (amounts, tokens) = CurveHelpers.getOutputAmounts(
            IERC20(strategy),
            strategyBalanceBefore,
            amount,
            IERC20(address(weth)),
            tokenBalanceBefore,
            minAmountOut
        );
    }

    /// @notice Withdraw the LP token from the StaeDAO strategy,
    ///         remove the liquidity from the Curve pool
    ///         (using int128 for the curvePool.remove_liquidity_one_coin
    ///         coin index parameter) and receive one of the
    ///         curve pool token
    /// @param strategy The StaeDAO strategy address to withdraw from
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
        address outputToken,
        uint256 minAmountOut
    ) external payable returns (uint256[] memory amounts, address[] memory tokens) {
        require(amount != 0, "YCVO: INVALID_AMOUNT");

        (address pool, uint96 poolCoinAmount, address lpToken) = operatorStorage.strategies(strategy);
        require(pool != address(0), "YCVO: INVALID_STRATEGY");

        uint256 strategyBalanceBefore = IERC20(strategy).balanceOf(address(this));
        uint256 tokenBalanceBefore = IERC20(outputToken).balanceOf(address(this));

        _withdrawAndRemoveLiquidity128(
            strategy,
            amount,
            ICurvePool(pool),
            IERC20(lpToken),
            poolCoinAmount,
            outputToken
        );

        (amounts, tokens) = CurveHelpers.getOutputAmounts(
            IERC20(strategy),
            strategyBalanceBefore,
            amount,
            IERC20(outputToken),
            tokenBalanceBefore,
            minAmountOut
        );
    }

    /// @notice Withdraw the LP token from the StakeDAO strategy,
    ///         remove the liquidity from the Curve pool
    ///         (using uint256 for the curvePool.remove_liquidity_one_coin
    ///         coin index parameter) and receive one of the
    ///         curve pool token
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
        require(amount != 0, "YCVO: INVALID_AMOUNT");

        (address pool, uint96 poolCoinAmount, address lpToken) = operatorStorage.strategies(strategy);
        require(pool != address(0), "YCVO: INVALID_STRATEGY");

        uint256 strategyBalanceBefore = IERC20(strategy).balanceOf(address(this));
        uint256 tokenBalanceBefore = outputToken.balanceOf(address(this));

        _withdrawAndRemoveLiquidity256(
            strategy,
            amount,
            ICurvePoolNonETH(pool),
            IERC20(lpToken),
            poolCoinAmount,
            address(outputToken)
        );

        (amounts, tokens) = CurveHelpers.getOutputAmounts(
            IERC20(strategy),
            strategyBalanceBefore,
            amount,
            outputToken,
            tokenBalanceBefore,
            minAmountOut
        );
    }

    /// @dev  Add liquidity in a Curve pool with ETH and deposit
    ///       the LP token in a StaeDAO strategy
    /// @param strategy The StaeDAO strategy address to deposit into
    /// @param pool The curve pool to add liquitiy in
    /// @param lpToken The curve pool LP token
    /// @param poolCoinAmount The number of token in the Curve pool
    /// @param amount ETH amount to add in the Curve pool
    function _addLiquidityAndDepositETH(
        address strategy,
        ICurvePoolETH pool,
        IERC20 lpToken,
        uint256 poolCoinAmount,
        uint256 amount
    ) private {
        uint256 lpTokenBalanceBefore = lpToken.balanceOf(address(this));
        ExchangeHelpers.setMaxAllowance(IERC20(address(weth)), address(withdrawer));

        // withdraw ETH from WETH
        withdrawer.withdraw(amount);

        if (poolCoinAmount == 2) {
            pool.add_liquidity{ value: amount }(CurveHelpers.getAmounts2Coins(pool, eth, amount), 0);
        } else if (poolCoinAmount == 3) {
            pool.add_liquidity{ value: amount }(CurveHelpers.getAmounts3Coins(pool, eth, amount), 0);
        } else {
            pool.add_liquidity{ value: amount }(CurveHelpers.getAmounts4Coins(pool, eth, amount), 0);
        }

        uint256 lpTokenToDeposit = lpToken.balanceOf(address(this)) - lpTokenBalanceBefore;
        ExchangeHelpers.setMaxAllowance(lpToken, strategy);
        IStakeDaoStrategy(strategy).deposit(lpTokenToDeposit);
    }

    /// @dev  Add liquidity in a Curve pool and deposit
    ///       the LP token in a StaeDAO strategy
    /// @param strategy The StaeDAO strategy address to deposit into
    /// @param pool The curve pool to add liquitiy in
    /// @param lpToken The curve pool lpToken
    /// @param poolCoinAmount The number of token in the Curve pool
    /// @param token Token to add in the Curve pool liquidity
    /// @param amount Token amount to add in the Curve pool
    function _addLiquidityAndDeposit(
        address strategy,
        ICurvePoolNonETH pool,
        IERC20 lpToken,
        uint256 poolCoinAmount,
        address token,
        uint256 amount
    ) private {
        uint256 lpTokenBalanceBefore = lpToken.balanceOf(address(this));
        ExchangeHelpers.setMaxAllowance(IERC20(token), address(pool));

        if (poolCoinAmount == 2) {
            pool.add_liquidity(CurveHelpers.getAmounts2Coins(pool, token, amount), 0);
        } else if (poolCoinAmount == 3) {
            pool.add_liquidity(CurveHelpers.getAmounts3Coins(pool, token, amount), 0);
        } else {
            pool.add_liquidity(CurveHelpers.getAmounts4Coins(pool, token, amount), 0);
        }

        uint256 lpTokenToDeposit = lpToken.balanceOf(address(this)) - lpTokenBalanceBefore;
        ExchangeHelpers.setMaxAllowance(lpToken, strategy);
        IStakeDaoStrategy(strategy).deposit(lpTokenToDeposit);
    }

    /// @dev Withdraw the LP token from the StakeDAO strategy and
    ///      remove the liquidity from the Curve pool
    /// @param strategy The StakeDAO strategy address to withdraw from
    /// @param amount The amount to withdraw
    /// @param pool The Curve pool to remove liquitiy from
    /// @param lpToken The Curve pool LP token
    /// @param poolCoinAmount The number of token in the Curve pool
    /// @param outputToken Output token to receive
    function _withdrawAndRemoveLiquidity128(
        address strategy,
        uint256 amount,
        ICurvePool pool,
        IERC20 lpToken,
        uint256 poolCoinAmount,
        address outputToken
    ) private {
        uint256 lpTokenBalanceBefore = lpToken.balanceOf(address(this));
        IStakeDaoStrategy(strategy).withdraw(amount);

        CurveHelpers.removeLiquidityOneCoin(
            pool,
            lpToken.balanceOf(address(this)) - lpTokenBalanceBefore,
            outputToken,
            poolCoinAmount,
            "remove_liquidity_one_coin(uint256,int128,uint256)"
        );
    }

    /// @dev Withdraw the LP token from the StakeDAO strategy and
    ///      remove the liquidity from the Curve pool
    /// @param strategy The StakeDAO strategy address to withdraw from
    /// @param amount The amount to withdraw
    /// @param pool The Curve pool to remove liquitiy from
    /// @param lpToken The Curve pool LP token
    /// @param poolCoinAmount The number of token in the Curve pool
    /// @param outputToken Output token to receive
    function _withdrawAndRemoveLiquidity256(
        address strategy,
        uint256 amount,
        ICurvePool pool,
        IERC20 lpToken,
        uint256 poolCoinAmount,
        address outputToken
    ) private {
        uint256 lpTokenBalanceBefore = lpToken.balanceOf(address(this));
        IStakeDaoStrategy(strategy).withdraw(amount);

        CurveHelpers.removeLiquidityOneCoin(
            pool,
            lpToken.balanceOf(address(this)) - lpTokenBalanceBefore,
            outputToken,
            poolCoinAmount,
            "remove_liquidity_one_coin(uint256,uint256,uint256)"
        );
    }
}
