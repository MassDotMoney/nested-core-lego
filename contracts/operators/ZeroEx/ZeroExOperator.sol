// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.11;

import "./IZeroExOperator.sol";
import "./ZeroExStorage.sol";
import "../../libraries/ExchangeHelpers.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title The 0x protocol operator to execute swap with the aggregator
contract ZeroExOperator is IZeroExOperator {
    ZeroExStorage public immutable operatorStorage;

    /// @dev Deploy with the storage contract
    constructor(address swapTarget) {
        operatorStorage = new ZeroExStorage();
        ZeroExStorage(operatorStorage).updatesSwapTarget(swapTarget);
        ZeroExStorage(operatorStorage).transferOwnership(msg.sender);
    }

    /// @inheritdoc IZeroExOperator
    function performSwap(
        IERC20 sellToken,
        IERC20 buyToken,
        bytes calldata swapCallData
    ) external payable override returns (uint256[] memory amounts, address[] memory tokens) {
        amounts = new uint256[](2);
        tokens = new address[](2);
        uint256 buyBalanceBeforePurchase = buyToken.balanceOf(address(this));
        uint256 sellBalanceBeforePurchase = sellToken.balanceOf(address(this));

        bool success = ExchangeHelpers.fillQuote(sellToken, operatorStorage.swapTarget(), swapCallData);
        require(success, "ZEO: SWAP_FAILED");

        uint256 amountBought = buyToken.balanceOf(address(this)) - buyBalanceBeforePurchase;
        uint256 amountSold = sellBalanceBeforePurchase - sellToken.balanceOf(address(this));
        require(amountBought != 0, "ZeroExOperator::performSwap: amountBought cant be zero");
        require(amountSold != 0, "ZeroExOperator::performSwap: amountSold cant be zero");

        // Output amounts
        amounts[0] = amountBought;
        amounts[1] = amountSold;
        // Output token
        tokens[0] = address(buyToken);
        tokens[1] = address(sellToken);
    }
}
