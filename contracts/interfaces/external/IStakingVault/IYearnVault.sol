// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.14;

import "./IStakingVault.sol";

/// @dev Yearn vault interface
interface IYearnVault is IStakingVault {
    function withdraw(
        uint256 _shares,
        address _recipient,
        uint256 _maxLoss
    ) external returns (uint256);
}
