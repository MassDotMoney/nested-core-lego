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

    NestedAsset public immutable nestedAsset;

    /*
    Represents custody from Nested over an asset

    Feel free to suggest a better name
    */
    struct Holding {
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

        nestedAsset = new NestedAsset();
        // TODO: do this outside of constructor. Think about reserve architecture
        NestedReserve reserveContract = new NestedReserve();
        reserve = address(reserveContract);
    }

    modifier addressExists(address _address) {
        require(_address != address(0), "NestedFactory: invalid address");
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

    /*
    Purchase and collect tokens for the user.
    Take custody of user's tokens against fees and issue an NFT in return.
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

        uint256 tokenId = nestedAsset.mint(msg.sender);

        usersTokenIds[msg.sender].push(tokenId);

        for (uint256 i = 0; i < length; i++) {
            // if owned[i] is true we transfer from user, otherwise we'll buy
            if (owned[i]) {
                // transfer 1 * amount to the Reserve
                // user transfer 0.01 * amount in ETH/Usdt

                uint256 fees = (amounts[i] * 1) / 100;
                uint256 sendingAmount = amounts[i] - fees;
                // TODO tets if can get rid of the requires, do reverts bubble up and revert the whole tx
                require(
                    ERC20(tokens[i]).transferFrom(msg.sender, reserve, sendingAmount) == true,
                    "NestedFactory: Transfer revert"
                );
                require(
                    ERC20(tokens[i]).transferFrom(msg.sender, feeTo, fees) == true,
                    "NestedFactory: Transfer revert"
                );
            } else {
                // supply 1 * amount in ETH/usdt
                // transfer 0.01 of assets sent to feeTo
                // buy for the reserve
                console.log();
            }
            usersHoldings[tokenId].push(Holding({ token: tokens[i], amount: amounts[i], reserve: reserve }));
        }
    }
}
