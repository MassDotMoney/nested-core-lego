// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.11;

import "./StakeDaoStrategyStorage.sol";
import "./../../libraries/ExchangeHelpers.sol";
import "../../interfaces/external/ICurvePool.sol";
import "../../interfaces/external/IStakeDaoStrategy.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title StakeDAO Curve strategy operator
/// @notice Deposit/Withdraw in a StakeDAO strategy
contract StakeDaoCurveStrategyOperator {
    StakeDaoStrategyStorage public immutable operatorStorage;

    constructor(address[] memory strategies, address[] memory pools) {
        uint256 vaultsLength = strategies.length;
        require(vaultsLength == pools.length, "SDCSO: INVALID_POOLS_LENGTH");
        operatorStorage = new StakeDaoStrategyStorage();

        for (uint256 i; i < vaultsLength; i++) {
            operatorStorage.addStrategy(strategies[i], pools[i]);
        }

        operatorStorage.transferOwnership(msg.sender);
    }

    /// @notice Use the token to add liquidity to a Curve pool,
    ///         deposit the LP token in a StakeDAO strategy and
    ///         receive the strategy's token.
    /// @param strategy The stakeDAO strategy address in wich to deposit the LP token
    /// @param token The input token to use for adding liquidity
    /// @param amount The input token amount to use for adding liquidity
    /// @param minStrategyToken The minimum strategy token expected
    /// @return amounts Array of amounts :
    ///         - [0] : The strategy token received amount
    ///         - [1] : The token deposited amount
    /// @return tokens Array of token addresses
    ///         - [0] : The strategy token received address
    ///         - [1] : The token deposited address
    function deposit(
        address strategy,
        IERC20 token,
        uint256 amount,
        uint256 minStrategyToken
    ) external payable returns (uint256[] memory amounts, address[] memory tokens) {
        require(amount != 0, "SDCSO: INVALID_AMOUNT");
        address pool = operatorStorage.strategies(strategy);
        require(pool != address(0), "SDCSO: INVALID_STRATEGY");

        uint256 strategyTokenBalanceBefore = IERC20(strategy).balanceOf(address(this));
        uint256 tokenBalanceBefore = token.balanceOf(address(this));

        _addLiquidityAndDepositLP(ICurvePool(pool), IStakeDaoStrategy(strategy), token, amount);

        uint256 strategyTokenAmount = IERC20(strategy).balanceOf(address(this)) - strategyTokenBalanceBefore;
        uint256 depositedAmount = tokenBalanceBefore - token.balanceOf(address(this));

        require(strategyTokenAmount != 0 && strategyTokenAmount >= minStrategyToken, "SDCSO: INVALID_AMOUNT_RECEIVED");
        require(depositedAmount != 0 && amount >= depositedAmount, "SDCSO: INVALID_AMOUNT_DEPOSITED");

        amounts = new uint256[](2);
        tokens = new address[](2);

        // Output amounts
        amounts[0] = strategyTokenAmount;
        amounts[1] = depositedAmount;

        // Output token
        tokens[0] = strategy;
        tokens[1] = address(token);
    }

    /// @notice Withdraw the LP token from StakeDAO and remove the
    ///         liquidity from the Curve pool in order to receive
    ///         one of the pool tokens.
    /// @param strategy The stakeDAO strategy to withdraw from
    /// @param amount The amount to withdraw
    /// @param outputToken The output token to receive
    /// @param minAmountOut The minimum output token expected
    /// @return amounts Array of amounts :
    ///         - [0] : The strategy token received amount
    ///         - [1] : The token deposited amount
    /// @return tokens Array of token addresses
    ///         - [0] : The strategy token received address
    ///         - [1] : The token deposited address
    function withdraw(
        address strategy,
        uint256 amount,
        IERC20 outputToken,
        uint256 minAmountOut
    ) external payable returns (uint256[] memory amounts, address[] memory tokens) {
        require(amount != 0, "SDCSO: INVALID_AMOUNT");
        address pool = operatorStorage.strategies(strategy);
        require(pool != address(0), "SDCSO: INVALID_STRATEGY");

        uint256 strategyTokenBalanceBefore = IERC20(strategy).balanceOf(address(this));
        uint256 tokenBalanceBefore = outputToken.balanceOf(address(this));

        _withdrawLpAndRemoveLiquidity(IStakeDaoStrategy(strategy), ICurvePool(pool), address(outputToken), amount);

        uint256 strategyTokenAmount = strategyTokenBalanceBefore - IERC20(strategy).balanceOf(address(this));
        uint256 tokenAmount = outputToken.balanceOf(address(this)) - tokenBalanceBefore;

        require(strategyTokenAmount == amount, "SDCSO: INVALID_AMOUNT_WITHDRAWED");
        require(tokenAmount >= minAmountOut, "SDCSO: INVALID_AMOUNT");

        amounts = new uint256[](2);
        tokens = new address[](2);

        // Output amounts
        amounts[0] = tokenAmount;
        amounts[1] = amount;

        // Output token
        tokens[0] = address(outputToken);
        tokens[1] = strategy;
    }

    /// @dev Add liquidity in the curve pool and deposit the
    ///      LP token in the StakeDAO strategy
    /// @param curvePool The Curve pool in which to add liquidity
    /// @param strategy The stakeDAO strategy in which to deposit
    /// @param token The input token to add in the curve pool
    /// @param amount The input token amount to add in the curve pool
    function _addLiquidityAndDepositLP(
        ICurvePool curvePool,
        IStakeDaoStrategy strategy,
        IERC20 token,
        uint256 amount
    ) private {
        uint256[3] memory amounts;

        if (address(token) == curvePool.coins(0)) {
            amounts[0] = amount;
        } else if (address(token) == curvePool.coins(1)) {
            amounts[1] = amount;
        } else {
            require(address(token) == curvePool.coins(2), "SDCSO: INVALID_INPUT_TOKEN");
            amounts[2] = amount;
        }

        ExchangeHelpers.setMaxAllowance(token, address(curvePool));
        curvePool.add_liquidity(amounts, 1);

        IERC20 lpToken = strategy.token();

        ExchangeHelpers.setMaxAllowance(lpToken, address(strategy));
        strategy.deposit(lpToken.balanceOf(address(this)));
    }

    /// @dev Withdraw the LP tokens from stakeDAO and remove
    ///      the liquidity from the Curve pool
    /// @param strategy The stakeDAO strategy to withdraw from
    /// @param curvePool The Curve pool in which to remove liquidity
    /// @param token The output token to remove from the curve pool
    /// @param amount The amount of token to withdraw from stakeDAO
    function _withdrawLpAndRemoveLiquidity(
        IStakeDaoStrategy strategy,
        ICurvePool curvePool,
        address token,
        uint256 amount
    ) private {
        strategy.withdraw(amount);

        if (token == curvePool.coins(0)) {
            curvePool.remove_liquidity_one_coin(strategy.token().balanceOf(address(this)), 0, 1);
        } else if (token == curvePool.coins(1)) {
            curvePool.remove_liquidity_one_coin(strategy.token().balanceOf(address(this)), 1, 1);
        } else {
            require(token == curvePool.coins(2), "SDCSO: INVALID_OUTPUT_TOKEN");
            curvePool.remove_liquidity_one_coin(strategy.token().balanceOf(address(this)), 2, 1);
        }
    }
}
