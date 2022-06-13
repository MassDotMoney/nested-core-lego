// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.14;

import "../../interfaces/INestedFactory.sol";
import "../../interfaces/external/ITransparentUpgradeableProxy.sol";

contract UpdateFees {
    /// @notice Update atomically the entryFees and exitFees
    /// @param nestedFactory The nestedFactory address
    /// @param entryFees The entry fees
    /// @param exitFees The exit fees
    /// @dev Called using delegatecall by the NestedFactory owner
    function updateFees(
        ITransparentUpgradeableProxy nestedFactory,
        uint256 entryFees,
        uint256 exitFees
    ) external {
        nestedFactory.upgradeToAndCall(
            nestedFactory.implementation(),
            abi.encodeWithSelector(INestedFactory.setEntryFees.selector, entryFees)
        );

        nestedFactory.upgradeToAndCall(
            nestedFactory.implementation(),
            abi.encodeWithSelector(INestedFactory.setExitFees.selector, exitFees)
        );
    }
}
