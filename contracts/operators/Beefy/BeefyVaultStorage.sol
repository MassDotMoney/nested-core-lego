// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.14;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title BeefyVaultOperator storage contract
contract BeefyVaultStorage is Ownable {
    /// @dev Emitted when a vault is added
    /// @param vault The vault address
    /// @param tokenOrZapper The underlying token address or zapper
    event VaultAdded(address vault, address tokenOrZapper);

    /// @dev Emitted when a vault is removed
    /// @param vault The removed vault address
    event VaultRemoved(address vault);

    /// @dev Map of vault address with underlying token address or zapper
    mapping(address => address) public vaults;

    /// @notice Add a beefy single asset vault
    /// @param vault The vault address
    /// @param tokenOrZapper The underlying token address or zapper (used to deposit)
    function addVault(address vault, address tokenOrZapper) external onlyOwner {
        require(vault != address(0), "BVS: INVALID_VAULT_ADDRESS");
        require(tokenOrZapper != address(0), "BVS: INVALID_UNDERLYING_ADDRESS");
        require(vaults[vault] == address(0), "BVS: ALREADY_EXISTENT_VAULT");
        vaults[vault] = tokenOrZapper;
        emit VaultAdded(vault, tokenOrZapper);
    }

    /// @notice Remove a beefy vault
    /// @param vault The vault address to remove
    function removeVault(address vault) external onlyOwner {
        require(vaults[vault] != address(0), "BVS: NON_EXISTENT_VAULT");
        delete vaults[vault];
        emit VaultRemoved(vault);
    }
}
