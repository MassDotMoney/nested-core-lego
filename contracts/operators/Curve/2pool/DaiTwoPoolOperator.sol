// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.11;

import "./interfaces/Pool.sol";
import "./interfaces/Gauge.sol";
import "./DaiTwoPoolStorage.sol";
import "../../../libraries/ExchangeHelpers.sol";
import "../../../interfaces/IOperatorSelector.sol";
import "@openzeppelin/contracts/utils/Create2.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Deposit DAI to (Fantom) 2Pool DAI/USDC Curve pool and stake in gauge.      
contract DaiTwoPoolOperator is IOperatorSelector {
    bytes32 private constant salt = bytes32("nested.curve.2pool.ftm.operator");
    bytes32 private immutable storageCreationCode;

    address public constant pool = 0x27E611FD27b276ACbd5Ffd632E5eAEBEC9761E40;
    address public constant gauge = 0x8866414733F22295b7563f9C5299715D2D76CAf4;
    IERC20 public constant DAI = IERC20(0x8D11eC38a3EB5E956B052f67Da8Bdc9bef8Abf3E);
    
    /// @dev Deploy with the storage contract
    constructor() {
        bytes memory creationCodeBytes = type(DaiTwoPoolStorage).creationCode;
        storageCreationCode = keccak256(creationCodeBytes);
        address zeroxExStorage = Create2.deploy(0, salt, creationCodeBytes);
        DaiTwoPoolStorage(zeroxExStorage).transferOwnership(msg.sender);
    }

    function commit(address self, uint256 depositAmount, uint256 minMintAmount) external payable returns (uint256[] memory amounts, address[] memory tokens) {
        amounts = new uint256[](2);
        tokens = new address[](2);

        // Add Liquidity to Curve Pool
        ExchangeHelpers.setMaxAllowance(DAI, pool);

        // TODO

        // Output amounts
        amounts[0] = 0;
        amounts[1] = 0;
        // Output token
        tokens[0] = address(address(0));
        tokens[1] = address(address(0));
    }

    /// @inheritdoc IOperatorSelector
    function getCommitSelector() external pure override returns (bytes4) {
        return ""; // TODO
    }

    /// @inheritdoc IOperatorSelector
    function getRevertSelector() external pure override returns (bytes4) {
        return ""; // TODO
    }
}