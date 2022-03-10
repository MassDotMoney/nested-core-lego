// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.11;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title BeefyVaultOperator storage contract
contract BeefyVaultStorage is Ownable {
    /// @dev Emitted when a vault is added
    /// @param vault The vault address
    /// @param token The underlying token address
    event VaultAdded(address vault, address token);

    /// @dev Emitted when a vault is removed
    /// @param vault The removed vault address
    event VaultRemoved(address vault);

    /// @dev Map of vault address with underlying token address
    mapping(address => address) public vaults;

    /// @notice Add a beefy single asset vault
    /// @param vault The vault address
    /// @param token The underlying token address (used to deposit)
    function addVault(address vault, address token) external onlyOwner {
        require(vault != address(0), "BVS: INVALID_VAULT_ADDRESS");
        require(token != address(0), "BVS: INVALID_TOKEN_ADDRESS");
        vaults[vault] = token;
        emit VaultAdded(vault, token);
    }

    /// @notice Remove a beefy vault
    /// @param vault The vault address to remove
    function removeVault(address vault) external onlyOwner {
        require(vaults[vault] != address(0), "BVS: NON_EXISTENT_VAULT");
        delete vaults[vault];
        emit VaultRemoved(vault);
    }
}
