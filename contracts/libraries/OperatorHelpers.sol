// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.14;

import "./../interfaces/external/ICurvePool/ICurvePool.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @notice Library for all operators
library OperatorHelpers {
    using SafeERC20 for IERC20;

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
            "OH: INVALID_AMOUNT_WITHDRAWED"
        );

        uint256 tokenAmount = outputToken.balanceOf(address(this)) - outputTokenBalanceBefore;
        require(tokenAmount != 0, "OH: INVALID_AMOUNT_RECEIVED");
        require(tokenAmount >= minAmountOut, "OH: INVALID_AMOUNT_RECEIVED");

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
