//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.3;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "hardhat/console.sol";

contract DummyRouter {
    IERC20 public token;

    constructor(IERC20 _token) {
        token = _token;
    }

    // send ETH, get the token
    function dummyswapETH() public payable {
        // send 1ETH, you get 10 dummy tokens
        token.transfer(msg.sender, msg.value * 10);
    }

    // send a token, get the token
    function dummyswapToken(
        address inputToken,
        uint256 amount,
        address payable to
    ) public {
        IERC20(inputToken).transferFrom(msg.sender, address(this), amount);
        token.transfer(to, amount);
    }
}
