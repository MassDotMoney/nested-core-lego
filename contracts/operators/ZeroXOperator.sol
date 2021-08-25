//SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import "../interfaces/IOperator.sol";

/// @notice The 0x protocol operator to execute swap with this aggregator
contract ZeroXProtocol is IOperator {
    bytes32 constant DATA_POSITION = keccak256("nested.operator.zerox.data");

    /// @notice the 0x operator data
    /// @param swapTarget The 0x contract address to perform swaps
    struct ZeroXData {
        address swapTarget;
    }

    /// @inheritdoc IOperator
    function commitIn(
        address tokenIn,
        uint256 amountIn,
        address tokenOut,
        uint256 amountOutMin
    ) external override returns (uint256[] memory amounts) {
        return 0; // TODO
    }

    /// @inheritdoc IOperator
    function commitOut(
        address tokenIn,
        uint256 amountInMax,
        address tokenOut,
        uint256 amountOut
    ) external override returns (uint256[] memory amounts) {
        return 0; // TODO
    }

    /// @inheritdoc IOperator
    function revertIn(
        address tokenIn,
        uint256 amountIn,
        address tokenOut,
        uint256 amountOutMin
    ) external override returns (uint256[] memory amounts) {
        return 0; // TODO
    }

    /// @inheritdoc IOperator
    function revertOut(
        address tokenIn,
        uint256 amountInMax,
        address tokenOut,
        uint256 amountOut
    ) external override returns (uint256[] memory amounts) {
        return 0; // TODO
    }

    /// @inheritdoc IOperator
    function outcome(address tokenOut, address user) external view override returns (uint256 amountOut) {
        return 0; // TODO
    }

    /// @notice Get back the operator datas (diamond storage)
    /// @return data The ZeroXData struct
    function operatorStorage() internal pure returns (ZeroXData storage data) {
        bytes32 position = DATA_POSITION;
        assembly {
            data.slot := position
        }
    }
}
