// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.11;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./abstracts/OwnableFactoryHandler.sol";

/// @title Stores underlying assets of NestedNFTs.
/// @notice The factory itself can only trigger a transfer after verification that the user
///         holds funds present in this contract. Only the factory can withdraw/transfer assets.
contract NestedReserve is OwnableFactoryHandler {
    using SafeERC20 for IERC20;

    /// @notice Release funds to a recipient
    /// @param _recipient The receiver
    /// @param _token The token to transfer
    /// @param _amount The amount to transfer
    function transfer(
        address _recipient,
        IERC20 _token,
        uint256 _amount
    ) external onlyFactory {
        require(_recipient != address(0), "NRS: INVALID_ADDRESS");
        _token.safeTransfer(_recipient, _amount);
    }

    /// @notice Release funds to the factory
    /// @param _token The ERC20 to transfer
    /// @param _amount The amount to transfer
    function withdraw(IERC20 _token, uint256 _amount) external onlyFactory {
        _token.safeTransfer(msg.sender, _amount);
    }
}
