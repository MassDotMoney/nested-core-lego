// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.7.0;

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract NestedToken is ERC20 {
    uint256 public constant initialSupply = 150000000;

    constructor() ERC20("Nested Token", "NEST") {
        _mint(msg.sender, initialSupply * 10 ** decimals());
    }
}
