// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.3;

import "hardhat/console.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract NestedToken is ERC20, Ownable {
    uint256 public constant INITIAL_SUPPLY = 150000000;

    constructor() ERC20("Nested Token", "NEST") {
        _mint(msg.sender, INITIAL_SUPPLY * 10**decimals());
    }
}
