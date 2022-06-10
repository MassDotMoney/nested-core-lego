// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.11;

import "./ICurvePool.sol";

/// @title ETH Curve pool interface
/// @notice The difference with non-ETH pools is that ETH pools must have
///         a payable add_liquidity function to allow direct sending of
///         ETH in order to add liquidity with ETH and not an ERC20.
interface ICurvePoolETH is ICurvePool {
    function add_liquidity(uint256[2] calldata amounts, uint256 min_mint_amount) external payable;

    function add_liquidity(uint256[3] calldata amounts, uint256 min_mint_amount) external payable;

    function add_liquidity(uint256[4] calldata amounts, uint256 min_mint_amount) external payable;
}
