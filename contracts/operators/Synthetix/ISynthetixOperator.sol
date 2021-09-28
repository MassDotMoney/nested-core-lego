// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title Synthetix Operator Interface
interface ISynthetixOperator {
    /// @notice Execute an exchange via Synthetix
    /// @param own The operator address (for delegatecall context resolution)
    /// @param sourceCurrencyKey The source currency to exchange
    /// @param sourceAmount The amount of source currency
    /// @param destinationCurrencyKey The output currency
    /// @return amounts Array of output amounts
    /// @return tokens Array of output tokens
    function commitAndRevert(
        address own,
        bytes32 sourceCurrencyKey,
        uint sourceAmount,
        bytes32 destinationCurrencyKey
    ) external returns (uint256[] memory amounts, address[] memory tokens);
}