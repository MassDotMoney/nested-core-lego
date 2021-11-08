// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Create2.sol";
import "synthetix/contracts/interfaces/IAddressResolver.sol";
import "synthetix/contracts/interfaces/ISynthetix.sol";
import "./ISynthetixOperator.sol";
import "./SynthetixStorage.sol";
import "../../libraries/ExchangeHelpers.sol";
import "../../interfaces/IOperatorSelector.sol";

/// @title The synthetix trading operator to execute a swap
contract SynthetixOperator is ISynthetixOperator, IOperatorSelector {
    /// @dev Deploy with the storage contract
    constructor(IAddressResolver synthetixResolver) {
        address synthetixStorage = Create2.deploy(
            0,
            bytes32("nested.synthetix.operator"),
            type(SynthetixStorage).creationCode
        );
        SynthetixStorage(synthetixStorage).updateSynthetixResolver(synthetixResolver);
        SynthetixStorage(synthetixStorage).transferOwnership(msg.sender);
    }

    /// @inheritdoc ISynthetixOperator
    function commitAndRevert(
        address own,
        bytes32 sourceCurrencyKey,
        uint256 sourceAmount,
        bytes32 destinationCurrencyKey
    ) external override returns (uint256[] memory amounts, address[] memory tokens) {
        amounts = new uint256[](1);
        tokens = new address[](1);

        IAddressResolver addressResolver = IAddressResolver(SynthetixStorage(storageAddress(own)).synthetixResolver());
        ISynthetix synthetix = ISynthetix(addressResolver.getAddress("Synthetix"));

        require(
            address(synthetix) != address(0),
            "SynthetixOperator::commitAndRevert: Synthetix is missing from Synthetix resolver"
        );

        // This check is what synthetix.exchange() will perform, added here for explicitness
        require(
            !synthetix.isWaitingPeriod(sourceCurrencyKey),
            "SynthetixOperator::commitAndRevert: Cannot exchange during the waiting period"
        );

        // TODO approval ?

        // Exchange for msg.sender = address(MyContract)
        synthetix.exchange(sourceCurrencyKey, sourceAmount, destinationCurrencyKey);

        // TODO return tokens and amounts
        // TODO check amounts
    }

    /// @notice Return the operator storage address
    /// @param own the operator address to build the storage address in delegatecall
    function storageAddress(address own) public pure returns (address) {
        bytes32 _data = keccak256(
            abi.encodePacked(
                bytes1(0xff),
                own,
                bytes32("nested.synthetix.operator"),
                keccak256(type(SynthetixStorage).creationCode)
            )
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
