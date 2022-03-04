// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.11;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title Beefy Single Vault Operator
/// @notice Deposit/Withdraw in a Beefy vault (native or non-native).
contract BeefyVaultV6Operator {
    IERC20 public immutable token;
    IERC20 public immutable vault;

    constructor(IERC20 _token, IERC20 _vault) {
        token = _token;
        vault = _vault;
    }

    /// @notice Deposit the asset in the Beefy vault and receive
    ///         the vault token (moo).
    /// @param amount The token amount to deposit
    /// @param minVaultAmount The minimum vault token amount expected
    /// @return amounts Array of amounts :
    ///         - [0] : The vault token received amount
    ///         - [1] : The token deposited amount
    /// @return tokens Array of token addresses
    ///         - [0] : The vault token received address
    ///         - [1] : The token deposited address
    function deposit(uint256 amount, uint256 minVaultAmount)
        external
        returns (uint256[] memory amounts, address[] memory tokens)
    {
        require(amount != 0, "BVO: INVALID_AMOUNT");
        amounts = new uint256[](2);
        tokens = new address[](2);

        uint256 vaultBalanceBefore = vault.balanceOf(address(this));
        uint256 tokenBalanceBefore = token.balanceOf(address(this));

        (bool success, ) = address(vault).call(abi.encodeWithSignature("deposit(uint256)", amount));
        require(success, "BVO: DEPOSIT_CALL_FAILED");

        uint256 vaultAmount = vault.balanceOf(address(this)) - vaultBalanceBefore;
        uint256 tokenAmount = tokenBalanceBefore - token.balanceOf(address(this));
        require(vaultAmount != 0 && vaultAmount >= minVaultAmount, "BVO: INVALID_AMOUNT_RECEIVED");
        require(amount == tokenAmount, "BVO: INVALID_AMOUNT_DEPOSITED");

        // Output amounts
        amounts[0] = vaultAmount;
        amounts[1] = tokenAmount;

        // Output token
        tokens[0] = address(vault);
        tokens[1] = address(token);
    }

    /// @notice Withdraw the vault token (moo) from Beefy and receive
    ///         the underlying token.
    /// @param amount The vault token amount to withdraw
    /// @return amounts Array of amounts :
    ///         - [0] : The token received amount
    ///         - [1] : The vault token deposited amount
    /// @return tokens Array of token addresses
    ///         - [0] : The token received address
    ///         - [1] : The vault token deposited address
    function withdraw(uint256 amount) external returns (uint256[] memory amounts, address[] memory tokens) {
        require(amount != 0, "BVO: INVALID_AMOUNT");
        amounts = new uint256[](2);
        tokens = new address[](2);

        uint256 tokenBalanceBefore = token.balanceOf(address(this));
        uint256 vaultBalanceBefore = vault.balanceOf(address(this));

        (bool success, ) = address(vault).call(abi.encodeWithSignature("withdraw(uint256)", amount));
        require(success, "BVO: WITHDRAW_CALL_FAILED");

        uint256 tokenAmount = token.balanceOf(address(this)) - tokenBalanceBefore;
        uint256 vaultAmount = vaultBalanceBefore - vault.balanceOf(address(this));
        require(amount == tokenAmount, "BVO: INVALID_AMOUNT_DEPOSITED");
        require(vaultAmount != 0, "BVO: INVALID_AMOUNT_RECEIVED");

        // Output amounts
        amounts[0] = tokenAmount;
        amounts[1] = vaultAmount;

        // Output token
        tokens[0] = address(token);
        tokens[1] = address(vault);
    }
}
