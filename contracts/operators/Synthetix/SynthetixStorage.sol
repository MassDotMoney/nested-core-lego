// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "synthetix/contracts/interfaces/IAddressResolver.sol";

/// @title Synthetix trading storage contract
contract SynthetixStorage is Ownable {
    IAddressResolver private _synthetixResolver;

    /// @notice Returns the address of the Synthetix address resolver
    function synthetixResolver() external view returns (IAddressResolver) {
        return _synthetixResolver;
    }

    /// @notice Update the address of the Synthetix address resolver
    function updateSynthetixResolver(IAddressResolver _synthetixResolverValue) external onlyOwner {
        _synthetixResolver = _synthetixResolverValue;
    }
}
