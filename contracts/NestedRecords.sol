//SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import "hardhat/console.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./libraries/NestedStructs.sol";

/**
 * @title Tracks data for underlying assets of NestedNFTs.
 */
contract NestedRecords is Ownable {
    event FactoryAdded(address newFactory);

    mapping(address => bool) public supportedFactories;

    // stores for each NFT ID an asset record
    mapping(uint256 => NestedStructs.NftRecord) public records;

    uint256 private constant MAX_HOLDINGS_COUNT = 15;

    /*
    Reverts the transaction if the caller is not the factory
    */
    modifier onlyFactory {
        require(supportedFactories[msg.sender], "NestedRecords: FORBIDDEN");
        _;
    }

    /*
    Sets the factory for Nested records
    @param _factory the address of the new factory
    */
    function setFactory(address _factory) external onlyOwner {
        require(_factory != address(0), "NestedRecords: INVALID_ADDRESS");
        supportedFactories[_factory] = true;
        emit FactoryAdded(_factory);
    }

    /*
    Get holding object for this NFT ID
    @param _nftId the id of the NFT
    @param _token the address of the token
    */
    function getAssetHolding(uint256 _nftId, address _token) public view returns (NestedStructs.Holding memory) {
        return records[_nftId].holdings[_token];
    }

    /*
    Get content of assetTokens mapping
    @param _nftId the id of the NFT
    */
    function getAssetTokens(uint256 _nftId) public view returns (address[] memory) {
        return records[_nftId].tokens;
    }

    /**
    Get reserve the assets are stored in
    @param _nftId the NFT ID
    @return the reserve address these assets are stored in
    */
    function getAssetReserve(uint256 _nftId) external view returns (address) {
        return records[_nftId].reserve;
    }

    /**
    Get how many tokens are in a portfolio/NFT
    @param _nftId [uint256] NFT ID to examine
    @return the array length
    */
    function getAssetTokensLength(uint256 _nftId) external view returns (uint256) {
        return records[_nftId].tokens.length;
    }

    /**
    Set the reserve where assets are stored
    @param _nftId [uint256] the NFT ID to update
    @param _nextReserve [address] address for the new reserve
    */
    function setReserve(uint256 _nftId, address _nextReserve) external onlyFactory {
        records[_nftId].reserve = _nextReserve;
    }

    /**
    Remove a token from the array of tokens in assetTokens
    @param _nftId [uint256] ID for the NFT
    @param _tokenIndex [uint256] token index to delete in the array of tokens
    */
    function removeToken(uint256 _nftId, uint256 _tokenIndex) external onlyFactory {
        address[] storage tokens = records[_nftId].tokens;
        tokens[_tokenIndex] = tokens[tokens.length - 1];
        tokens.pop();
    }

    /*
    delete from mapping assetHoldings
    @param _nftId the id of the NFT
    @param _token the address of the token
    */
    function removeHolding(uint256 _nftId, address _token) external onlyFactory {
        delete records[_nftId].holdings[_token];
    }

    /*
    delete from mapping assetTokens
    @param _nftId the id of the NFT
    */
    function removeNFT(uint256 _nftId) external onlyFactory {
        delete records[_nftId];
    }

    /*
    store NFT data into our mappings
    @param _nftId the id of the NFT
    @param _token the address of the token
    @param _amountBought the amount of tokens bought
    @param _reserve the address of the reserve
    */
    function store(
        uint256 _nftId,
        address _token,
        uint256 _amountBought,
        address _reserve
    ) external onlyFactory {
        require(records[_nftId].tokens.length < MAX_HOLDINGS_COUNT, "NestedRecords: TOO_MANY_ORDERS");
        require(
            _reserve != address(0) && (_reserve == records[_nftId].reserve || records[_nftId].reserve == address(0)),
            "NestedRecords: INVALID_RESERVE"
        );

        NestedStructs.Holding memory holding = records[_nftId].holdings[_token];
        // if stored token already exist, update it 
        if (holding.isActive) {
            records[_nftId].holdings[_token].amount = holding.amount + _amountBought;
        } else {
            records[_nftId].holdings[_token] = NestedStructs.Holding({ token: _token, amount: _amountBought, isActive: true });
            records[_nftId].tokens.push(_token);
            records[_nftId].reserve = _reserve;
        }
    }

    /*
    update NFT data into our mappings
    @param _tokenId the id of the NFT
    @param _token the address of the token
    @param _amountSold the amount of tokens sold
    */
    function update(uint256 _nftId, uint256 _tokenIndex, address _token, uint256 _amountSold) external onlyFactory {
        NestedStructs.Holding memory holding = records[_nftId].holdings[_token];
        require(holding.isActive, "ALREADY_SOLD");
        uint256 remainingAmount = holding.amount - _amountSold;
        //require(remainingAmount >= 0, "INSUFFICIENT_FUND");

        // update amount or delete if nothing remaining
        if (remainingAmount > 0) {
            records[_nftId].holdings[_token].amount = holding.amount - _amountSold;
        } else {
            delete records[_nftId].holdings[_token];
            address[] storage tokens = records[_nftId].tokens;
            tokens[_tokenIndex] = tokens[tokens.length - 1];
            tokens.pop();
    
        }
    }

}
