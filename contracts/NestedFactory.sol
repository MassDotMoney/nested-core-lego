//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.7.0;

import "hardhat/console.sol";
import "./NestedAsset.sol";

contract NestedFactory {
    event NestedCreated(uint256 indexed tokenId, address indexed owner);

    address public feeTo;
    address public feeToSetter;

    /*
    Represents custody from Nested over an asset

    Feel free to suggest a better name
    */
    struct Holding {
        // no need to store user's address here if we push those objects to a mapping address -> struct
        address token;
        uint256 amount;
        // uint256 lockedUntil; // For v1.1 hodl feature
    }

    mapping(address => uint256[]) public usersTokens;
    mapping(uint256 => Holding[]) public usersHoldings;

    constructor(address _feeToSetter) {
        feeToSetter = _feeToSetter;
    }

    /*
   Sets the address receiving the fees
   @param feeTo The address of the receiver
   */
    function setFeeTo(address _feeTo) external {
        require(msg.sender == feeToSetter, "NestedFactory: FORBIDDEN");
        feeTo = _feeTo;
    }

    /*
    Sets the address that can redirect the fees to a new receiver
    @param _feeToSetter The address that decides where the fees go
    */
    function setFeeToSetter(address _feeToSetter) external {
        require(msg.sender == feeToSetter, "NestedFactory: FORBIDDEN");
        feeToSetter = _feeToSetter;
    }

    /*
    Purchase and collect assets for the user.
    Take custody of users assets against fees and issue an NFT in return.
    @param tokens [<address>] the list of tokens to purchase or collect
    @param amounts [<uint256>] the respective amount of token
    @param owner [<bool>] whether the user supplies the tokens
    */
    function create(
        address[] calldata tokens,
        uint256[] calldata amounts,
        bool[] calldata owned
    ) external {
        uint256 length = tokens.length;
        // TODO
        // we'd better check quickly that the user is sending enough coins to purchase assets.
        // NDX uses chainlink to compute short term average cost of tokens
        // An alternative is to get quotes from 0x in the frontend and pass a value normalized in ETH
        require(length > 0, "NestedFactory: TOKENS_ARG_ERROR");
        require(length == amounts.length, "NestedFactory: AMOUNTS_ARG_ERROR");
        require(length == owned.length, "NestedFactory: OWNER_ARG_ERROR");
            
            uint tokenId = 1; // tokenId will be the result of the minting later on
            usersTokens[msg.sender].push(tokenId);

        for (uint256 i = 0; i < length; i++) {
            // if owned[i] is true we transfer from user, otherwise we'll buy
            console.log(owned[i] ? "Collecting " : "Buying ", amounts[i], " of ", tokens[i]);

        usersHoldings[tokenId].push(
            Holding({
                token: tokens[i],
                amount: amounts[i]
            })
        );
        }
        // TODO add relevant requires.
    }
}
