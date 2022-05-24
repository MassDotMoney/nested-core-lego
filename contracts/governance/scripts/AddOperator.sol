// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.11;

import "../../interfaces/INestedFactory.sol";
import "../../interfaces/IOperatorResolver.sol";
import "../../abstracts/MixinOperatorResolver.sol";

contract AddOperator {
    /// @notice Call NestedFactory and OperatorResolver to add an operator.
    /// @param nestedFactory The NestedFactory address
    /// @param operator The operator to add
    /// @param name The operator bytes32 name
    function addOperator(
        address nestedFactory,
        IOperatorResolver.Operator memory operator,
        bytes32 name
    ) external {
        require(nestedFactory != address(0), "AO-SCRIPT: INVALID_FACTORY_ADDRESS");
        require(operator.implementation != address(0), "AO-SCRIPT: INVALID_IMPL_ADDRESS");

        IOperatorResolver resolver = IOperatorResolver(MixinOperatorResolver(nestedFactory).resolver());

        // Init arrays with length 1 (only one operator to import)
        bytes32[] memory names = new bytes32[](1);
        IOperatorResolver.Operator[] memory operatorsToImport = new IOperatorResolver.Operator[](1);
        MixinOperatorResolver[] memory destinations = new MixinOperatorResolver[](1);

        names[0] = name;
        operatorsToImport[0] = operator;
        destinations[0] = MixinOperatorResolver(nestedFactory);

        IOperatorResolver(resolver).importOperators(names, operatorsToImport, destinations);
        INestedFactory(nestedFactory).addOperator(name);

        require(MixinOperatorResolver(nestedFactory).isResolverCached(), "AO-SCRIPT: UNRESOLVED_CACHE");
    }
}
