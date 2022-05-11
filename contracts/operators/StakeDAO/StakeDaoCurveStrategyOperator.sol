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

    function deposit(
        address strategy,
        IERC20 token,
        uint256 amount,
        uint256 minStrategyToken
    ) external payable returns (uint256[] memory amounts, address[] memory tokens) {
        require(amount != 0, "SDCSO: INVALID_AMOUNT");
        address pool = operatorStorage.strategies(strategy);
        require(pool != address(0), "SDCSO: INVALID_STRATEGY");

        amounts = new uint256[](2);
        tokens = new address[](2);

        uint256 strategyTokenBalanceBefore = IERC20(strategy).balanceOf(address(this));
        uint256 tokenBalanceBefore = token.balanceOf(address(this));

        _addLiquidityAndDepositLP(pool, IStakeDaoStrategy(strategy), token, amount);

        uint256 strategyTokenAmount = IERC20(strategy).balanceOf(address(this)) - strategyTokenBalanceBefore;
        uint256 depositedAmount = tokenBalanceBefore - token.balanceOf(address(this));

        require(strategyTokenAmount != 0 && strategyTokenAmount >= minStrategyToken, "SDCSO: INVALID_AMOUNT_RECEIVED");
        require(depositedAmount != 0 && amount >= depositedAmount, "SDCSO: INVALID_AMOUNT_DEPOSITED");

        // Output amounts
        amounts[0] = strategyTokenAmount;
        amounts[1] = depositedAmount;

        // Output token
        tokens[0] = strategy;
        tokens[1] = address(token);
    }

    function _addLiquidityAndDepositLP(
        address pool,
        IStakeDaoStrategy strategy,
        IERC20 token,
        uint256 amount
    ) private {
        ICurvePool curvePool = ICurvePool(pool);
        uint256[3] memory amounts;

        if (address(token) == curvePool.coins(0)) {
            amounts[0] = amount;
        } else if (address(token) == curvePool.coins(1)) {
            amounts[1] = amount;
        } else {
            require(address(token) == curvePool.coins(2), "SDCSO: INVALID_INPUT_TOKEN");
            amounts[2] = amount;
        }

        ExchangeHelpers.setMaxAllowance(token, pool);
        curvePool.add_liquidity(amounts, 0);

        IERC20 lpToken = strategy.token();

        ExchangeHelpers.setMaxAllowance(lpToken, address(strategy));
        strategy.deposit(lpToken.balanceOf(address(this)));
    }
}