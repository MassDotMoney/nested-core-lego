//SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.11;

/// @dev Yearn vault interface
interface IYearnVault {
    function deposit(uint256 _amount) external returns (uint256);

    function withdraw(
        uint256 _shares,
        address _recipient,
        uint256 _maxLoss
    ) external returns (uint256);
}
