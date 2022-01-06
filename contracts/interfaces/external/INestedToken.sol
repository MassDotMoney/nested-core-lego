//SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.11;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface INestedToken is IERC20 {
    function burn(uint256 amount) external;
}
