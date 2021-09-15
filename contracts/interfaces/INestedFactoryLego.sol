// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice NestedFactory interface
interface INestedFactoryLego {
    /// @dev TODO
    /// @param nextSmartChef TODO
    event SmartChefUpdated(address nextSmartChef);

    /// @dev TODO
    /// @param vipDiscount TODO
    /// @param vipMinAmount TODO
    event VipDiscountUpdated(uint256 vipDiscount, uint256 vipMinAmount);

    /// @dev Represent an order made to the factory when creating/editing an NFT
    /// @param operator The bytes32 name of the Operator
    /// @param outputToken The expected token address in output
    /// @param callData The operator parameters (delegatecall)
    struct Order {
        bytes32 operator;
        address outputToken;
        bytes callData;
    }

    // TODO functions
}
