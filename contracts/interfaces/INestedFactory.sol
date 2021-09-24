// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title NestedFactory interface
interface INestedFactory {
    /// @dev Emitted when the smartChef address is updated
    /// @param nextSmartChef The new smartChef address
    event SmartChefUpdated(address nextSmartChef);

    /// @dev Emitted when the VIP discound is updated
    /// @param vipDiscount The new discount amount
    /// @param vipMinAmount The new minimum amount
    event VipDiscountUpdated(uint256 vipDiscount, uint256 vipMinAmount);

    /// @dev Emitted when a NFT (portfolio) is created
    /// @param nftId The NFT token Id
    /// @param originalNftId If replicated, the original NFT token Id
    event NftCreated(uint256 indexed nftId, uint256 originalNftId);

    /// @dev Emitted when a NFT (portfolio) is updated
    /// @param nftId The NFT token Id
    event NftUpdated(uint256 indexed nftId);

    /// @dev Emitted when a NFT (portfolio) is burned
    /// @param nftId The burned NFT token iI
    event NftBurned(uint256 indexed nftId);

    /// @dev Represent an order made to the factory when creating/editing an NFT
    /// @param operator The bytes32 name of the Operator
    /// @param token The expected token address in output/input
    /// @param callData The operator parameters (delegatecall)
    /// @param commit If the order is a commit (false if it's a revert)
    struct Order {
        bytes32 operator;
        address token;
        bytes callData;
        bool commit;
    }

    // TODO functions
}
