// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import "./ZeroExStorage.sol";
import "../../libraries/ExchangeHelpers.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Create2.sol";
import "./IZeroExOperator.sol";

/// @notice The 0x protocol operator to execute swap with the aggregator
contract ZeroExOperator is IZeroExOperator {

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
    ) external override returns (uint256[] memory amounts) {
        amounts = new uint[](1);
        address swapTarget = ZeroExStorage(storageAddress(own)).swapTarget();
        uint256 balanceBeforePurchase = buyToken.balanceOf(address(this));
        bool success = ExchangeHelpers.fillQuote(sellToken, swapTarget, swapCallData);
        require(success, "SWAP_CALL_FAILED");

        uint256 amountBought = buyToken.balanceOf(address(this)) - balanceBeforePurchase;
        assert(amountBought > 0);
        amounts[0] = amountBought;
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
}
