// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.14;

import "./BeefyVaultStorage.sol";
import "./../../libraries/ExchangeHelpers.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title Beefy Single Vault Operator
/// @notice Deposit/Withdraw in a Beefy vault (native or non-native).
contract BeefyVaultOperator {
    BeefyVaultStorage public immutable operatorStorage;

    constructor(address[] memory vaults, address[] memory tokens) {
        uint256 vaultsLength = vaults.length;
        require(vaultsLength == tokens.length, "BVO: INVALID_VAULTS_LENGTH");
        operatorStorage = new BeefyVaultStorage();

        for (uint256 i; i < vaultsLength; i++) {
            operatorStorage.addVault(vaults[i], tokens[i]);
        }

        operatorStorage.transferOwnership(msg.sender);
    }

    /// @notice Deposit the asset in the Beefy vault and receive
    ///         the vault token (moo).
    /// @param vault The vault address to deposit into
    /// @param amount The token amount to deposit
    /// @param minVaultAmount The minimum vault token amount expected
    /// @return amounts Array of amounts :
    ///         - [0] : The vault token received amount
    ///         - [1] : The token deposited amount
    /// @return tokens Array of token addresses
    ///         - [0] : The vault token received address
    ///         - [1] : The token deposited address
    function deposit(
        address vault,
        uint256 amount,
        uint256 minVaultAmount
    ) external payable returns (uint256[] memory amounts, address[] memory tokens) {
        require(amount != 0, "BVO: INVALID_AMOUNT");
        IERC20 token = IERC20(operatorStorage.vaults(vault));
        require(address(token) != address(0), "BVO: INVALID_VAULT");

        uint256 vaultBalanceBefore = IERC20(vault).balanceOf(address(this));
        uint256 tokenBalanceBefore = token.balanceOf(address(this));

        ExchangeHelpers.setMaxAllowance(token, vault);
        (bool success, ) = vault.call(abi.encodeWithSignature("deposit(uint256)", amount));
        require(success, "BVO: DEPOSIT_CALL_FAILED");

        uint256 vaultAmount = IERC20(vault).balanceOf(address(this)) - vaultBalanceBefore;
        uint256 tokenAmount = tokenBalanceBefore - token.balanceOf(address(this));
        require(vaultAmount != 0 && vaultAmount >= minVaultAmount, "BVO: INVALID_AMOUNT_RECEIVED");
        require(amount == tokenAmount, "BVO: INVALID_AMOUNT_DEPOSITED");

        amounts = new uint256[](2);
        tokens = new address[](2);

        // Output amounts
        amounts[0] = vaultAmount;
        amounts[1] = tokenAmount;

        // Output token
        tokens[0] = vault;
        tokens[1] = address(token);
    }

    /// @notice Withdraw the vault token (moo) from Beefy and receive
    ///         the underlying token.
    /// @param vault The vault address to withdraw from
    /// @param amount The vault token amount to withdraw
    /// @return amounts Array of amounts :
    ///         - [0] : The token received amount
    ///         - [1] : The vault token deposited amount
    /// @return tokens Array of token addresses
    ///         - [0] : The token received address
    ///         - [1] : The vault token deposited address
    function withdraw(address vault, uint256 amount)
        external
        returns (uint256[] memory amounts, address[] memory tokens)
    {
        require(amount != 0, "BVO: INVALID_AMOUNT");
        IERC20 token = IERC20(operatorStorage.vaults(vault));
        require(address(token) != address(0), "BVO: INVALID_VAULT");

        uint256 tokenBalanceBefore = token.balanceOf(address(this));
        uint256 vaultBalanceBefore = IERC20(vault).balanceOf(address(this));

        (bool success, ) = vault.call(abi.encodeWithSignature("withdraw(uint256)", amount));
        require(success, "BVO: WITHDRAW_CALL_FAILED");

        uint256 tokenAmount = token.balanceOf(address(this)) - tokenBalanceBefore;
        uint256 vaultAmount = vaultBalanceBefore - IERC20(vault).balanceOf(address(this));
        require(vaultAmount == amount, "BVO: INVALID_AMOUNT_WITHDRAWED");
        require(tokenAmount != 0, "BVO: INVALID_AMOUNT");

        amounts = new uint256[](2);
        tokens = new address[](2);

        // Output amounts
        amounts[0] = tokenAmount;
        amounts[1] = amount;

        // Output token
        tokens[0] = address(token);
        tokens[1] = vault;
    }
}
