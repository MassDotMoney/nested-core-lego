// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.11;

import "./../interfaces/external/ICurvePool/ICurvePool.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @notice Library for Yearn Curve deposit/withdraw
library CurveHelpers {
    using SafeERC20 for IERC20;

    /// @dev Get the array of token amount to send to a
    ///      Curve 2pool to add liquidity
    /// @param pool The curve 2pool
    /// @param token The token to remove from the pool
    /// @param amount The amount of token to remove from the pool
    /// @return Array of 2 token amounts sorted by Curve pool token indexes
    function getAmounts2Coins(
        ICurvePool pool,
        address token,
        uint256 amount
    ) internal view returns (uint256[2] memory) {
        if (token == pool.coins(0)) {
            return [amount, 0];
        } else {
            require(token == pool.coins(1), "CH: INVALID_INPUT_TOKEN");
            return [0, amount];
        }
    }

    /// @dev Get the array of token amount to send to a
    ///      Curve 3pool to add liquidity
    /// @param pool The curve 3pool
    /// @param token The token to remove from the pool
    /// @param amount The amount of token to remove from the pool
    /// @return Array of 3 token amounts sorted by Curve pool token indexes
    function getAmounts3Coins(
        ICurvePool pool,
        address token,
        uint256 amount
    ) internal view returns (uint256[3] memory) {
        if (token == pool.coins(0)) {
            return [amount, 0, 0];
        } else if (token == pool.coins(1)) {
            return [0, amount, 0];
        } else {
            require(token == pool.coins(2), "CH: INVALID_INPUT_TOKEN");
            return [0, 0, amount];
        }
    }

    /// @dev Get the array of token amount to send to a
    ///      Curve 4pool to add liquidity
    /// @param pool The curve 4pool
    /// @param token The token to remove from the pool
    /// @param amount The amount of token to remove from the pool
    /// @return Array of 4 token amounts sorted by Curve pool token indexes
    function getAmounts4Coins(
        ICurvePool pool,
        address token,
        uint256 amount
    ) internal view returns (uint256[4] memory) {
        if (token == pool.coins(0)) {
            return [amount, 0, 0, 0];
        } else if (token == pool.coins(1)) {
            return [0, amount, 0, 0];
        } else if (token == pool.coins(2)) {
            return [0, 0, amount, 0];
        } else {
            require(token == pool.coins(3), "YCH: INVALID_INPUT_TOKEN");
            return [0, 0, 0, amount];
        }
    }

    /// @dev Remove liquidity from a Curve pool
    /// @param pool The Curve pool to remove liquidity from
    /// @param amount The Curve pool LP token to withdraw
    /// @param outputToken One of the Curve pool token
    /// @param poolCoinAmount The amount of token in the Curve pool
    /// @param signature The signature of the remove_liquidity_one_coin
    ///                  function to be used to call to the Curve pool
    function removeLiquidityOneCoin(
        ICurvePool pool,
        uint256 amount,
        address outputToken,
        uint256 poolCoinAmount,
        string memory signature
    ) internal {
        bool success;
        if (poolCoinAmount == 2) {
            // Curve 2pool
            if (outputToken == pool.coins(0)) {
                (success, ) = address(pool).call(abi.encodeWithSignature(signature, amount, 0, 0));
            } else {
                require(outputToken == pool.coins(1), "CH: INVALID_OUTPUT_TOKEN");
                (success, ) = address(pool).call(abi.encodeWithSignature(signature, amount, 1, 0));
            }
        } else if (poolCoinAmount == 3) {
            // Curve 3pool
            if (outputToken == pool.coins(0)) {
                (success, ) = address(pool).call(abi.encodeWithSignature(signature, amount, 0, 0));
            } else if (outputToken == pool.coins(1)) {
                (success, ) = address(pool).call(abi.encodeWithSignature(signature, amount, 1, 0));
            } else {
                require(outputToken == pool.coins(2), "CH: INVALID_OUTPUT_TOKEN");
                (success, ) = address(pool).call(abi.encodeWithSignature(signature, amount, 2, 0));
            }
        } else {
            // Curve 4pool
            if (outputToken == pool.coins(0)) {
                (success, ) = address(pool).call(abi.encodeWithSignature(signature, amount, 0, 0));
            } else if (outputToken == pool.coins(1)) {
                (success, ) = address(pool).call(abi.encodeWithSignature(signature, amount, 1, 0));
            } else if (outputToken == pool.coins(2)) {
                (success, ) = address(pool).call(abi.encodeWithSignature(signature, amount, 2, 0));
            } else {
                require(outputToken == pool.coins(3), "CH: INVALID_OUTPUT_TOKEN");
                (success, ) = address(pool).call(abi.encodeWithSignature(signature, amount, 3, 0));
            }
        }
    }

    /// @dev Get the arrays of obtained token and spent token
    /// @param inputToken The token spent
    /// @param inputTokenBalanceBefore The input token balance before
    /// @param expectedInputAmount The expected amount of input token spent
    /// @param outputToken The token obtained
    /// @param outputTokenBalanceBefore The output token balance before
    /// @param minAmountOut The minimum of output token expected
    function getOutputAmounts(
        IERC20 inputToken,
        uint256 inputTokenBalanceBefore,
        uint256 expectedInputAmount,
        IERC20 outputToken,
        uint256 outputTokenBalanceBefore,
        uint256 minAmountOut
    ) internal view returns (uint256[] memory amounts, address[] memory tokens) {
        require(
            inputTokenBalanceBefore - inputToken.balanceOf(address(this)) == expectedInputAmount,
            "CH: INVALID_AMOUNT_WITHDRAWED"
        );

        uint256 tokenAmount = outputToken.balanceOf(address(this)) - outputTokenBalanceBefore;
        require(tokenAmount != 0, "CH: INVALID_AMOUNT_RECEIVED");
        require(tokenAmount >= minAmountOut, "CH: INVALID_AMOUNT_RECEIVED");

        amounts = new uint256[](2);
        tokens = new address[](2);

        // Output amounts
        amounts[0] = tokenAmount;
        amounts[1] = expectedInputAmount;

        // Output token
        tokens[0] = address(outputToken);
        tokens[1] = address(inputToken);
    }
}
