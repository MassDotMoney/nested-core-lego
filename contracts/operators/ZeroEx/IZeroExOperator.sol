// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title ZeroEx Operator Interface
interface IZeroExOperator {
    /// @notice Execute a swap via 0x
    /// @param own The operator address (for delegatecall context resolution)
    /// @param sellToken The token sold
    /// @param buyToken The token bought
    /// @param swapCallData 0x calldata from the API
    /// @return amounts Array of output amounts
    /// @return tokens Array of output tokens
    function commitAndRevert(
        address own,
        IERC20 sellToken,
        IERC20 buyToken,
        bytes calldata swapCallData
    ) external returns (uint256[] memory amounts, address[] memory tokens);
}
