// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.11;

import "../NestedReserve.sol";
import "../NestedAsset.sol";
import "../NestedRecords.sol";
import "../NestedFactory.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title Nested Migrator
/// @notice Migrate current records, reserve and assets to new contracts
contract MigratorV1 is Ownable {
    /// @dev New reserve contract/address
    NestedReserve public immutable newReserve;

    /// @dev New nested asset (ERC721) contract/address
    NestedAsset public immutable newNestedAsset;

    /// @dev New records contract/address
    NestedRecords public immutable newNestedRecords;

    /// @dev New records contract/address
    NestedFactory public immutable nestedFactory;

    mapping(uint256 => bool) public migrated;

    constructor(
        NestedFactory _factory,
        NestedReserve _reserve,
        NestedAsset _nestedAsset,
        NestedRecords _nestedRecords
    ) {
        require(
            address(_nestedAsset) != address(0) &&
                address(_nestedRecords) != address(0) &&
                address(_reserve) != address(0) &&
                address(_factory) != address(0),
            "MG: INVALID_ADDRESS"
        );
        nestedFactory = _factory;
        newReserve = _reserve;
        newNestedAsset = _nestedAsset;
        newNestedRecords = _nestedRecords;
    }

    /// @notice Migrate portfolios
    /// @param start First id to migrate
    /// @param end Last id to migrate
    function migrate(uint256 start, uint256 end) external onlyOwner {
        NestedAsset nestedAsset = nestedFactory.nestedAsset();
        NestedRecords nestedRecords = nestedFactory.nestedRecords();
        NestedReserve nestedReserve = nestedFactory.reserve();

        address[] memory tokens; 
        uint256[] memory amounts;
        uint256 originalId;
        uint256 amountBefore;
        uint256 amountAfter;

        for (uint256 i = start; i <= end; i++) {
            require(!migrated[i], "MG: ALREADY_MIGRATED");

            try nestedAsset.ownerOf(i) returns (address owner) {
                migrated[i] = true;
                originalId = nestedAsset.originalAsset(i);
                newNestedAsset.mint(owner, originalId);

                (tokens, amounts) = nestedRecords.tokenHoldings(i);
                for (uint256 y = 0; y < tokens.length; y++) {
                    amountBefore = IERC20(tokens[y]).balanceOf(address(newReserve));
                    nestedReserve.transfer(address(newReserve), IERC20(tokens[y]), amounts[y]);
                    amountAfter = IERC20(tokens[y]).balanceOf(address(newReserve));
                    newNestedRecords.store(i, tokens[y], amountAfter - amountBefore, address(newReserve));
                }

                nestedRecords.removeNFT(i);
                nestedAsset.burn(owner, i);
            } catch {
                // NFT already burned or never created
                return;
            }
        }
    }
}
