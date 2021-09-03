// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import "../interfaces/IOperator.sol";
import "./OwnableOperator.sol";

/// @notice The 0x protocol operator to execute swap with the aggregator
contract ZeroExOperator is IOperator {
    bytes32 constant DATA_POSITION = keccak256("nested.operator.zeroex.data");

    /// @notice the 0x operator data
    /// @param swapTarget The 0x contract address to perform swaps
    struct ZeroExData {
        address swapTarget;
    }

    /// @inheritdoc IOperator
    function commitIn(
        address tokenIn,
        uint256 amountIn,
        address tokenOut,
        uint256 amountOutMin
    ) external override returns (uint256[] memory amounts) {}

    /// @inheritdoc IOperator
    function commitOut(
        address tokenIn,
        uint256 amountInMax,
        address tokenOut,
        uint256 amountOut
    ) external override returns (uint256[] memory amounts) {}

    /// @inheritdoc IOperator
    function revertIn(
        address tokenIn,
        uint256 amountIn,
        address tokenOut,
        uint256 amountOutMin
    ) external override returns (uint256[] memory amounts) {}

    /// @inheritdoc IOperator
    function revertOut(
        address tokenIn,
        uint256 amountInMax,
        address tokenOut,
        uint256 amountOut
    ) external override returns (uint256[] memory amounts) {}

    /// @inheritdoc IOperator
    function outcome(address tokenOut, address user) external view override returns (uint256 amountOut) {}

    /// @notice Get back the operator datas (diamond storage)
    /// @return data The ZeroXData struct
    function operatorStorage() internal pure returns (ZeroExData storage data) {
        bytes32 position = DATA_POSITION;
        assembly {
            data.slot := position
        }
    }
}
