// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.11;

import "./IFlatOperator.sol";

/// @title The flat operator doesn't execute any logic to an input.
/// @notice The input is the output, and the input amount is the output amount.
/// Usefull to deposit/withdraw a token without swapping in your Orders.
contract FlatOperator is IFlatOperator {
    /// @inheritdoc IFlatOperator
    function transfer(address token, uint256 amount)
        external
        payable
        override
        returns (uint256[] memory amounts, address[] memory tokens)
    {
        require(amount != 0, "FO: INVALID_AMOUNT");

        amounts = new uint256[](2);
        tokens = new address[](2);

        // Output amounts
        amounts[0] = amount;
        amounts[1] = amount;
        // Output token
        tokens[0] = token;
        tokens[1] = token;
    }
}
