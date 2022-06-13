# Curve pools

Due to the number of Curve pool types, we had to choose which ones to support in the YearnCurveVaultOperator and StakeDaoCurveStrategyOperator.

There is 12 Curve pool types:

-   [Curve plain pools](https://curve.readthedocs.io/exchange-pools.html#plain-pools) with ETH
-   [Curve plain pools](https://curve.readthedocs.io/exchange-pools.html#plain-pools) with WETH
-   [Curve plain pools](https://curve.readthedocs.io/exchange-pools.html#plain-pools) without ETH or WETH
-   [Curve lending pools](https://curve.readthedocs.io/exchange-pools.html#lending-pools) with ETH
-   [Curve lending pools](https://curve.readthedocs.io/exchange-pools.html#lending-pools) with WETH
-   [Curve lending pools](https://curve.readthedocs.io/exchange-pools.html#lending-pools) without ETH or WETH
-   [Curve metapool](https://curve.readthedocs.io/exchange-pools.html#metapools) pool with ETH
-   [Curve metapool](https://curve.readthedocs.io/exchange-pools.html#metapools) pool with WETH
-   [Curve metapool](https://curve.readthedocs.io/exchange-pools.html#metapools) pool without ETH or WETH
-   [Curve factory pools](https://curve.readthedocs.io/factory-pools.html) - pools pool with ETH
-   [Curve factory pools](https://curve.readthedocs.io/factory-pools.html) - pools pool with WETH
-   [Curve factory pools](https://curve.readthedocs.io/factory-pools.html) - pools pool without ETH or WETH

## Differences betweens Curve pools

### int128 & uint256

Some Curve pools has a different interfaces especially on the `remove_liquidity_one_coin` function.
You can find those two different function selectors:

```
remove_liquidity_one_coin(uint256,int128,uint256)
remove_liquidity_one_coin(uint256,uint256,uint256)
```

These differences are the consequence of the presence of functions `withdraw128()` and `withdraw256()` in the StakeDAO and Yearn operators.

### ETH handling

#### Add liquidity

Some Curve pools has ETH as liquidity, and require to call `add_liquidity` with a value to use ETH for the liquidity addition.
So to add liquidity to this type of pool using ETH, we must use `depositETH(address,uint256,uint256)` that will call:

```
add_liquidity{value: x}(uint256[],uint256)
```

And to add liquidity in this type of pool using another token, we must call:

```
add_liquidity(uint256[],uint256)
```

#### remove liquidity

When you remove liquidity from a Curve pool using ETH as a Curve output token, the `NestedFactory` will automaticly convert the received ETH into WETH because the [ETH/WETH nested protocol managment](https://github.com/NestedFi/nested-core-lego#eth-managment) forces WETH conversion on `receive` if the sender is not the whithdrawer, so when you call `withdrawETH(address,uint256,uint256)`, you will receive WETH as output token even if you asked for ETH.

## Supported Curve pool types

-   [Curve plain pools](https://curve.readthedocs.io/exchange-pools.html#plain-pools) => 100% supported
    -   Curve plain pools without ETH :heavy_check_mark:
    -   Curve plain pools with ETH :heavy_check_mark:
-   [Curve lending pools](https://curve.readthedocs.io/exchange-pools.html#lending-pools) => partialy supported
    -   Curve plain pools without ETH :heavy_check_mark:
    -   Curve plain pools with ETH
        -   Deposit :heavy_check_mark:
        -   withdraw non ETH :heavy_check_mark:
        -   Withdraw ETH :x:
-   [Curve factory - pools](https://curve.readthedocs.io/factory-pools.html) => partialy supported
    -   Curve pool without LP token :heavy_check_mark:
    -   Metapool with LP token :x:
-   [Curve metapool](https://curve.readthedocs.io/exchange-pools.html#metapools) => not supported :x:
