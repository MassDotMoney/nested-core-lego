// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.11;

import "./../../Withdrawer.sol";
import "./YearnVaultStorage.sol";
import "./../../libraries/ExchangeHelpers.sol";
import "./../../libraries/YearnCurveHelpers.sol";
import "./../../interfaces/external/IYearnVault.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./../../interfaces/external/IWETH.sol";
import "./../../interfaces/external/ICurvePool/ICurvePoolETH.sol";
import "./../../interfaces/external/ICurvePool/ICurvePoolNonETH.sol";

/// @title Yearn Curve Vault Operator
/// @notice Deposit/Withdraw in a Yearn Curve vault.
contract YearnCurveVaultOperator {
    YearnVaultStorage public immutable operatorStorage;

    /// @dev ETH address
    address public immutable eth;

    /// @dev WETH contract
    IWETH private immutable weth;

    /// @dev Withdrawer
    Withdrawer private immutable withdrawer;

    constructor(
        address[] memory vaults,
        CurvePool[] memory pools,
        Withdrawer _withdrawer,
        address _eth,
        address _weth
    ) {
        uint256 vaultsLength = vaults.length;
        require(vaultsLength == pools.length, "YCVO: INVALID_VAULTS_LENGTH");
        operatorStorage = new YearnVaultStorage();

        for (uint256 i; i < vaultsLength; i++) {
            operatorStorage.addVault(vaults[i], pools[i]);
        }

        operatorStorage.transferOwnership(msg.sender);

        eth = _eth;
        weth = IWETH(_weth);
        withdrawer = _withdrawer;
    }

    /// @notice Add liquidity in a Curve pool that inculde ETH,
    ///         deposit the LP token in a Yearn vault and receive
    ///         the Yearn vault shares
    /// @param vault The Yearn vault address to deposit into
    /// @param amount The amount of token to add liquidity
    /// @param minVaultAmount The minimum of Yearn vault shares expected
    /// @return amounts Array of amounts :
    ///         - [0] : The vault token received amount
    ///         - [1] : The token deposited amount
    /// @return tokens Array of token addresses
    ///         - [0] : The vault token received address
    ///         - [1] : The token deposited address
    function depositETH(
        address vault,
        uint256 amount,
        uint256 minVaultAmount
    ) external payable returns (uint256[] memory amounts, address[] memory tokens) {
        require(amount != 0, "YCVO: INVALID_AMOUNT");

        (address pool, uint96 poolCoinAmount, address lpToken) = operatorStorage.vaults(vault);
        require(pool != address(0), "YCVO: INVALID_VAULT");

        uint256 vaultBalanceBefore = IERC20(vault).balanceOf(address(this));
        uint256 ethBalanceBefore = weth.balanceOf(address(this));

        _addLiquidityAndDepositETH(vault, ICurvePoolETH(pool), IERC20(lpToken), poolCoinAmount, amount);

        (amounts, tokens) = YearnCurveHelpers.getOutputAmounts(
            IERC20(address(weth)),
            ethBalanceBefore,
            amount,
            IERC20(vault),
            vaultBalanceBefore,
            minVaultAmount
        );
    }

    /// @notice Add liquidity in a Curve pool, deposit
    ///         the LP token in a Yearn vault and receive
    ///         the Yearn vault shares
    /// @param vault The Yearn vault address to deposit into
    /// @param token The token to add liquidity
    /// @param amount The amount of token to add liquidity
    /// @param minVaultAmount The minimum of Yearn vault shares expected
    /// @return amounts Array of amounts :
    ///         - [0] : The vault token received amount
    ///         - [1] : The token deposited amount
    /// @return tokens Array of token addresses
    ///         - [0] : The vault token received address
    ///         - [1] : The token deposited address
    function deposit(
        address vault,
        address token,
        uint256 amount,
        uint256 minVaultAmount
    ) external payable returns (uint256[] memory amounts, address[] memory tokens) {
        require(amount != 0, "YCVO: INVALID_AMOUNT");
        (address pool, uint96 poolCoinAmount, address lpToken) = operatorStorage.vaults(vault);
        require(pool != address(0), "YCVO: INVALID_VAULT");

        uint256 vaultBalanceBefore = IERC20(vault).balanceOf(address(this));
        uint256 tokenBalanceBefore = IERC20(token).balanceOf(address(this));

        _addLiquidityAndDeposit(vault, ICurvePoolNonETH(pool), IERC20(lpToken), poolCoinAmount, token, amount);

        (amounts, tokens) = YearnCurveHelpers.getOutputAmounts(
            IERC20(token),
            tokenBalanceBefore,
            amount,
            IERC20(vault),
            vaultBalanceBefore,
            minVaultAmount
        );
    }

    /// @notice Withdraw the LP token from the Yearn vault,
    ///         remove ETH liquidity from the Curve pool
    ///         and receive one of the curve pool token
    /// @param vault The Yearn vault address to withdraw from
    /// @param amount The amount to withdraw
    /// @param minAmountOut The minimum of output token expected
    /// @return amounts Array of amounts :
    ///         - [0] : The token received amount
    ///         - [1] : The vault token deposited amount
    /// @return tokens Array of token addresses
    ///         - [0] : The token received address
    ///         - [1] : The vault token deposited address
    function withdrawETH(
        address vault,
        uint256 amount,
        uint256 minAmountOut
    ) external payable returns (uint256[] memory amounts, address[] memory tokens) {
        require(amount != 0, "YCVO: INVALID_AMOUNT");

        (address pool, uint96 poolCoinAmount, address lpToken) = operatorStorage.vaults(vault);
        require(pool != address(0), "YCVO: INVALID_VAULT");

        uint256 vaultBalanceBefore = IERC20(vault).balanceOf(address(this));
        uint256 tokenBalanceBefore = weth.balanceOf(address(this));

        _withdrawAndRemoveLiquidity128(vault, amount, ICurvePool(pool), IERC20(lpToken), poolCoinAmount, eth);

        (amounts, tokens) = YearnCurveHelpers.getOutputAmounts(
            IERC20(vault),
            vaultBalanceBefore,
            amount,
            IERC20(address(weth)),
            tokenBalanceBefore,
            minAmountOut
        );
    }

    /// @notice Withdraw the LP token from the Yearn vault,
    ///         remove the liquidity from the Curve pool
    ///         (using int128 for the curvePool.remove_liquidity_one_coin
    ///         coin index parameter) and receive one of the
    ///         curve pool token
    /// @param vault The Yearn vault address to withdraw from
    /// @param amount The amount to withdraw
    /// @param outputToken Output token to receive
    /// @param minAmountOut The minimum of output token expected
    /// @return amounts Array of amounts :
    ///         - [0] : The token received amount
    ///         - [1] : The vault token deposited amount
    /// @return tokens Array of token addresses
    ///         - [0] : The token received address
    ///         - [1] : The vault token deposited address
    function withdraw128(
        address vault,
        uint256 amount,
        address outputToken,
        uint256 minAmountOut
    ) external payable returns (uint256[] memory amounts, address[] memory tokens) {
        require(amount != 0, "YCVO: INVALID_AMOUNT");

        (address pool, uint96 poolCoinAmount, address lpToken) = operatorStorage.vaults(vault);
        require(pool != address(0), "YCVO: INVALID_VAULT");

        uint256 vaultBalanceBefore = IERC20(vault).balanceOf(address(this));
        uint256 tokenBalanceBefore = IERC20(outputToken).balanceOf(address(this));

        _withdrawAndRemoveLiquidity128(vault, amount, ICurvePool(pool), IERC20(lpToken), poolCoinAmount, outputToken);

        (amounts, tokens) = YearnCurveHelpers.getOutputAmounts(
            IERC20(vault),
            vaultBalanceBefore,
            amount,
            IERC20(outputToken),
            tokenBalanceBefore,
            minAmountOut
        );
    }

    /// @notice Withdraw the LP token from the Yearn vault,
    ///         remove the liquidity from the Curve pool
    ///         (using uint256 for the curvePool.remove_liquidity_one_coin
    ///         coin index parameter) and receive one of the
    ///         curve pool token
    /// @param vault The Yearn vault address to withdraw from
    /// @param amount The amount to withdraw
    /// @param outputToken Output token to receive
    /// @param minAmountOut The minimum of output token expected
    /// @return amounts Array of amounts :
    ///         - [0] : The token received amount
    ///         - [1] : The vault token deposited amount
    /// @return tokens Array of token addresses
    ///         - [0] : The token received address
    ///         - [1] : The vault token deposited address
    function withdraw256(
        address vault,
        uint256 amount,
        address outputToken,
        uint256 minAmountOut
    ) external payable returns (uint256[] memory amounts, address[] memory tokens) {
        require(amount != 0, "YCVO: INVALID_AMOUNT");

        (address pool, uint96 poolCoinAmount, address lpToken) = operatorStorage.vaults(vault);
        require(pool != address(0), "YCVO: INVALID_VAULT");

        uint256 vaultBalanceBefore = IERC20(vault).balanceOf(address(this));
        uint256 tokenBalanceBefore = IERC20(outputToken).balanceOf(address(this));

        _withdrawAndRemoveLiquidity256(
            vault,
            amount,
            ICurvePoolNonETH(pool),
            IERC20(lpToken),
            poolCoinAmount,
            outputToken
        );

        (amounts, tokens) = YearnCurveHelpers.getOutputAmounts(
            IERC20(vault),
            vaultBalanceBefore,
            amount,
            IERC20(outputToken),
            tokenBalanceBefore,
            minAmountOut
        );
    }

    /// @dev  Add liquidity in a Curve pool with ETH and deposit
    ///       the LP token in a Yearn vault
    /// @param vault The Yearn vault address to deposit into
    /// @param pool The curve pool to add liquitiy in
    /// @param lpToken The curve pool LP token
    /// @param poolCoinAmount The number of token in the Curve pool
    /// @param amount ETH amount to add in the Curve pool
    function _addLiquidityAndDepositETH(
        address vault,
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
            pool.add_liquidity{ value: amount }(YearnCurveHelpers.getAmounts2Coins(pool, eth, amount), 0);
        } else if (poolCoinAmount == 3) {
            pool.add_liquidity{ value: amount }(YearnCurveHelpers.getAmounts3Coins(pool, eth, amount), 0);
        } else {
            pool.add_liquidity{ value: amount }(YearnCurveHelpers.getAmounts4Coins(pool, eth, amount), 0);
        }

        uint256 lpTokenToDeposit = lpToken.balanceOf(address(this)) - lpTokenBalanceBefore;
        ExchangeHelpers.setMaxAllowance(lpToken, vault);
        IYearnVault(vault).deposit(lpTokenToDeposit);
    }

    /// @dev  Add liquidity in a Curve pool and deposit
    ///       the LP token in a Yearn vault
    /// @param vault The Yearn vault address to deposit into
    /// @param pool The curve pool to add liquitiy in
    /// @param lpToken The curve pool lpToken
    /// @param poolCoinAmount The number of token in the Curve pool
    /// @param token Token to add in the Curve pool liquidity
    /// @param amount Token amount to add in the Curve pool
    function _addLiquidityAndDeposit(
        address vault,
        ICurvePoolNonETH pool,
        IERC20 lpToken,
        uint256 poolCoinAmount,
        address token,
        uint256 amount
    ) private {
        uint256 lpTokenBalanceBefore = lpToken.balanceOf(address(this));
        ExchangeHelpers.setMaxAllowance(IERC20(token), address(pool));

        if (poolCoinAmount == 2) {
            pool.add_liquidity(YearnCurveHelpers.getAmounts2Coins(pool, token, amount), 0);
        } else if (poolCoinAmount == 3) {
            pool.add_liquidity(YearnCurveHelpers.getAmounts3Coins(pool, token, amount), 0);
        } else {
            pool.add_liquidity(YearnCurveHelpers.getAmounts4Coins(pool, token, amount), 0);
        }

        uint256 lpTokenToDeposit = lpToken.balanceOf(address(this)) - lpTokenBalanceBefore;
        ExchangeHelpers.setMaxAllowance(lpToken, vault);
        IYearnVault(vault).deposit(lpTokenToDeposit);
    }

    /// @dev Withdraw the LP token from the Yearn vault and
    ///      remove the liquidity from the Curve pool
    /// @param vault The Yearn vault address to withdraw from
    /// @param amount The amount to withdraw
    /// @param pool The Curve pool to remove liquitiy from
    /// @param lpToken The Curve pool LP token
    /// @param poolCoinAmount The number of token in the Curve pool
    /// @param outputToken Output token to receive
    function _withdrawAndRemoveLiquidity256(
        address vault,
        uint256 amount,
        ICurvePool pool,
        IERC20 lpToken,
        uint256 poolCoinAmount,
        address outputToken
    ) private {
        uint256 lpTokenBalanceBefore = lpToken.balanceOf(address(this));
        IYearnVault(vault).withdraw(amount, address(this), 10000);

        YearnCurveHelpers.removeLiquidityOneCoin(
            pool,
            lpToken.balanceOf(address(this)) - lpTokenBalanceBefore,
            outputToken,
            poolCoinAmount,
            "remove_liquidity_one_coin(uint256,uint256,uint256)"
        );
    }

    /// @dev Withdraw the LP token from the Yearn vault and
    ///      remove the liquidity from the Curve pool
    /// @param vault The Yearn vault address to withdraw from
    /// @param amount The amount to withdraw
    /// @param pool The Curve pool to remove liquitiy from
    /// @param lpToken The Curve pool LP token
    /// @param poolCoinAmount The number of token in the Curve pool
    /// @param outputToken Output token to receive
    function _withdrawAndRemoveLiquidity128(
        address vault,
        uint256 amount,
        ICurvePool pool,
        IERC20 lpToken,
        uint256 poolCoinAmount,
        address outputToken
    ) private {
        uint256 lpTokenBalanceBefore = lpToken.balanceOf(address(this));
        IYearnVault(vault).withdraw(amount, address(this), 10000);

        YearnCurveHelpers.removeLiquidityOneCoin(
            pool,
            lpToken.balanceOf(address(this)) - lpTokenBalanceBefore,
            outputToken,
            poolCoinAmount,
            "remove_liquidity_one_coin(uint256,int128,uint256)"
        );
    }
}
