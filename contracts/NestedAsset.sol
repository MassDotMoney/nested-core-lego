//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.3;

import "hardhat/console.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract NestedAsset is ERC721Enumerable, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    address public factory;

    mapping (uint256 => string) private _tokenURIs;

    constructor() ERC721("NestedAsset", "NESTED") {
        factory = msg.sender;
    }

    /*
    Reverts the transaction if the caller is not the factory
    */
    modifier onlyFactory {
        require(msg.sender == factory, "NestedAsset: FORBIDDEN");
        _;
    }

    /*
    Returns the Uniform Resource Identifier (URI) for `tokenId` token.
    @param _tokenId The id of the NestedAsset
    */
    function tokenURI(uint256 _tokenId) public view virtual override returns (string memory) {
        require(_exists(_tokenId), "URI query for nonexistent token");

        return _tokenURIs[_tokenId]; 
    }

    /*
    Sets the Uniform Resource Identifier (URI) for `tokenId` token.
    @param _tokenId The id of the NestedAsset
    @param _metadataURI The metadata URI string
    */
    function _setTokenURI(uint256 _tokenId, string memory _metadataURI) internal virtual {
        require(_exists(_tokenId), "URI set of nonexistent token");
        _tokenURIs[_tokenId] = _metadataURI;
    }

    /*
    Mints an ERC721 token for the user
    @param owner The account address that signed the transaction
    @param _metadataURI The metadata URI string
    @return [uint256] the minted token's id
    */
    function mint(address _owner, string memory _metadataURI) public onlyFactory returns (uint256) {
        _tokenIds.increment();

        uint256 newNestedId = _tokenIds.current();
        _safeMint(_owner, newNestedId);
        _setTokenURI(newNestedId, _metadataURI);
        return newNestedId;
    }

    /*
    Burns an ERC721 token
    @param owner The account address that signed the transaction
    @param tokenId The id of the NestedAsset
    */
    function burn(address _owner, uint256 _tokenId) public onlyFactory {
        require(_owner == ownerOf(_tokenId), "NestedAsset: FORBIDDEN");
        _burn(_tokenId);

        if (bytes(_tokenURIs[_tokenId]).length != 0) {
            delete _tokenURIs[_tokenId];
        }
    }

    // TODO only allow the factory or a migrator to set the factory address
    /*
    Sets the factory for Nested assets
    @param factory the address of the new factory
    */
    function setFactory(address _factory) external {
        require(factory != address(0), "NestedAsset: INVALID_ADDRESS");
        factory = _factory;
    }
}
