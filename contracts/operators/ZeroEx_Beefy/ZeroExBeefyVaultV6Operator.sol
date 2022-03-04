// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.11;

import "../../libraries/ExchangeHelpers.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title ZeroEx + Beefy Single Vault Operator
/// @notice Deposit/Withdraw in a Beefy vault (native or non-native) and
///         allows swapping with 0x (before depositing and after withdrawing).
contract ZeroExBeefyVaultV6Operator {
    IERC20 public immutable token;
    IERC20 public immutable vault;
    address public immutable swapTarget;

    constructor(
        IERC20 _token,
        IERC20 _vault,
        address _swapTarget
    ) {
        token = _token;
        vault = _vault;
        swapTarget = _swapTarget;
    }

    /// @notice Swap a token via 0x and deposit the exchanged asset in the Beefy
    ///         vault, then receive the vault token (moo).
    /// @param sellToken The token sold
    /// @param swapCallData 0x calldata from the API
    /// @param minVaultAmount The minimum vault token amount expected
    /// @return amounts Array of amounts :
    ///         - [0] : The vault token received amount
    ///         - [1] : The token deposited amount
    /// @return tokens Array of token addresses
    ///         - [0] : The vault token received address
    ///         - [1] : The token deposited address
    function performSwapAndDeposit(
        IERC20 sellToken,
        bytes calldata swapCallData,
        uint256 minVaultAmount
    ) external returns (uint256[] memory amounts, address[] memory tokens) {
        require(sellToken != token, "BVO: SAME_INPUT_OUTPUT");
        amounts = new uint256[](2);
        tokens = new address[](2);

        // Swap Using 0x
        uint256 buyBalanceBefore = token.balanceOf(address(this));
        uint256 sellBalanceBefore = sellToken.balanceOf(address(this));

        bool successSwap = ExchangeHelpers.fillQuote(sellToken, swapTarget, swapCallData);
        require(successSwap, "BVO: SWAP_FAILED");

        uint256 tokenBalanceAfterSwap = token.balanceOf(address(this));

        uint256 amountBought = tokenBalanceAfterSwap - buyBalanceBefore;
        uint256 amountSold = sellBalanceBefore - sellToken.balanceOf(address(this));
        require(amountBought != 0, "BVO: INVALID_AMOUNT_BOUGHT");
        require(amountSold != 0, "BVO: INVALID_AMOUNT_SOLD");

        // Deposit in Beefy
        buyBalanceBefore = vault.balanceOf(address(this)); // reuse variable for vault

        (bool successDeposit, ) = address(vault).call(abi.encodeWithSignature("deposit(uint256)", amountBought));
        require(successDeposit, "BVO: DEPOSIT_CALL_FAILED");

        uint256 vaultAmount = vault.balanceOf(address(this)) - buyBalanceBefore;
        uint256 tokenAmount = tokenBalanceAfterSwap - token.balanceOf(address(this));
        require(vaultAmount != 0 && vaultAmount >= minVaultAmount, "BVO: INVALID_AMOUNT_RECEIVED");
        require(tokenAmount != 0, "BVO: INVALID_AMOUNT_DEPOSITED");

        // Output amounts
        amounts[0] = vaultAmount;
        amounts[1] = tokenAmount;

        // Output token
        tokens[0] = address(vault);
        tokens[1] = address(token);
    }

    /// @notice Withdraw the vault token and swap the underlying asset via 0x
    /// @param amount The vault token to withdraw
    /// @param buyToken The token bought with the underlying asset
    /// @param swapCallData 0x calldata from the API
    /// @return amounts Array of amounts :
    ///         - [0] : The token bought amount
    ///         - [1] : The vault token withdrawed amount
    /// @return tokens Array of token addresses
    ///         - [0] : The token bought address
    ///         - [1] : The vault token withdrawed address
    function withdrawAndPerformSwap(
        uint256 amount,
        IERC20 buyToken,
        bytes calldata swapCallData
    ) external returns (uint256[] memory amounts, address[] memory tokens) {
        require(buyToken != token, "BVO: SAME_OUTPUT_OUTPUT");
        amounts = new uint256[](2);
        tokens = new address[](2);

        // Withdraw from Beefy
        uint256 tokenBalanceBefore = token.balanceOf(address(this));
        uint256 vaultBalanceBefore = vault.balanceOf(address(this));

        (bool success, ) = address(vault).call(abi.encodeWithSignature("withdraw(uint256)", amount));
        require(success, "BVO: WITHDRAW_CALL_FAILED");

        uint256 tokenAmount = token.balanceOf(address(this)) - tokenBalanceBefore;
        uint256 vaultAmount = vaultBalanceBefore - vault.balanceOf(address(this));
        require(amount == tokenAmount, "BVO: INVALID_AMOUNT_DEPOSITED");
        require(vaultAmount != 0, "BVO: INVALID_AMOUNT_RECEIVED");

        // Swap Using 0x
        tokenBalanceBefore = token.balanceOf(address(this)); // reuse variable for token (to sell)
        uint256 sellBalanceBefore = buyToken.balanceOf(address(this));

        bool successSwap = ExchangeHelpers.fillQuote(token, swapTarget, swapCallData);
        require(successSwap, "BVO: SWAP_FAILED");

        uint256 amountBought = buyToken.balanceOf(address(this)) - sellBalanceBefore;
        uint256 amountSold = tokenBalanceBefore - token.balanceOf(address(this));
        require(amountBought != 0, "BVO: INVALID_AMOUNT_BOUGHT");
        require(amountSold != 0, "BVO: INVALID_AMOUNT_SOLD");

        // Output amounts
        amounts[0] = amountBought;
        amounts[1] = vaultAmount;

        // Output token
        tokens[0] = address(buyToken);
        tokens[1] = address(vault);
    }
}
