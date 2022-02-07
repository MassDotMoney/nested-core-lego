// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.11;

/// @notice Testable contract calling
contract TestableOperatorCaller {
    address public operator;

    constructor(address _operator) {
        operator = _operator;
    }

    function performSwap(
        address own,
        address sellToken,
        address buyToken,
        bytes calldata swapCallData
    ) external returns (bool) {
        (bool success, bytes memory data) = operator.delegatecall(
            abi.encodeWithSignature("performSwap(address,address,bytes)", sellToken, buyToken, swapCallData)
        );
        require(success, "TestableOperatorCaller::performSwap: Error");
        return true;
    }
}
