// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.11;

interface Gauge {
    function withdraw(uint256 _value, bool _claim_rewards) external;
    function deposit(uint256 _value, address _addr, bool _claim_rewards) external;
    function claimable_reward(address _addr, address _token) external view returns (uint256);
}