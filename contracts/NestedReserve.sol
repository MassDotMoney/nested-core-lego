//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.3;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract NestedReserve {
    address public factory;

    modifier onlyFactory {
        require(msg.sender == factory, "You need to use the factory");
        _;
    }

    constructor() {
        factory = msg.sender;
    }

    function transfer(
        address recipient,
        address token,
        uint256 amount
    ) external onlyFactory {
        require(token != address(0), "NestedReserve: invalid address");
        IERC20(token).transfer(recipient, amount);
    }
}
