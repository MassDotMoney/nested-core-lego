//SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

/// @title Operator Interface
interface IOperator {
    /// @notice Represents an order made through the nested protocol
    /// @param token The token resulting from the order
    /// @param amount The output amount received from the order
    /// @param operator The operator used to create the position
    struct Position {
        address token;
        uint256 amount;
        bytes32 operator;
    }

    /// @notice Create/increase a position with a minimum amount of output tokens
    /// @param tokenIn Input token address
    /// @param amountIn The amount of input tokens to send
    /// @param tokenOut Output token address
    /// @param amountOutMin The minimum amount of output tokens to receive
    /// @return The input token amount and all subsequent output token amounts.
    function commitIn(address tokenIn, uint256 amountIn, address tokenOut, uint256 amountOutMin) external returns (uint256[] memory amounts);

    /// @notice Create/increase a position with a minimum amount of input tokens
    /// @param tokenIn Input token address
    /// @param amountInMax The maximum amount of input tokens that can be required before the transaction reverts.
    /// @param tokenOut Output token address
    /// @param amountOutMin The amount of output tokens to receive
    /// @return The input token amount and all subsequent output token amounts.
    function commitOut(address tokenIn, uint256 amountInMax, address tokenOut, uint256 amountOut) external returns (uint256[] memory amounts);

    /// @notice Remove/decrease a position with a minimum amount of output tokens
    /// @param tokenIn Input token address
    /// @param amountIn The amount of input tokens to send
    /// @param tokenOut Output token address
    /// @param amountOutMin The minimum amount of output tokens to receive
    /// @return The input token amount and all subsequent output token amounts.
    function revertIn(address tokenIn, uint256 amountIn, address tokenOut, uint256 amountOutMin) external returns (uint256[] memory amounts);

    /// @notice Remove/decrease a position with a minimum amount of output tokens
    /// @param tokenIn Input token address
    /// @param amountIn The amount of input tokens to send
    /// @param tokenOut Output token address
    /// @param amountOutMin The minimum amount of output tokens to receive
    /// @return The input token amount and all subsequent output token amounts.
    function revertOut(address tokenIn, uint256 amountInMax, address tokenOut, uint256 amountOut) external returns (uint256[] memory amounts);

    /// @notice Get the current outcome for a specific output token (for an address)
    /// @param tokenOut The output token
    /// @param user The user
    /// @return the amount of output token
    function outcome(address tokenOut, address user) external view returns (uint256 amountOut);
}
