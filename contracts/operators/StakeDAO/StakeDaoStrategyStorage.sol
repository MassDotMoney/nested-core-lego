// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.11;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @dev A Curve pool with its number of coins
/// @param poolAddress The address of the curve pool
/// @param poolCoinAmount The number of coins inside
/// @param lpToken The corresponding pool LP token address
struct CurvePool {
    address poolAddress;
    uint96 poolCoinAmount;
    address lpToken;
}

/// @title StakeDAO strategy operator's storage contract
contract StakeDaoStrategyStorage is Ownable {
    /// @dev Emitted when a strategy is added
    /// @param strategy The strategy address
    /// @param pool The underlying CurvePool
    event StrategyAdded(address strategy, CurvePool pool);

    /// @dev Emitted when a strategy is removed
    /// @param strategy The removed strategy address
    event StrategyRemoved(address strategy);

    /// @dev Map of strategy address with underlying CurvePool
    mapping(address => CurvePool) public strategies;

    /// @notice Add a StakeDAO strategy
    /// @param strategy The strategy address
    /// @param curvePool The underlying CurvePool (used to deposit)
    function addStrategy(address strategy, CurvePool calldata curvePool) external onlyOwner {
        require(strategy != address(0), "SDSS: INVALID_STRATEGY_ADDRESS");
        require(curvePool.poolAddress != address(0), "SDSS: INVALID_POOL_ADDRESS");
        require(curvePool.lpToken != address(0), "SDSS: INVALID_TOKEN_ADDRESS");
        require(strategies[strategy].poolAddress == address(0), "SDSS: STRATEGY_ALREADY_HAS_POOL");
        require(strategies[strategy].lpToken == address(0), "SDSS: STRATEGY_ALREADY_HAS_LP");
        strategies[strategy] = curvePool;
        emit StrategyAdded(strategy, curvePool);
    }

    /// @notice Remove a StakeDAO strategy
    /// @param strategy The strategy address to remove
    function removeStrategy(address strategy) external onlyOwner {
        require(strategies[strategy].poolAddress != address(0), "SDSS: NON_EXISTENT_STRATEGY");
        delete strategies[strategy];
        emit StrategyRemoved(strategy);
    }
}
