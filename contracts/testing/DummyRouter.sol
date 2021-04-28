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
        address _inputToken,
        uint256 _amount,
        address payable _to
    ) public {
        IERC20(_inputToken).transferFrom(msg.sender, address(this), _amount);
        token.transfer(_to, _amount);
    }
}
