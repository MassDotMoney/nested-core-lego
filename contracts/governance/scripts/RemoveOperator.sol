// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.11;

import "../../interfaces/INestedFactory.sol";
import "../../interfaces/IOperatorResolver.sol";
import "../../abstracts/MixinOperatorResolver.sol";

contract RemoveOperator {
    /// @notice Call NestedFactory and OperatorResolver to remove an operator.
    /// @param nestedFactory The NestedFactory address
    /// @param name The operator bytes32 name
    function removeOperator(address nestedFactory, bytes32 name) external {
        require(nestedFactory != address(0), "RO-SCRIPT: INVALID_FACTORY_ADDRESS");

        INestedFactory(nestedFactory).removeOperator(name);

        IOperatorResolver resolver = IOperatorResolver(MixinOperatorResolver(nestedFactory).resolver());

        // Init arrays with length 1 (only one operator to remove)
        bytes32[] memory names = new bytes32[](1);
        IOperatorResolver.Operator[] memory operatorsToImport = new IOperatorResolver.Operator[](1);
        MixinOperatorResolver[] memory destinations = new MixinOperatorResolver[](1);

        names[0] = name;
        operatorsToImport[0] = IOperatorResolver.Operator({ implementation: address(0), selector: bytes4(0) });
        destinations[0] = MixinOperatorResolver(nestedFactory);

        IOperatorResolver(resolver).importOperators(names, operatorsToImport, destinations);

        require(MixinOperatorResolver(nestedFactory).isResolverCached(), "RO-SCRIPT: UNRESOLVED_CACHE");
    }
}
