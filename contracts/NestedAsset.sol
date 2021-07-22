//SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import "hardhat/console.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title Collection of NestedNFTs used to represent ownership of real assets stored in NestedReserves
 * Only NestedFactory contracts are allowed to call functions that write to storage
 */
contract NestedAsset is ERC721Enumerable, Ownable {
    using Counters for Counters.Counter;
    event FactoryAdded(address newFactory);

    Counters.Counter private _tokenIds;

    mapping(address => bool) public supportedFactories;

    mapping(uint256 => string) private _tokenURIs;

    // Stores the original asset of each asset
    mapping(uint256 => uint256) public originalAsset;

    // Stores owners of burnt assets
    mapping(uint256 => address) public lastOwnerBeforeBurn;

    constructor() ERC721("NestedNFT", "NESTED") {}

    /*
    Reverts the transaction if the caller is not the factory
    */
    modifier onlyFactory {
        require(supportedFactories[msg.sender], "NestedAsset: FORBIDDEN_NOT_FACTORY");
        _;
    }

    /*
    Reverts the transaction if the address is not the token owner
    */
    modifier onlyTokenOwner(address _address, uint256 _tokenId) {
        require(_address == ownerOf(_tokenId), "NestedAsset: FORBIDDEN_NOT_OWNER");
        _;
    }

    /*
    Returns the Uniform Resource Identifier (URI) for `tokenId` token.
    @param _tokenId The id of the NestedAsset
    @return [string]
    */
    function tokenURI(uint256 _tokenId) public view virtual override returns (string memory) {
        require(_exists(_tokenId), "URI query for nonexistent token");
        return _tokenURIs[_tokenId];
    }

    /*
    Sets the Uniform Resource Identifier (URI) for `tokenId` token.
    @param _tokenId [uint] The id of the NestedAsset
    @param _metadataURI [string] The metadata URI string
    */
    function _setTokenURI(uint256 _tokenId, string memory _metadataURI) internal virtual {
        _tokenURIs[_tokenId] = _metadataURI;
    }

    /*
    Backfills the token URI if it had never set
    @param _tokenId [uint] The id of the NestedAsset
    @param _owner [address] The id of the NestedAsset
    @param _metadataURI [string] The metadata URI string
    */
    function backfillTokenURI(
        uint256 _tokenId,
        address _owner,
        string memory _metadataURI
    ) external virtual onlyFactory onlyTokenOwner(_owner, _tokenId) {
        require(bytes(tokenURI(_tokenId)).length == 0, "NestedAsset: TOKEN_URI_IMMUTABLE");
        _setTokenURI(_tokenId, _metadataURI);
    }

    /*
    Mints an ERC721 token for the user and stores the original asset used to create the new asset if any
    @param _owner [address] The account address that signed the transaction
    @param _replicatedTokenId [uint] the token id of the replicated asset, 0 if no replication
    @return [uint256] the minted token's id
    */
    function mint(address _owner, uint256 _replicatedTokenId) public onlyFactory returns (uint256) {
        _tokenIds.increment();

        uint256 tokenId = _tokenIds.current();
        _safeMint(_owner, tokenId);

        // Stores the first asset of the replication chain as the original
        if (_replicatedTokenId == 0) return tokenId;

        uint256 originalTokenId = originalAsset[_replicatedTokenId];

        originalAsset[tokenId] = originalTokenId != 0 ? originalTokenId : _replicatedTokenId;

        return tokenId;
    }

    /*
    Mints an ERC721 token and sets the tokenUri
    @dev see mint()
    @param _owner [address] The account address that signed the transaction
    @param _metadataURI [string] The metadata URI string
    @param _replicatedTokenId [uint] the token id of the replicated asset, 0 if no replication
    @return [uint256] the minted token's id
    */
    function mintWithMetadata(
        address _owner,
        string memory _metadataURI,
        uint256 _replicatedTokenId
    ) external onlyFactory returns (uint256) {
        uint256 tokenId = mint(_owner, _replicatedTokenId);
        _setTokenURI(tokenId, _metadataURI);
        return tokenId;
    }

    /*
    Burns an ERC721 token
    @param _owner The account address that signed the transaction
    @param _tokenId The id of the NestedAsset
    */
    function burn(address _owner, uint256 _tokenId) external onlyFactory onlyTokenOwner(_owner, _tokenId) {
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
            return _exists(originalAssetId) ? ownerOf(originalAssetId) : lastOwnerBeforeBurn[originalAssetId];
        }
        return address(0);
    }

    /*
    Sets the factory for Nested assets
    @param _factory the address of the new factory
    */
    function setFactory(address _factory) external onlyOwner {
        require(_factory != address(0), "NestedAsset: INVALID_ADDRESS");
        supportedFactories[_factory] = true;
        emit FactoryAdded(_factory);
    }
}
