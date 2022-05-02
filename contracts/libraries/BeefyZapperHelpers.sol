// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.11;

import "./ExchangeHelpers.sol";
import "./../interfaces/external/IBeefyVaultV6.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";

/// @notice Helpers beefy zapping features
library BeefyZapperHelpers {
    using SafeERC20 for IERC20;

    /// @notice Withdraw the vault token (moo) from Beefy and return
    ///         the token address path in order to swap the remaining
    ///         tokens after the withdraw
    /// @param vault The beefy vault to be used for the withdraw
    /// @param outputAmount The vault token amount to withdraw
    /// @param outputToken One of the paired tokens in which to retrieve the remaining value after the withdraw
    /// @param router The address of the router for which to set allowance for the swap
    function withdrawAndSetupSwap(
        IBeefyVaultV6 vault,
        uint256 outputAmount,
        address outputToken,
        address router
    ) internal returns (address[] memory path) {
        IUniswapV2Pair pair = IUniswapV2Pair(vault.want());
        // Withdraw the LP tokens, only with the remaining Vault tokens
        // after subtracting the "amount" value
        vault.withdraw(IERC20(vault).balanceOf(address(this)) - outputAmount);

        address token0 = pair.token0();
        address token1 = pair.token1();
        require(token0 == outputToken || token1 == outputToken, "BLVO: INVALID_TOKEN");

        address cachedPairAddress = vault.want();

        IERC20(cachedPairAddress).safeTransfer(cachedPairAddress, IERC20(cachedPairAddress).balanceOf(address(this)));
        pair.burn(address(this));

        address swapToken = token1 == outputToken ? token0 : token1;

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
    function setupTokenBalancingSwap(
        IUniswapV2Pair pair,
        address vault,
        address router,
        address inputToken
    ) internal returns (address[] memory path, bool isInputA) {
        address cachedToken0 = pair.token0();
        address cachedToken1 = pair.token1();

        ExchangeHelpers.setMaxAllowance(IERC20(address(pair)), vault);
        ExchangeHelpers.setMaxAllowance(IERC20(cachedToken0), router);
        ExchangeHelpers.setMaxAllowance(IERC20(cachedToken1), router);

        isInputA = cachedToken0 == inputToken;
        require(isInputA || cachedToken1 == inputToken, "BLVO: INVALID_INPUT_TOKEN");

        path = new address[](2);
        path[0] = inputToken;

        if (isInputA) {
            path[1] = cachedToken1;
        } else {
            path[1] = cachedToken0;
        }
    }

    /// @notice Returns a certain amount of tokens to the msg.sender
    /// @param token The address of the token to return
    /// @param amount The amount of token to return
    function returnAsset(IERC20 token, uint256 amount) internal {
        require(address(token) != address(0), "BLVO: INVALID_TOKEN_TO_RETURN");
        if (amount > 0) {
            token.safeTransfer(msg.sender, amount);
        }
    }
}
