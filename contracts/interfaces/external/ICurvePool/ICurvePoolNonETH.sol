//SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.11;

import "./ICurvePool.sol";

/// @title non ETH Curve pool interface
interface ICurvePoolNonETH is ICurvePool {
    function add_liquidity(uint256[2] calldata amounts, uint256 min_mint_amount) external;

    function add_liquidity(uint256[3] calldata amounts, uint256 min_mint_amount) external;

    function add_liquidity(uint256[4] calldata amounts, uint256 min_mint_amount) external;
}
