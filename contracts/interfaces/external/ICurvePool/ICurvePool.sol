// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.11;

/// @title Curve pool interface
interface ICurvePool {
    function token() external view returns (address);

    function coins(uint256 index) external view returns (address);
}
