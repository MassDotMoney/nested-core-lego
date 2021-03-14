//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.0;

import "hardhat/console.sol";

contract NestedFactory {
  address public feeTo;
  address public feeToSetter;

  constructor(address _feeToSetter) {
    feeToSetter = _feeToSetter;
    console.log("Deploying the Nested Factory: ", address(this));
  }

  function setFeeTo(address _feeTo) external {
    require(msg.sender == feeToSetter, 'Nested: FORBIDDEN');
    feeTo = _feeTo;
  }

  function setFeeToSetter(address _feeToSetter) external {
      require(msg.sender == feeToSetter, 'Nested: FORBIDDEN');
      feeToSetter = _feeToSetter;
    }
}
