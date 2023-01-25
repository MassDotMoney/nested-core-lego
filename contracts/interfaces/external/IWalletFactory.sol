// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.14;

interface IWalletFactory {
    function createAndCallTxOrigin(bytes32 salt, bytes calldata call)
        external
        payable
        returns (address nestedWallet, bytes memory data);

    function computePredictedAddressWallet(bytes32 salt, address sender) external view returns (address);
}
