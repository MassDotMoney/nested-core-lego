// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.11;

import "@openzeppelin/contracts/access/Ownable.sol";

struct CurvePool {
    address poolAddress;
    uint96 poolCoinAmount;
    address lpToken;
}

/// @title YearnVaultStorage storage contract
contract YearnVaultStorage is Ownable {
    /// @dev Emitted when a vault is added
    /// @param vault The vault address
    /// @param pool The underlying CurvePool
    event VaultAdded(address vault, CurvePool pool);

    /// @dev Emitted when a vault is removed
    /// @param vault The removed vault address
    event VaultRemoved(address vault);

    /// @dev Map of vault address with underlying CurvePool
    mapping(address => CurvePool) public vaults;

    /// @notice Add a Yearn Curve vault
    /// @param vault The vault address
    /// @param pool The underlying CurvePool (used to add liquidity)
    function addVault(address vault, CurvePool calldata pool) external onlyOwner {
        require(vault != address(0), "YVS: INVALID_VAULT_ADDRESS");
        require(pool.poolAddress != address(0), "YVS: INVALID_POOL_ADDRESS");
        require(vaults[vault].poolAddress == address(0), "YVS: ALREADY_EXISTENT_VAULT");
        vaults[vault] = pool;
        emit VaultAdded(vault, pool);
    }

    /// @notice Remove a Yearn vault
    /// @param vault The vault address to remove
    function removeVault(address vault) external onlyOwner {
        require(vaults[vault].poolAddress != address(0), "YVS: NON_EXISTENT_VAULT");
        delete vaults[vault];
        emit VaultRemoved(vault);
    }
}
