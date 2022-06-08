// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.14;

import "@openzeppelin/contracts/interfaces/IERC721Enumerable.sol";

interface INestedAsset is IERC721Enumerable {
    function tokenURI(uint256 _tokenId) external view returns (string memory);

    function lastOwnerBeforeBurn(uint256 _tokenId) external view returns (address);
}

interface INestedRecords {
    function tokenHoldings(uint256 _nftId) external view returns (address[] memory, uint256[] memory);
}

/// @title Batcher for NestedAsset
/// @notice Front-end batch calls to minimize interactions.
contract NestedAssetBatcher {
    INestedAsset public immutable nestedAsset;
    INestedRecords public immutable nestedRecords;

    struct Nft {
        uint256 id;
        Asset[] assets;
    }

    struct Asset {
        address token;
        uint256 qty;
    }

    constructor(INestedAsset _nestedAsset, INestedRecords _nestedRecords) {
        nestedAsset = _nestedAsset;
        nestedRecords = _nestedRecords;
    }

    /// @notice Get all NestedAsset tokenURIs owned by a user
    /// @param user The address of the user
    /// @return String array of all tokenURIs
    function getURIs(address user) external view returns (string[] memory) {
        unchecked {
            uint256 numTokens = nestedAsset.balanceOf(user);
            string[] memory uriList = new string[](numTokens);

            for (uint256 i; i < numTokens; i++) {
                uriList[i] = nestedAsset.tokenURI(nestedAsset.tokenOfOwnerByIndex(user, i));
            }

            return (uriList);
        }
    }

    /// @notice Get all NestedAsset IDs owned by a user
    /// @param user The address of the user
    /// @return Array of all IDs
    function getIds(address user) external view returns (uint256[] memory) {
        unchecked {
            uint256 numTokens = nestedAsset.balanceOf(user);
            uint256[] memory ids = new uint256[](numTokens);
            for (uint256 i; i < numTokens; i++) {
                ids[i] = nestedAsset.tokenOfOwnerByIndex(user, i);
            }
            return (ids);
        }
    }

    /// @notice Get all NFTs (with tokens and quantities) owned by a user
    /// @param user The address of the user
    /// @return Array of all NFTs (struct Nft)
    function getNfts(address user) external view returns (Nft[] memory) {
        unchecked {
            uint256 numTokens = nestedAsset.balanceOf(user);
            Nft[] memory nfts = new Nft[](numTokens);
            for (uint256 i; i < numTokens; i++) {
                uint256 nftId = nestedAsset.tokenOfOwnerByIndex(user, i);
                (address[] memory tokens, uint256[] memory amounts) = nestedRecords.tokenHoldings(nftId);
                uint256 tokenLength = tokens.length;
                Asset[] memory nftAssets = new Asset[](tokenLength);
                for (uint256 j; j < tokenLength; j++) {
                    nftAssets[j] = Asset({ token: tokens[j], qty: amounts[j] });
                }
                nfts[i] = Nft({ id: nftId, assets: nftAssets });
            }
            return (nfts);
        }
    }

    /// @notice Require the given tokenID to haven been created and call tokenHoldings.
    /// @param _nftId The token id
    /// @return tokenHoldings returns
    function requireTokenHoldings(uint256 _nftId) external view returns (address[] memory, uint256[] memory) {
        try nestedAsset.ownerOf(_nftId) {} catch {
            // owner == address(0)
            require(nestedAsset.lastOwnerBeforeBurn(_nftId) != address(0), "NAB: NEVER_CREATED");
        }
        return nestedRecords.tokenHoldings(_nftId);
    }
}
