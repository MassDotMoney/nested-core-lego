// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.14;

import "../interfaces/external/IWalletFactory.sol";

contract WalletFactoryMock is  IWalletFactory {

    function createAndCallTxOrigin(bytes32, bytes calldata)
        external
        payable
        returns (address nestedWallet, bytes memory data) {
            return (0x1231231231231231231231231231231231231231, bytes(""));
        }

    function computePredictedAddressWallet(bytes32, address) external view returns (address) {
        return 0x1231231231231231231231231231231231231231;
    }
}
