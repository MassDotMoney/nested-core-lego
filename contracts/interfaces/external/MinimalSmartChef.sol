// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

interface MinimalSmartChef {
    struct UserInfo {
        uint256 amount; // How many LP tokens the user has provided.
        uint256 rewardDebt; // Reward debt. See explanation below.
    }

    function userInfo(address _address) external view returns (UserInfo memory);
}
