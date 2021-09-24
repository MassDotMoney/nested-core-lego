// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Create2.sol";
import "./IZeroExOperator.sol";
import "./ZeroExStorage.sol";
import "../../libraries/ExchangeHelpers.sol";
import "../../interfaces/IOperatorSelector.sol";

/// @title The 0x protocol operator to execute swap with the aggregator
contract ZeroExOperator is IZeroExOperator, IOperatorSelector {

    /// @dev Deploy with the swapTarget to store in storage contract
    constructor(address swapTarget) {
        address zeroxExStorage = Create2.deploy(0, bytes32("nested.zeroex.operator"), type(ZeroExStorage).creationCode);
        ZeroExStorage(zeroxExStorage).updatesSwapTarget(swapTarget);
        ZeroExStorage(zeroxExStorage).transferOwnership(msg.sender);
    }

    /// @inheritdoc IZeroExOperator
    function commitAndRevert(
        address own,
        IERC20 sellToken,
        IERC20 buyToken,
        bytes calldata swapCallData
    ) external override returns (uint256[] memory amounts, address[] memory tokens) {
        amounts = new uint[](1);
        tokens = new address[](1);
        address swapTarget = ZeroExStorage(storageAddress(own)).swapTarget();
        uint256 balanceBeforePurchase = buyToken.balanceOf(address(this));

        bool success = ExchangeHelpers.fillQuote(sellToken, swapTarget, swapCallData);
        require(success, "ZeroExOperator::commitAndRevert: 0x swap failed");

        uint256 amountBought = buyToken.balanceOf(address(this)) - balanceBeforePurchase;
        assert(amountBought > 0);
        amounts[0] = amountBought; // Output amount
        tokens[0] = address(buyToken); // Output token
    }

    /// @notice Return the operator storage address
    /// @param own the operator address to build the storage address in delegatecall
    function storageAddress(address own) public view returns (address) {
        bytes32 _data =
        keccak256(
            abi.encodePacked(bytes1(0xff), own, bytes32("nested.zeroex.operator"), keccak256(type(ZeroExStorage).creationCode))
        );
        return address(uint160(uint256(_data)));
    }

    /// @inheritdoc IOperatorSelector
    function getCommitSelector() external pure override returns (bytes4) {
        return this.commitAndRevert.selector;
    }

    /// @inheritdoc IOperatorSelector
    function getRevertSelector() external pure override returns (bytes4) {
        return this.commitAndRevert.selector;
    }
}
