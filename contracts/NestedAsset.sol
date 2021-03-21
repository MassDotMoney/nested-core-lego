//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.7.0;

import "hardhat/console.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721Burnable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract NestedAsset is ERC721, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    address public factory;

    constructor(address _factory) public ERC721("NestedAsset", "NESTED") {
        factory = _factory;
    }

    /*
   Reverts the transaction if the caller is not the factory
  */
    modifier onlyFactory() {
        require(msg.sender == factory, "NestedAsset: FORBIDDEN");
        _;
    }

    /*
   Mints an ERC721 token for the user
   @param owner The account address that signed the transaction
   @return [uint256] the minted token's id
  */
    function mint(address _owner) public onlyFactory() returns (uint256) {
        _tokenIds.increment();

        uint256 newNestedId = _tokenIds.current();
        _safeMint(_owner, newNestedId);
        require(_exists(newNestedId), "NestedAsset: Mint failed");

        return newNestedId;
    }

    /*
   Burns an ERC721 token
   @param owner The account address that signed the transaction
   @param tokenId The id of the NestedAsset
  */
    function burn(address _owner, uint256 _tokenId) public onlyFactory() {
        require(
            _owner == ownerOf(_tokenId),
            "NestedAsset: only owner can burn"
        );
        _burn(_tokenId);
        require(!_exists(_tokenId), "NestedAsset: Burn failed");
    }
}
