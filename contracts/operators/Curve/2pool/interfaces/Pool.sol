// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.11;

interface Pool {
    function exchange(uint128 i, uint128 j, uint256 _dx, uint256 _min_dy) external returns (uint256);
    function add_liquidity(uint256[2] calldata _amounts, uint256 _min_mint_amount) external returns (uint256); 
    function remove_liquidity(uint256 _amount, uint256[2] calldata _min_amounts) external returns (uint256);
    function remove_liquidity_one_coin(uint256 _token_amount,int128 i, uint256 _min_amount) external returns (uint256);
}