// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.14;

import "./IParaswapOperator.sol";
import "../../libraries/ExchangeHelpers.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title The paraswap operator to execute swap with the aggregator
/// @dev see documentation => https://developers.paraswap.network/smart-contracts
contract ParaswapOperator is IParaswapOperator {
    address public immutable tokenTransferProxy;
    address public immutable augustusSwapper;

    /// @dev No storage, only immutable
    constructor(address _tokenTransferProxy, address _augustusSwapper) {
        require(_tokenTransferProxy != address(0) && _augustusSwapper != address(0), "PSO: INVALID_ADDRESS");
        tokenTransferProxy = _tokenTransferProxy;
        augustusSwapper = _augustusSwapper;
    }

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

        ExchangeHelpers.setMaxAllowance(sellToken, tokenTransferProxy);
        (bool success, ) = augustusSwapper.call(swapCallData);
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
