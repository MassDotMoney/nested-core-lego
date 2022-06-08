// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.14;

import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";

interface IBiswapRouter02 is IUniswapV2Router02 {
    function getAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut,
        uint256 swapFee
    ) external pure returns (uint256 amountOut);

    function getAmountIn(
        uint256 amountOut,
        uint256 reserveIn,
        uint256 reserveOut,
        uint256 swapFee
    ) external pure returns (uint256 amountIn);
}
