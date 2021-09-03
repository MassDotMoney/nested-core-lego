// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import "../operators/OwnableOperator.sol";
import "@openzeppelin/contracts/utils/Create2.sol";

/// @notice Testable contract using OwnableOperator
/// @dev The operator externalize the Ownable logic
contract TestableOwnedOperator {
    modifier onlyOwner(address own) {
        require(
            OwnableOperator(ownableOperatorAddress(own)).owner() == msg.sender,
            "TestableOwnedOperator: caller is not the owner"
        );
        _;
    }

    constructor() {
        address ownableOperator = Create2.deploy(0, bytes32("salt"), type(OwnableOperator).creationCode);
        OwnableOperator(ownableOperator).transferOwnership(msg.sender);
    }

    /// @notice Return true if the caller is the operator contract owner
    function isOwner(address own) external onlyOwner(own) returns (bool) {
        return true;
    }

    function ownableOperatorAddress(address own) internal view returns (address) {
        bytes32 _data =
            keccak256(
                abi.encodePacked(bytes1(0xff), own, bytes32("salt"), keccak256(type(OwnableOperator).creationCode))
            );
        return address(uint160(uint256(_data)));
    }
}
