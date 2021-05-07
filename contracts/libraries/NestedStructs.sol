//SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

library NestedStructs {
    /*
    Info about assets stored in reserves
    */
    struct Holding {
        address token;
        uint256 amount;
        bool isActive;
    }

    /*
    Store user asset informations
    */
    struct NftRecord {
        mapping(address => NestedStructs.Holding) holdings;
        address[] tokens;
        address reserve;
    }

    /*
    Data required for swapping a token
    */
    struct TokenOrder {
        address token;
        bytes callData;
    }
}
