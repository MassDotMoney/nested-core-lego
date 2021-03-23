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

    
}
