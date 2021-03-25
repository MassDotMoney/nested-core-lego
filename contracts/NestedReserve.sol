pragma solidity ^0.7.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract NestedReserve {
    address public factory;

    modifier onlyFactory() {
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
    ) external onlyFactory() {
        require(token != address(0), "NestedReserve: invalid address");
        ERC20(token).transfer(recipient, amount);
    }
}
