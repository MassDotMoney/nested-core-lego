//SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.11;

/// @title Curve pool interface
interface ICurvePool {
    function token() external view returns (address);

    function coins(uint256 index) external view returns (address);

    function remove_liquidity_one_coin(
        uint256 _token_amount,
        int128 i,
        uint256 min_amount
    ) external;

    function remove_liquidity_one_coin(
        uint256 _token_amount,
        uint256 i,
        uint256 min_amount
    ) external;
}
