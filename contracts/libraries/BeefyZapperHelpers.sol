// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.11;

import "./ExchangeHelpers.sol";
import "./../interfaces/external/IBeefyVaultV6.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";

/// @notice Helpers beefy zapping features
library BeefyZapperHelpers {
    using SafeERC20 for IERC20;

    /// @notice After Withdrawing the vault token (moo) from Beefy, we remove
    ///         the liquidity and return the token address path in order to
    ///         swap the remaining tokens.
    /// @param pair The token pair.
    /// @param outputToken One of the paired tokens in which to retrieve the remaining value after the withdraw
    /// @param router The address of the router for which to set allowance for the swap
    function removeLiquidityAndSetupSwap(
        address pair,
        address outputToken,
        address router
    ) internal returns (address[] memory path, uint256 tokenAmountIn) {
        address token0 = IUniswapV2Pair(pair).token0();
        address token1 = IUniswapV2Pair(pair).token1();
        require(token0 == outputToken || token1 == outputToken, "BLVO: INVALID_TOKEN");

        // LP Tokens needs to be sent back to the pair address to be burned
        IERC20(pair).safeTransfer(pair, IERC20(pair).balanceOf(address(this)));

        // We are removing liquidity by burning the LP Token and not
        // by calling `removeLiquidity` since we are checking the final
        // output amount (minTokenAmount).
        (uint256 amount0, uint256 amount1) = IUniswapV2Pair(pair).burn(address(this));

        address swapToken;
        if (token1 == outputToken) {
            swapToken = token0;
            tokenAmountIn = amount0;
        } else {
            swapToken = token1;
            tokenAmountIn = amount1;
        }

        ExchangeHelpers.setMaxAllowance(IERC20(swapToken), router);

        path = new address[](2);
        path[0] = swapToken;
        path[1] = outputToken;
    }

    /// @notice Setup the swap for the value balancing between the two paired
    ///         tokens before the liquidity addition and return the tokens
    ///         path to swap
    /// @param pair The tokens pair
    /// @param vault The beefy vault address for which to set allowance for the deposit
    /// @param router The address of the router for which to set allowances for the swap
    /// @param inputToken The input token to use for the deposit (and for the balancing swap)
    /// @return path Array of tokens to swap token[0] to token[1]
    /// @return isInput0 True if inputToken is the token0 from the pair
    function setupAddLiquiditySwap(
        IUniswapV2Pair pair,
        address vault,
        address router,
        address inputToken
    ) internal returns (address[] memory path, bool isInput0) {
        ExchangeHelpers.setMaxAllowance(IERC20(address(pair)), vault);

        address cachedToken0 = pair.token0();
        address cachedToken1 = pair.token1();

        ExchangeHelpers.setMaxAllowance(IERC20(cachedToken0), router);
        ExchangeHelpers.setMaxAllowance(IERC20(cachedToken1), router);

        isInput0 = cachedToken0 == inputToken;
        require(isInput0 || cachedToken1 == inputToken, "BLVO: INVALID_INPUT_TOKEN");

        path = new address[](2);
        path[0] = inputToken;

        if (isInput0) {
            path[1] = cachedToken1;
        } else {
            path[1] = cachedToken0;
        }
    }
}
