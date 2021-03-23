//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.7.0;

import "hardhat/console.sol";
import "./NestedAsset.sol";
import "./NestedReserve.sol";

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract NestedFactory {
    event NestedCreated(uint256 indexed tokenId, address indexed owner);

    address public feeTo;
    address public feeToSetter;
    address public reserve;

    /*
    Represents custody from Nested over an asset

    Feel free to suggest a better name
    */
    struct Holding {
        // no need to store user's address here if we push those objects to a mapping address -> struct
        address token;
        uint256 amount;
        address reserve;
        // uint256 lockedUntil; // For v1.1 hodl feature
    }

    mapping(address => uint256[]) public usersTokenIds;
    mapping(uint256 => Holding[]) public usersHoldings;

    constructor(address _feeToSetter) {
        feeToSetter = _feeToSetter;
        feeTo = _feeToSetter;

        // TODO: do this outside of cousntructor 
        NestedReserve reserveContract = new NestedReserve();
        reserve = address(reserveContract);
    }

    modifier reserveExists() {
        require(reserve != address(0));
        _;
    }

    modifier addressExists(address _address) {
        require(_address != address(0));
        _;
    }

    /*
   Sets the address receiving the fees
   @param feeTo The address of the receiver
   */
    function setFeeTo(address _feeTo) external addressExists(_feeTo) {
        require(msg.sender == feeToSetter, "NestedFactory: FORBIDDEN");
        feeTo = _feeTo;
    }

    /*
    Sets the address that can redirect the fees to a new receiver
    @param _feeToSetter The address that decides where the fees go
    */
    function setFeeToSetter(address _feeToSetter) external addressExists(_feeToSetter) {
        require(msg.sender == feeToSetter, "NestedFactory: FORBIDDEN");
        feeToSetter = _feeToSetter;
    }

    function setReserve(address _reserve) external addressExists(_reserve) {
        reserve = _reserve;
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
    ) external reserveExists() {
        uint256 length = tokens.length;
        // TODO
        // we'd better check quickly that the user is sending enough coins to purchase assets.
        // NDX uses chainlink to compute short term average cost of tokens
        // An alternative is to get quotes from 0x in the frontend and pass a value normalized in ETH
        require(length > 0, "NestedFactory: TOKENS_ARG_ERROR");
        require(length == amounts.length, "NestedFactory: AMOUNTS_ARG_ERROR");
        require(length == owned.length, "NestedFactory: OWNER_ARG_ERROR");

        // mint with nestedAsset
        uint tokenId = 1; //NestedAsset('0xcontract_address').mint(msg.sender);

        usersTokenIds[msg.sender].push(tokenId);

        for (uint256 i = 0; i < length; i++) {
            // if owned[i] is true we transfer from user, otherwise we'll buy
            if(owned[i]) {
                // transfer 0.99 * amount to the Reserve
                // collect 0.01 * amount, send to feeTo
                uint256 fees = amounts[i] * 1 / 10000;
                uint256 sendingAmount = amounts[i] - fees;
                require(ERC20(tokens[i]).transferFrom(msg.sender, reserve, sendingAmount) == true);
                require(ERC20(tokens[i]).transferFrom(msg.sender, feeTo, fees) == true);
                // TODO check that it revert when failed transfer
            } else {
                // transfer 0.01 of assets sent to feeTo
                // buy for the reserve
                console.log();
            }

        usersHoldings[tokenId].push(
            Holding({
                token: tokens[i],
                amount: amounts[i],
                reserve: reserve
            })
        );
        }

        // TODO add relevant requires.
    }
}
