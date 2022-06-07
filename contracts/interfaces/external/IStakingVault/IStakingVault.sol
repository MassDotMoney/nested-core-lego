// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.11;

/// @title Generic staking vault interface
interface IStakingVault {
    function deposit(uint256 _amount) external;

    function withdraw(uint256 _shares) external;
}
