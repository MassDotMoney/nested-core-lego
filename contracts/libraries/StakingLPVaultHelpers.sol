// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.11;

import "./../Withdrawer.sol";
import "../libraries/CurveHelpers.sol";
import "./../libraries/ExchangeHelpers.sol";
import "../interfaces/external/IStakeDaoStrategy.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./../interfaces/external/ICurvePool/ICurvePool.sol";
import "./../interfaces/external/ICurvePool/ICurvePool.sol";
import "./../interfaces/external/ICurvePool/ICurvePoolETH.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./../interfaces/external/ICurvePool/ICurvePoolNonETH.sol";

/// @notice Library for LP Staking Vaults deposit/withdraw
library StakingVaultHelpers {
    using SafeERC20 for IERC20;

    /// @dev  Add liquidity in a Curve pool with ETH and deposit
    ///       the LP token in a staking vault
    /// @param strategy The staking vault address to deposit into
    /// @param pool The Curve pool to add liquitiy in
    /// @param lpToken The Curve pool LP token
    /// @param poolCoinAmount The number of token in the Curve pool
    /// @param eth ETH address
    /// @param amount ETH amount to add in the Curve pool
    function _addLiquidityAndDepositETH(
        address strategy,
        ICurvePoolETH pool,
        IERC20 lpToken,
        uint256 poolCoinAmount,
        address eth,
        uint256 amount
    ) internal {
        uint256 lpTokenBalanceBefore = lpToken.balanceOf(address(this));

        if (poolCoinAmount == 2) {
            pool.add_liquidity{ value: amount }(CurveHelpers.getAmounts2Coins(pool, eth, amount), 0);
        } else if (poolCoinAmount == 3) {
            pool.add_liquidity{ value: amount }(CurveHelpers.getAmounts3Coins(pool, eth, amount), 0);
        } else {
            pool.add_liquidity{ value: amount }(CurveHelpers.getAmounts4Coins(pool, eth, amount), 0);
        }

        uint256 lpTokenToDeposit = lpToken.balanceOf(address(this)) - lpTokenBalanceBefore;
        ExchangeHelpers.setMaxAllowance(lpToken, strategy);
        IStakeDaoStrategy(strategy).deposit(lpTokenToDeposit);
    }

    /// @dev  Add liquidity in a Curve pool and deposit
    ///       the LP token in a staking vault
    /// @param strategy The staking vault address to deposit into
    /// @param pool The Curve pool to add liquitiy in
    /// @param lpToken The Curve pool lpToken
    /// @param poolCoinAmount The number of token in the Curve pool
    /// @param token Token to add in the Curve pool liquidity
    /// @param amount Token amount to add in the Curve pool
    function _addLiquidityAndDeposit(
        address strategy,
        ICurvePoolNonETH pool,
        IERC20 lpToken,
        uint256 poolCoinAmount,
        address token,
        uint256 amount
    ) internal {
        uint256 lpTokenBalanceBefore = lpToken.balanceOf(address(this));
        ExchangeHelpers.setMaxAllowance(IERC20(token), address(pool));

        if (poolCoinAmount == 2) {
            pool.add_liquidity(CurveHelpers.getAmounts2Coins(pool, token, amount), 0);
        } else if (poolCoinAmount == 3) {
            pool.add_liquidity(CurveHelpers.getAmounts3Coins(pool, token, amount), 0);
        } else {
            pool.add_liquidity(CurveHelpers.getAmounts4Coins(pool, token, amount), 0);
        }

        uint256 lpTokenToDeposit = lpToken.balanceOf(address(this)) - lpTokenBalanceBefore;
        ExchangeHelpers.setMaxAllowance(lpToken, strategy);
        IStakeDaoStrategy(strategy).deposit(lpTokenToDeposit);
    }
}
