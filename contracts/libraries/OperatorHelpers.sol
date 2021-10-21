// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import "../interfaces/IOperatorSelector.sol";

/// @title Library to help the interaction with operators
library OperatorHelpers {
    /// @dev Build the calldata (with safe datas) and call the Operator
    /// @param _operator The operator address
    /// @param _commit True to call the commit operator function, false to call the revert function.
    /// @param _calldata Parameters of the operator (expect the 'self' parameter)
    /// @return success If the operator call is successful
    /// @return data The data from the call
    function callOperator(
        address _operator,
        bool _commit,
        bytes calldata _calldata
    ) internal returns (bool success, bytes memory data) {
        // The operator address needs to be the first parameter of the operator delegatecall.
        // We assume that the calldata given by the user are only the params, without the signature.
        // Parameters are concatenated and padded to 32 bytes.
        // We are concatenating the selector + operator address + given params
        bytes4 selector;
        if (_commit) {
            selector = IOperatorSelector(_operator).getCommitSelector();
        } else {
            selector = IOperatorSelector(_operator).getRevertSelector();
        }

        bytes memory safeCalldata = bytes.concat(selector, abi.encode(_operator), _calldata);

        (success, data) = _operator.delegatecall(safeCalldata);
    }
}
