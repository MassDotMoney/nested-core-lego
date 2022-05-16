// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.11;

import "../../interfaces/INestedFactory.sol";

contract UpdateFees {
    /// @notice Update atomically the entryFees and exitFees
    /// @param nestedFactory The nestedFactory address
    /// @param entryFees The entry fees
    /// @param exitFees The exit fees
    /// @dev Called using delegatecall by the NestedFactory owner
    function updateFees(
        INestedFactory nestedFactory,
        uint256 entryFees,
        uint256 exitFees
    ) external {
        nestedFactory.setEntryFees(entryFees);
        nestedFactory.setExitFees(exitFees);
    }
}
