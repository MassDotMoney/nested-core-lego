//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.3;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "hardhat/console.sol";

contract DummyRouter {
    // send ETH, get the token
    function dummyswapETH(IERC20 token) public payable {
        // send 1ETH, you get 10 dummy tokens
        token.transfer(msg.sender, msg.value * 10);
    }

    // send a token, get the token
    function dummyswapToken(
        IERC20 _inputToken,
        IERC20 _outputToken,
        uint256 _amount
    ) public returns (bool, bytes memory) {
        IERC20(_inputToken).transferFrom(msg.sender, address(this), _amount);
        _outputToken.transfer(msg.sender, _amount);
        return (true, "");
    }
}
