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

    // Stores the original asset of each asset
    mapping(uint256 => uint256) public originalAsset;

    // Stores owners of burnt assets
    mapping(uint256 => address) public lastOwnerBeforeBurn;

    constructor() ERC721("NestedNFT", "NESTED") {
        factory = msg.sender;
    }

    /*
    Reverts the transaction if the caller is not the factory
    */
    modifier onlyFactory {
        require(msg.sender == factory, "NestedAsset: FORBIDDEN");
        _;
    }

    // TODO overload mint, create vs replication?
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
    Mints an ERC721 token for the user and stores the original asset used to create the new asset if any
    @param owner [address] The account address that signed the transaction
    @param _metadataURI [string ]The metadata URI string
    @param _replicatedTokenId [uint] the token id of the replicated asset, 0 if no replication
    @return [uint256] the minted token's id
    */
    function mint(address _owner, string memory _metadataURI, uint256 _replicatedTokenId) external onlyFactory returns (uint256) {
        _tokenIds.increment();

        uint256 tokenId = _tokenIds.current();
        _safeMint(_owner, tokenId);
        _setTokenURI(tokenId, _metadataURI);
        // TODO make sure everything is tested

        // Stores the first asset of the replication chain as the original
        if (_replicatedTokenId == 0) {
            originalAsset[tokenId] = _replicatedTokenId;
        } else if (originalAsset[_replicatedTokenId] != 0) {
            originalAsset[tokenId]= originalAsset[_replicatedTokenId];
        }
        return tokenId;
    }

    /*
    Burns an ERC721 token
    @param _owner The account address that signed the transaction
    @param _tokenId The id of the NestedAsset
    */
    function burn(address _owner, uint256 _tokenId) external onlyFactory {
        require(_owner == ownerOf(_tokenId), "NestedAsset: FORBIDDEN");
        lastOwnerBeforeBurn[_tokenId] = _owner;
        _burn(_tokenId);

        if (bytes(_tokenURIs[_tokenId]).length != 0) {
            delete _tokenURIs[_tokenId];
        }
    }

    /*
    Returns the owner of the original token if the token was replicated
    If the original asset was burnt, the last owner before burn is returned
    @param _tokenId [uint] the asset for which we want to know the original owner
    @return [address] the owner of the original asset
    */
    function originalOwner(uint256 _tokenId) public view returns (address) {
        uint256 originalAssetId = originalAsset[_tokenId];

        if (originalAssetId != 0) {
            return _exists(_tokenId) ? ownerOf(originalAssetId) : lastOwnerBeforeBurn[originalAssetId];
        }
        return address(0);
    }

    // TODO only allow the factory or a migrator to set the factory address
    /*
    Sets the factory for Nested assets
    @param _factory the address of the new factory
    */
    function setFactory(address _factory) external onlyOwner{
        require(factory != address(0), "NestedAsset: INVALID_ADDRESS");
        factory = _factory;
    }
}
