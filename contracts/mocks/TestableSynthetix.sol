// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title Mock of Synthetix contract
contract TestableSynthetix {
    IERC20 private currency;

    function loadContext(IERC20 _currency) external {
        currency = _currency;
    }

    function exchange(
        bytes32 sourceCurrencyKey,
        uint256 sourceAmount,
        bytes32 destinationCurrencyKey
    ) external returns (uint256 amountReceived) {
        currency.transfer(msg.sender, sourceAmount);
        return sourceAmount;
    }

    function isWaitingPeriod(bytes32 currencyKey) external view returns (bool) {
        return false;
    }
}
