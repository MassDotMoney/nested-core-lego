// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.11;

import "./BeefyVaultStorage.sol";
import "./../../libraries/ExchangeHelpers.sol";
import "./../../interfaces/external/IBeefyZapUniswapV2.sol";

/// @title (Zapper) Beefy UniV2 LP Vault Operator.
/// @notice Deposit/Withdraw in a Beefy UniV2 LP vault using zapper
/// Note: "Zap" means that we are converting an asset for the LP Token by
///       swapping and adding liquidity.
contract BeefyZapLPVaultOperator {
    BeefyVaultStorage public immutable operatorStorage;

    constructor(address[] memory vaults, address[] memory zappers) {
        uint256 vaultsLength = vaults.length;
        require(vaultsLength == zappers.length, "BLVO: INVALID_VAULTS_LENGTH");

        operatorStorage = new BeefyVaultStorage();

        for (uint256 i; i < vaultsLength; i++) {
            operatorStorage.addVault(vaults[i], zappers[i]);
        }

        operatorStorage.transferOwnership(msg.sender);
    }

    /// @notice Zap one of the paired tokens for the LP Token, deposit the
    ///         asset in the Beefy vault and receive the vault token (moo).
    /// @param vault The vault address to deposit into
    /// @param token The token to zap
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
        IERC20 token,
        uint256 amount,
        uint256 minVaultAmount
    ) external payable returns (uint256[] memory amounts, address[] memory tokens) {
        require(amount != 0, "BLVO: INVALID_AMOUNT");
        address zapper = operatorStorage.vaults(vault);
        require(zapper != address(0), "BLVO: INVALID_VAULT");
        amounts = new uint256[](2);
        tokens = new address[](2);

        uint256 vaultBalanceBefore = IERC20(vault).balanceOf(address(this));
        uint256 tokenBalanceBefore = token.balanceOf(address(this));

        // Beefy Zapper will check if token is present in liquidity pair
        ExchangeHelpers.setMaxAllowance(token, zapper);
        IBeefyZapUniswapV2(zapper).beefIn(vault, 0, address(token), amount);

        uint256 vaultAmount = IERC20(vault).balanceOf(address(this)) - vaultBalanceBefore;
        uint256 tokenAmount = tokenBalanceBefore - token.balanceOf(address(this));
        require(vaultAmount != 0 && vaultAmount >= minVaultAmount, "BLVO: INVALID_AMOUNT_RECEIVED");
        require(amount == tokenAmount, "BLVO: INVALID_AMOUNT_DEPOSITED");

        // Output amounts
        amounts[0] = vaultAmount;
        amounts[1] = tokenAmount;

        // Output token
        tokens[0] = vault;
        tokens[1] = address(token);
    }

    /// @notice Withdraw the vault token (moo) from Beefy and receive
    ///         one of the paired tokens
    /// @param vault The vault address to withdraw from
    /// @param amount The vault token amount to withdraw
    /// @param token One of the paired token
    /// @param minTokenAmount The minimum token amount expected
    /// @return amounts Array of amounts :
    ///         - [0] : The token received amount
    ///         - [1] : The vault token deposited amount
    /// @return tokens Array of token addresses
    ///         - [0] : The token received address
    ///         - [1] : The vault token deposited address
    function withdraw(
        address vault,
        uint256 amount,
        IERC20 token,
        uint256 minTokenAmount
    ) external returns (uint256[] memory amounts, address[] memory tokens) {
        require(amount != 0, "BLVO: INVALID_AMOUNT");
        require(operatorStorage.vaults(vault) != address(0), "BLVO: INVALID_VAULT");
        amounts = new uint256[](2);
        tokens = new address[](2);

        uint256 tokenBalanceBefore = token.balanceOf(address(this));
        uint256 vaultBalanceBefore = IERC20(vault).balanceOf(address(this));

        ExchangeHelpers.setMaxAllowance(token, vault);
        IBeefyZapUniswapV2(operatorStorage.vaults(vault)).beefOutAndSwap(vault, amount, address(token), minTokenAmount);

        uint256 tokenAmount = token.balanceOf(address(this)) - tokenBalanceBefore;
        uint256 vaultAmount = vaultBalanceBefore - IERC20(vault).balanceOf(address(this));
        require(vaultAmount == amount, "BLVO: INVALID_AMOUNT_WITHDRAWED");
        require(tokenAmount >= minTokenAmount, "BLVO: INVALID_OUTPUT_AMOUNT");

        // Output amounts
        amounts[0] = tokenAmount;
        amounts[1] = amount;

        // Output token
        tokens[0] = address(token);
        tokens[1] = vault;
    }
}
