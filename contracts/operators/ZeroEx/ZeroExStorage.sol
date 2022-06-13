// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.14;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @title ZeroExOperator storage contract
contract ZeroExStorage is Ownable {
    address public swapTarget;

    /// @notice Update the address of 0x swaptarget
    function updatesSwapTarget(address swapTargetValue) external onlyOwner {
        swapTarget = swapTargetValue;
    }
}
