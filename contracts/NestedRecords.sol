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
    event MaxHoldingsChanges(uint256 maxHoldingsCount);

    mapping(address => bool) public supportedFactories;

    // stores for each NFT ID an asset record
    mapping(uint256 => NestedStructs.NftRecord) public records;

    uint256 public maxHoldingsCount;

    /*
    Reverts the transaction if the caller is not the factory
    */
    modifier onlyFactory {
        require(supportedFactories[msg.sender], "NestedRecords: FORBIDDEN");
        _;
    }

    /*
    @param maxHoldingsCount [uint] the maximum number of holdings for an NFT record
    */
    constructor(uint256 _maxHoldingsCount) {
        maxHoldingsCount = _maxHoldingsCount;
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
    Sets the maximum number of holdings for an NFT record
    @param _maxHoldingsCount [uint] the new maximum number of holdings
    */
    function setMaxHoldingsCount(uint256 _maxHoldingsCount) external onlyOwner {
        require(_maxHoldingsCount > 0, "NestedRecords: INVALID_MAX_HOLDINGS");
        maxHoldingsCount = _maxHoldingsCount;
        emit MaxHoldingsChanges(maxHoldingsCount);
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
    Remove a token from the array of tokens in assetTokens. Does not remove holding record
    @param _nftId [uint256] ID for the NFT
    @param _tokenIndex [uint256] token index to delete in the array of tokens
    */
    function freeToken(uint256 _nftId, uint256 _tokenIndex) public onlyFactory {
        address[] storage tokens = records[_nftId].tokens;
        tokens[_tokenIndex] = tokens[tokens.length - 1];
        tokens.pop();
    }

    /**
    Delete a holding item in holding mapping. Does not remove token in NftRecord.tokens array
    @param _nftId [uint256] NFT's identifier
    @param _token [address] token address for holding to remove
     */
    function freeHolding(uint256 _nftId, address _token) public onlyFactory {
        delete records[_nftId].holdings[_token];
    }

    /*
    delete from mapping assetTokens
    @param _nftId the id of the NFT
    */
    function removeNFT(uint256 _nftId) external onlyFactory {
        delete records[_nftId];
    }

    /**
    add a record for NFT data into our mappings
    @param _nftId the id of the NFT
    @param _token the address of the token
    @param _amount the amount of tokens bought
    @param _reserve the address of the reserve
    */
    function createRecord(
        uint256 _nftId,
        address _token,
        uint256 _amount,
        address _reserve
    ) public onlyFactory {
        require(records[_nftId].tokens.length < maxHoldingsCount, "NestedRecords: TOO_MANY_ORDERS");
        require(
            _reserve != address(0) && (_reserve == records[_nftId].reserve || records[_nftId].reserve == address(0)),
            "NestedRecords: INVALID_RESERVE"
        );

        NestedStructs.Holding memory holding = records[_nftId].holdings[_token];
        require(!holding.isActive, "NestedRecords: HOLDING_EXISTS");

        records[_nftId].holdings[_token] = NestedStructs.Holding({ token: _token, amount: _amount, isActive: true });
        records[_nftId].tokens.push(_token);
        records[_nftId].reserve = _reserve;
    }

    /**
    Fully delete a holding record for an NFT
    @param _nftId [uint256] the id of the NFT
    @param _tokenIndex [uint256] the token index in holdings array
    */
    function deleteAsset(uint256 _nftId, uint256 _tokenIndex) external onlyFactory {
        address[] storage tokens = records[_nftId].tokens;
        address token = tokens[_tokenIndex];
        NestedStructs.Holding memory holding = records[_nftId].holdings[token];

        require(holding.isActive, "NestedRecords: HOLDING_INACTIVE");

        delete records[_nftId].holdings[token];
        freeToken(_nftId, _tokenIndex);
    }

    /**
    Update the amount for a specific holding
    @param _nftId [uint256] the id of the NFT
    @param _token [address] the token/holding address
    @param _amount [uint256] updated amount for this asset
    */
    function updateHoldingAmount(
        uint256 _nftId,
        address _token,
        uint256 _amount
    ) public onlyFactory {
        records[_nftId].holdings[_token].amount = _amount;
    }

    /**
    Helper function that creates a record or add the holding if record already exists
    @param _nftId [uint256] the NFT's identifier
    @param _token [address] the token/holding address
    @param _amount [uint256] amount to add for this asset
    @param _reserve [address] reserve address
    */
    function store(
        uint256 _nftId,
        address _token,
        uint256 _amount,
        address _reserve
    ) external onlyFactory {
        NestedStructs.Holding memory holding = records[_nftId].holdings[_token];
        if (holding.isActive) {
            require(records[_nftId].reserve == _reserve, "NestedRecords: RESERVE_MISMATCH");
            updateHoldingAmount(_nftId, _token, holding.amount + _amount);
            return;
        }
        createRecord(_nftId, _token, _amount, _reserve);
    }

    /*
    update NFT data into our mappings
    @param _tokenId the id of the NFT
    @param _token the address of the token
    @param _amountSold the amount of tokens sold
    */
    function update(
        uint256 _nftId,
        uint256 _tokenIndex,
        address _token,
        uint256 _amountSold
    ) external onlyFactory {
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
