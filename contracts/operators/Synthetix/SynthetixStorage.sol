// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "synthetix/contracts/interfaces/IAddressResolver.sol";

/// @title Synthetix trading storage contract
contract SynthetixStorage is Ownable {
    IAddressResolver private _synthetixResolver;

    /// @dev Returns the address of the Synthetix address resolver
    function synthetixResolver() external view returns (IAddressResolver) {
        return _synthetixResolver;
    }

    /// @dev Update the address of the Synthetix address resolver
    function updatesSynthetixResolver(IAddressResolver _synthetixResolverValue) external onlyOwner {
        _synthetixResolver = _synthetixResolverValue;
    }
}
