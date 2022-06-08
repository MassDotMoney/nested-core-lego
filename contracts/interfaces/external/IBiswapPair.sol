// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.14;

import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";

interface IBiswapPair is IUniswapV2Pair {
    function swapFee() external view returns (uint32);
}
