// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.11;

import "./BeefyVaultStorage.sol";
import "./../../libraries/ExchangeHelpers.sol";
import "./../../interfaces/external/IBeefyVaultV6.sol";
import "./../../interfaces/external/IBiswapRouter02.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "@uniswap/lib/contracts/libraries/Babylonian.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title (Zapper) Beefy UniV2 LP Vault Operator.
/// @notice Deposit/Withdraw in a Beefy UniV2 LP vault using zapper
/// Note: "Zap" means that we are converting an asset for the LP Token by
///       swapping and adding liquidity.
contract BeefyZapLPVaultOperator {
    using SafeERC20 for IERC20;

    BeefyVaultStorage public immutable operatorStorage;

    constructor(address[] memory vaults, address[] memory routers) {
        uint256 vaultsLength = vaults.length;
        require(vaultsLength == routers.length, "BLVO: INVALID_VAULTS_LENGTH");

        operatorStorage = new BeefyVaultStorage();

        for (uint256 i; i < vaultsLength; i++) {
            operatorStorage.addVault(vaults[i], routers[i]);
        }

        operatorStorage.transferOwnership(msg.sender);
    }

    /// @notice Zap one of the paired tokens for the LP Token, deposit the
    ///         asset in the Beefy vault and receive the vault token (moo).
    /// @param vault The vault address to deposit into
    /// @param token The token to zap
    /// @param amount The token amount to deposit
    /// @param minVaultAmount The minimum vault token amount expected
    /// @return amounts Array of amounts :
    ///         - [0] : The vault token received amount
    ///         - [1] : The token deposited amount
    /// @return tokens Array of token addresses
    ///         - [0] : The vault token received address
    ///         - [1] : The token deposited address
    function deposit(
        address vault,
        IERC20 token,
        uint256 amount,
        uint256 minVaultAmount
    ) external payable returns (uint256[] memory amounts, address[] memory tokens) {
        require(amount != 0, "BLVO: INVALID_AMOUNT");
        address router = operatorStorage.vaults(vault);
        require(router != address(0), "BLVO: INVALID_VAULT");
        amounts = new uint256[](2);
        tokens = new address[](2);

        uint256 vaultBalanceBefore = IERC20(vault).balanceOf(address(this));
        uint256 tokenBalanceBefore = token.balanceOf(address(this));

        beefIn(router, vault, token, amount);

        uint256 vaultAmount = IERC20(vault).balanceOf(address(this)) - vaultBalanceBefore;
        uint256 tokenAmount = tokenBalanceBefore - token.balanceOf(address(this));

        uint256 tokenDust = amount - tokenAmount;
        returnAsset(token, tokenDust);

        require(vaultAmount != 0 && vaultAmount >= minVaultAmount, "BLVO: INVALID_AMOUNT_RECEIVED");
        require(amount == (tokenAmount + tokenDust), "BLVO: INVALID_AMOUNT_DEPOSITED");

        // Output amounts
        amounts[0] = vaultAmount;
        amounts[1] = tokenAmount + tokenDust;

        // Output token
        tokens[0] = vault;
        tokens[1] = address(token);
    }

    /// @notice Withdraw the vault token (moo) from Beefy and receive
    ///         one of the paired tokens
    /// @param vault The vault address to withdraw from
    /// @param amount The vault token amount to withdraw
    /// @param token One of the paired token
    /// @param minTokenAmount The minimum token amount expected
    /// @return amounts Array of amounts :
    ///         - [0] : The token received amount
    ///         - [1] : The vault token deposited amount
    /// @return tokens Array of token addresses
    ///         - [0] : The token received address
    ///         - [1] : The vault token deposited address
    function withdraw(
        address vault,
        uint256 amount,
        IERC20 token,
        uint256 minTokenAmount
    ) external returns (uint256[] memory amounts, address[] memory tokens) {
        require(amount != 0, "BLVO: INVALID_AMOUNT");
        require(operatorStorage.vaults(vault) != address(0), "BLVO: INVALID_VAULT");
        amounts = new uint256[](2);
        tokens = new address[](2);

        uint256 tokenBalanceBefore = token.balanceOf(address(this));
        uint256 vaultBalanceBefore = IERC20(vault).balanceOf(address(this));

        ExchangeHelpers.setMaxAllowance(token, vault);
        // IBeefyZapUniswapV2(operatorStorage.vaults(vault)).beefOutAndSwap(vault, amount, address(token), minTokenAmount);

        uint256 tokenAmount = token.balanceOf(address(this)) - tokenBalanceBefore;
        uint256 vaultAmount = vaultBalanceBefore - IERC20(vault).balanceOf(address(this));
        require(vaultAmount == amount, "BLVO: INVALID_AMOUNT_WITHDRAWED");
        require(tokenAmount >= minTokenAmount, "BLVO: INVALID_OUTPUT_AMOUNT");

        // Output amounts
        amounts[0] = tokenAmount;
        amounts[1] = amount;

        // Output token
        tokens[0] = address(token);
        tokens[1] = vault;
    }

    /// @notice Zap one of the paired tokens for the LP Token, deposit the
    ///         asset in the Beefy vault and receive the vault token (moo)
    /// @param router The uniswap v2 router address to use for swaping and adding liquidity
    /// @param vault The vault address to deposit into
    /// @param token The token to zap
    /// @param amount The token amount to deposit
    function beefIn(
        address router,
        address vault,
        IERC20 token,
        uint256 amount
    ) private {
        IBeefyVaultV6 beefyVault = IBeefyVaultV6(vault);
        IBiswapRouter02 biswapRouter = IBiswapRouter02(router);
        IUniswapV2Pair pair = beefyVault.want();

        require(pair.factory() == biswapRouter.factory(), "BLVO: INVALID_VAULT");

        address cachedToken0 = pair.token0();
        address cachedToken1 = pair.token1();

        ExchangeHelpers.setMaxAllowance(IERC20(address(pair)), vault);
        ExchangeHelpers.setMaxAllowance(IERC20(cachedToken0), router);
        ExchangeHelpers.setMaxAllowance(IERC20(cachedToken1), router);

        (uint256 reserveA, uint256 reserveB, ) = pair.getReserves();
        require(reserveA > 1000, "BLVO: PAIR_RESERVE_TOO_LOW");
        require(reserveB > 1000, "BLVO: PAIR_RESERVE_TOO_LOW");

        bool isInputA = cachedToken0 == address(token);
        require(isInputA || cachedToken1 == address(token), "BLVO: INVALID_INPUT_TOKEN");

        address[] memory path = new address[](2);
        path[0] = address(token);

        // The amount of input token to swap
        // to get the same value of output token
        uint256 swapAmountIn;
        if (isInputA) {
            path[1] = cachedToken1;
            swapAmountIn = getSwapAmount(amount, reserveA, reserveB, biswapRouter);
        } else {
            path[1] = cachedToken0;
            swapAmountIn = getSwapAmount(amount, reserveB, reserveA, biswapRouter);
        }

        swapAndStake(amount, swapAmountIn, path, biswapRouter, beefyVault);
    }

    /// @notice Swap input tokenA into TokenB to get the same value in tokenA
    ///         as in tokenB to then add liquidity and store the obtained LP
    ///         token in the vault beefy
    /// @param amount The amount of tokenA to invest
    /// @param swapAmountIn The amount of tokenA to swap for tokenB
    /// @param path An array of the two paired token addresses
    /// @param biswapRouter The uniswapV2 router to be used for swap and liquidity addition
    /// @param beefyVault The Beffy vault to be used for the LP token deposit
    /// @dev path.length must be equal to 2 with path[0] = tokenA and path[1] = tokenB
    function swapAndStake(
        uint256 amount,
        uint256 swapAmountIn,
        address[] memory path,
        IBiswapRouter02 biswapRouter,
        IBeefyVaultV6 beefyVault
    ) private {
        uint256[] memory swapedAmounts = biswapRouter.swapExactTokensForTokens(
            swapAmountIn,
            1,
            path,
            address(this),
            block.timestamp
        );

        (, , uint256 amountLiquidity) = biswapRouter.addLiquidity(
            path[0],
            path[1],
            amount - swapedAmounts[0],
            swapedAmounts[1],
            1,
            1,
            address(this),
            block.timestamp
        );

        beefyVault.deposit(amountLiquidity);
    }

    /// @notice Compute the amount of tokenA to swap to get the
    ///         same value of tokenB
    /// @param investmentA The total amount of tokenA to invest
    /// @param reserveA The pair reserve of the invested token (tokenA reserve)
    /// @param reserveB The pair reserve of output token (tokenB reserve)
    /// @dev Make sure that the investmentA and the reserveA both refer to the tokenA
    function getSwapAmount(
        uint256 investmentA,
        uint256 reserveA,
        uint256 reserveB,
        IBiswapRouter02 router
    ) private pure returns (uint256 swapAmount) {
        uint256 halfInvestment = investmentA / 2;
        uint256 nominator = router.getAmountOut(halfInvestment, reserveA, reserveB, 1);
        uint256 denominator = router.quote(halfInvestment, reserveA + halfInvestment, reserveB - nominator);
        // The amount of tokenA to swap to get the same value of tokenB
        swapAmount = investmentA - Babylonian.sqrt((halfInvestment * halfInvestment * nominator) / denominator);
    }

    /// @notice Returns a certain amount of tokens to the msg.sender
    /// @param token The address of the token to return
    /// @param amount The amount of token to return
    function returnAsset(IERC20 token, uint256 amount) private {
        require(address(token) != address(0), "BLVO: INVALID_TOKEN_TO_RETURN");
        if (amount > 0) {
            token.safeTransfer(msg.sender, amount);
        }
    }
}
