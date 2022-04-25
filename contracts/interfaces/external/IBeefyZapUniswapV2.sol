// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.11;

/// @notice Interface to interact with the Beefy Zappers.
/// https://medium.com/beefyfinance/zap-one-click-beefy-vault-investing-is-here-fb266728a54f
interface IBeefyZapUniswapV2 {
    function beefIn(
        address beefyVault,
        uint256 tokenAmountOutMin,
        address tokenIn,
        uint256 tokenInAmount
    ) external;

    function beefOutAndSwap(
        address beefyVault,
        uint256 withdrawAmount,
        address desiredToken,
        uint256 desiredTokenOutMin
    ) external;
}
