// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import "../operators/OwnableOperator.sol";

/// @notice Testable contract inheriting OwnableOperator
contract TestableOwnableOperator is OwnableOperator {
    /// @inheritdoc OwnableOperator
    function ownerStorage() internal pure override returns (OwnableOperatorData storage data) {
        bytes32 position = keccak256("nested.operator.testable.owner");
        assembly {
            data.slot := position
        }
    }

    /// @notice Return true if the caller is the contract owner
    function isOwner() external view onlyOwner returns (bool) {
        return true;
    }
}
