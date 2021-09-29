// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import "../interfaces/external/MinimalSmartChef.sol";

/**
 * Mocks the behavior of the real SmartChef contract
 */
contract MockSmartChef is MinimalSmartChef {
    uint256 private userAmount;

    // userAmount is the default value return for any user staked amount
    constructor(uint256 _userAmount) {
        userAmount = _userAmount;
    }

    function userInfo(address _address) external view override returns (MinimalSmartChef.UserInfo memory) {
        _address = address(0); // silence compiler warning for unused _address
        return MinimalSmartChef.UserInfo(userAmount, userAmount);
    }

    function updateUserAmount(uint256 _userAmount) external {
        userAmount = _userAmount;
    }
}
