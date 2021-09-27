// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @title ZeroExOperator storage contract
contract ZeroExStorage is Ownable {
    address private _swapTarget;

    /// @notice Returns the address of 0x swaptarget
    function swapTarget() external view returns (address) {
        return _swapTarget;
    }

    /// @notice Update the address of 0x swaptarget
    function updatesSwapTarget(address swapTargetValue) external onlyOwner {
        _swapTarget = swapTargetValue;
    }
}
