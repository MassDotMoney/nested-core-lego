// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.11;

import "./../interfaces/external/ICurvePool/ICurvePool.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @notice Library for Curve deposit/withdraw
library CurveHelpers {
    using SafeERC20 for IERC20;

    /// @dev Get the array of token amount to send to a
    ///      Curve 2pool to add liquidity
    /// @param pool The curve 2pool
    /// @param token The token to remove from the pool
    /// @param amount The amount of token to remove from the pool
    /// @return amounts Array of 2 token amounts sorted by Curve pool token indexes
    function getAmounts2Coins(
        ICurvePool pool,
        address token,
        uint256 amount
    ) internal view returns (uint256[2] memory amounts) {
        for (uint256 i; i < 2; i++) {
            if (token == pool.coins(i)) {
                amounts[i] = amount;
                return amounts;
            }
        }
        revert("CH: INVALID_INPUT_TOKEN");
    }

    /// @dev Get the array of token amount to send to a
    ///      Curve 3pool to add liquidity
    /// @param pool The curve 3pool
    /// @param token The token to remove from the pool
    /// @param amount The amount of token to remove from the pool
    /// @return amounts Array of 3 token amounts sorted by Curve pool token indexes
    function getAmounts3Coins(
        ICurvePool pool,
        address token,
        uint256 amount
    ) internal view returns (uint256[3] memory amounts) {
        for (uint256 i; i < 3; i++) {
            if (token == pool.coins(i)) {
                amounts[i] = amount;
                return amounts;
            }
        }
        revert("CH: INVALID_INPUT_TOKEN");
    }

    /// @dev Get the array of token amount to send to a
    ///      Curve 4pool to add liquidity
    /// @param pool The curve 4pool
    /// @param token The token to remove from the pool
    /// @param amount The amount of token to remove from the pool
    /// @return amounts Array of 4 token amounts sorted by Curve pool token indexes
    function getAmounts4Coins(
        ICurvePool pool,
        address token,
        uint256 amount
    ) internal view returns (uint256[4] memory amounts) {
        for (uint256 i; i < 4; i++) {
            if (token == pool.coins(i)) {
                amounts[i] = amount;
                return amounts;
            }
        }
        revert("CH: INVALID_INPUT_TOKEN");
    }

    /// @dev Remove liquidity from a Curve pool
    /// @param pool The Curve pool to remove liquidity from
    /// @param amount The Curve pool LP token to withdraw
    /// @param outputToken One of the Curve pool token
    /// @param poolCoinAmount The amount of token in the Curve pool
    /// @param signature The signature of the remove_liquidity_one_coin
    ///                  function to be used to call to the Curve pool
    /// @return success If the call to remove liquidity succeeded
    function removeLiquidityOneCoin(
        ICurvePool pool,
        uint256 amount,
        address outputToken,
        uint256 poolCoinAmount,
        bytes4 signature
    ) internal returns (bool success) {
        for (uint256 i; i < poolCoinAmount; i++) {
            if (outputToken == pool.coins(i)) {
                (success, ) = address(pool).call(abi.encodeWithSelector(signature, amount, i, 0));
                return success;
            }
        }
        revert("CH: INVALID_OUTPUT_TOKEN");
    }
}
