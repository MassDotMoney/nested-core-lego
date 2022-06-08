// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.14;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title Paraswap Operator Interface
interface IParaswapOperator {
    /// @notice Execute a swap via Paraswap
    /// @param sellToken The token sold
    /// @param buyToken The token bought
    /// @param swapCallData Paraswap calldata from the API
    /// @return amounts Array of output amounts
    /// @return tokens Array of output tokens
    function performSwap(
        IERC20 sellToken,
        IERC20 buyToken,
        bytes calldata swapCallData
    ) external payable returns (uint256[] memory amounts, address[] memory tokens);
}
