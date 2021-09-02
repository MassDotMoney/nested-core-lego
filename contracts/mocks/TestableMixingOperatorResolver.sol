// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import "../MixinOperatorResolver.sol";

contract TestableMixinResolver is MixinOperatorResolver {
    bytes32 private constant CONTRACT_EXAMPLE_1 = "Example_1";
    bytes32 private constant CONTRACT_EXAMPLE_2 = "Example_2";
    bytes32 private constant CONTRACT_EXAMPLE_3 = "Example_3";

    bytes32[24] private addressesToCache = [CONTRACT_EXAMPLE_1, CONTRACT_EXAMPLE_2, CONTRACT_EXAMPLE_3];

    constructor(address _resolver) public MixinOperatorResolver(_resolver) {}

    function resolverAddressesRequired() public view override returns (bytes32[] memory addresses) {
        addresses = new bytes32[](3);
        addresses[0] = CONTRACT_EXAMPLE_1;
        addresses[1] = CONTRACT_EXAMPLE_2;
        addresses[2] = CONTRACT_EXAMPLE_3;
    }
}