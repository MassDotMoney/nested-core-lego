// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.11;

import "./interfaces/ILendingPool.sol";
import "./interfaces/IIcentivesController.sol";

contract AaveV2LendingProtocol {
    ILendingPool public immutable lendingPool;
    IIncentivesController public immutable incentivesController;
    address public immutable token;
    address public immutable aToken;

    constructor(
        ILendingPool _lendingPool,
        IIncentivesController _incentivesController,
        address _token,
        address _aToken
    ) {
        lendingPool = _lendingPool;
        incentivesController = _incentivesController;
        token = _token;
        aToken = _aToken;
    }

    /// @notice TODO
    /// @param amount TODO
    /// @return amounts Array of amounts :
    ///         - [0] : The aave token received amount
    ///         - [1] : The token deposited amount
    /// @return tokens Array of token addresses
    ///         - [0] : The aave token received address
    ///         - [1] : The token deposited address
    function deposit(uint256 amount) external payable returns (uint256[] memory amounts, address[] memory tokens) {
        require(amount != 0, "A2LP: INVALID_AMOUNT");
        amounts = new uint256[](2);
        tokens = new address[](2);

        uint256 aTokenBalanceBefore = IERC20(aToken).balanceOf(address(this));
        uint256 tokenBalanceBefore = IERC20(token).balanceOf(address(this));

        ExchangeHelpers.setMaxAllowance(tokenBalanceBefore, address(lendingPool));
        ILendingPool(lendingPool).deposit(token, amount, address(this), 0);

        uint256 aTokenAmount = IERC20(aToken).balanceOf(address(this)) - aTokenBalanceBefore;
        uint256 tokenAmount = tokenBalanceBefore - token.balanceOf(address(this));
        require(amount == tokenAmount, "BVO: INVALID_AMOUNT_DEPOSITED");

        // Output amounts
        amounts[0] = aTokenAmount;
        amounts[1] = tokenAmount;

        // Output token
        tokens[0] = aToken;
        tokens[1] = token;
    }
}
