//SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Ownable contract for operators using Diamond Storage
contract OwnableOperator is Ownable {
    function requireIsOwner() external view onlyOwner returns (bool) {
        return true;
    }

    function isOwner() external view returns (bool) {
        return owner() == _msgSender();
    }
}
