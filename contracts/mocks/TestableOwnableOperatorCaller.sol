// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

/// @notice Testable contract calling
contract TestableOwnableOperatorCaller {
    address public testableOwnableOperator;

    constructor(address _testableOwnableOperator) {
        testableOwnableOperator = _testableOwnableOperator;
    }

    /// @notice Return true if the caller is the operator contract owner
    function test() external returns (bool) {
        (bool success, bytes memory data) =
            testableOwnableOperator.delegatecall(abi.encodeWithSignature("isOwner(address)", testableOwnableOperator));
        require(success, "TestableOwnableOperatorCaller::renounceOwnership: Error");
        return true;
    }
}
