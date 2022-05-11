// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.11;

import "@openzeppelin/contracts/access/Ownable.sol";

import "hardhat/console.sol";

/// @title StakeDAO strategy operator's storage contract
contract StakeDaoStrategyStorage is Ownable {
    /// @dev Emitted when a strategy is added
    /// @param strategy The strategy address
    /// @param pool The underlying pool address
    event StrategyAdded(address strategy, address pool);

    /// @dev Emitted when a strategy is removed
    /// @param strategy The removed strategy address
    event StrategyRemoved(address strategy);

    /// @dev Map of strategy address with underlying pool address
    mapping(address => address) public strategies;

    /// @notice Add a StakeDAO strategy
    /// @param strategy The strategy address
    /// @param pool The underlying pool address (used to deposit)
    function addStrategy(address strategy, address pool) external onlyOwner {
        require(strategy != address(0), "SDSS: INVALID_STRATEGY_ADDRESS");
        require(pool != address(0), "SDSS: INVALID_POOL_ADDRESS");
        require(strategies[strategy] == address(0), "SDSS: ALREADY_EXISTENT_STRATEGY");
        strategies[strategy] = pool;
        emit StrategyAdded(strategy, pool);
    }

    /// @notice Remove a StakeDAO strategy
    /// @param strategy The strategy address to remove
    function removeStrategy(address strategy) external onlyOwner {
        require(strategies[strategy] != address(0), "SDSS: NON_EXISTENT_STRATEGY");
        delete strategies[strategy];
        emit StrategyRemoved(strategy);
    }
}
