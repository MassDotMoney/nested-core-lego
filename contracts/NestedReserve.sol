//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.7.0;

//import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
// A partial ERC20 interface.
interface ERC20 {
    function allowance(address _owner, address _spender) external view returns (uint256 remaining);

    function transfer(address _to, uint256 _value) external returns (bool success);

    function balanceOf(address _owner) external view returns (uint256 balance);

    function transferFrom(
        address _from,
        address _to,
        uint256 _value
    ) external returns (bool success);

    function approve(address _spender, uint256 _value) external returns (bool success);
}

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
        ERC20(token).transfer(recipient, amount);
    }
}
