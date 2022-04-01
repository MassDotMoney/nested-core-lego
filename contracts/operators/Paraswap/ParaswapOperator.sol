// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.11;

import "./IParaswapOperator.sol";
import "../../libraries/ExchangeHelpers.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title The paraswap operator to execute swap with the aggregator
/// @dev see documentation => https://developers.paraswap.network/smart-contracts
contract ParaswapOperator is IParaswapOperator {
    address public constant TOKEN_TRANSFER_PROXY = 0x216B4B4Ba9F3e719726886d34a177484278Bfcae;
    address public constant AUGUSTUS_SWAPPER = 0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57;

    /// @dev No storage
    constructor() {}

    /// @inheritdoc IParaswapOperator
    function performSwap(
        IERC20 sellToken,
        IERC20 buyToken,
        bytes calldata swapCallData
    ) external payable override returns (uint256[] memory amounts, address[] memory tokens) {
        require(sellToken != buyToken, "PSO: SAME_INPUT_OUTPUT");
        amounts = new uint256[](2);
        tokens = new address[](2);
        uint256 buyBalanceBeforePurchase = buyToken.balanceOf(address(this));
        uint256 sellBalanceBeforePurchase = sellToken.balanceOf(address(this));

        ExchangeHelpers.setMaxAllowance(sellToken, TOKEN_TRANSFER_PROXY);
        (bool success, ) = AUGUSTUS_SWAPPER.call(swapCallData);
        require(success, "PSO: SWAP_FAILED");

        uint256 amountBought = buyToken.balanceOf(address(this)) - buyBalanceBeforePurchase;
        uint256 amountSold = sellBalanceBeforePurchase - sellToken.balanceOf(address(this));
        require(amountBought != 0, "PSO: INVALID_AMOUNT_BOUGHT");
        require(amountSold != 0, "PSO: INVALID_AMOUNT_SOLD");

        // Output amounts
        amounts[0] = amountBought;
        amounts[1] = amountSold;
        // Output token
        tokens[0] = address(buyToken);
        tokens[1] = address(sellToken);
    }
}
