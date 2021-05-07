//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.3;

import "hardhat/console.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./libraries/NestedStructs.sol";

contract NestedRecords is Ownable {

    address public factory;

    mapping(uint256 => mapping(address => NestedStructs.Holding)) public assetHoldings;
    mapping(uint256 => address[]) public assetTokens;

    /*
    Reverts the transaction if the caller is not the factory
    */
    modifier onlyFactory {
        require(msg.sender == factory, "NestedRecords: FORBIDDEN");
        _;
    }

    /*
    Sets the factory for Nested assets
    @param _factory the address of the new factory
    */
    function setFactory(address _factory) external onlyOwner {
        require(_factory != address(0), "NestedRecords: INVALID_ADDRESS");
        factory = _factory;
    }

    /*
    Get content of assetHoldings mapping
    @param _tokenId the id of the NFT
    @param _token the address of the token
    */
    function getAssetHolding(uint256 _tokenId, address _token) public view returns (NestedStructs.Holding memory) {
        return assetHoldings[_tokenId][_token];
    }

    /*
    Get content of assetTokens mapping
    @param _tokenId the id of the NFT
    */
    function getAssetTokens(uint256 _tokenId) public view returns (address[] memory) {
        return assetTokens[_tokenId];
    }

    /*
    delete from mapping assetHoldings
    @param _tokenId the id of the NFT
    @param _token the address of the token
    */
    function removeHolding(uint256 _tokenId, address _token) external onlyFactory {
        delete assetHoldings[_tokenId][_token];
    }

    /*
    delete from mapping assetTokens
    @param _tokenId the id of the NFT
    */
    function removeNFT(uint256 _tokenId) external onlyFactory {
        delete assetTokens[_tokenId];
    }

    /*
    store NFT data into our mappings
    @param _tokenId the id of the NFT
    @param _token the address of the token
    @param _amountBought the amount of tokens bought
    @param reserve the address of the reserve
    */
    function store(uint256 _tokenId, address _token, uint256 _amountBought, address reserve) external onlyFactory {
        assetHoldings[_tokenId][_token] = NestedStructs.Holding({ token: _token, amount: _amountBought, reserve: reserve });
        assetTokens[_tokenId].push(_token);
    }

}
