# Beefy Zap Lp Vaul Operators

## Optimal swap amount

To solve the problem of remaining dust after adding liquidity in a Uniswap-like liquidity pool, we need to perform a calculation to minimize the amount of unused tokens by the Uniswap-like router.

> For this example, we will use an WBNB-USDT Uniswap liquidity pool, and we have 1 WBNB as a total investment.

### Compute the optimal amount

| Name | Value                                               |
| ---- | :-------------------------------------------------- |
| A    | Amount of BNB in the liquidity pool                 |
| B    | Amount of USDT in the liquidity pool                |
| K    | Ratio between **A** and **B** in the liquidity pool |
| f    | Platform trading fee                                |
| a    | Amount of BNB that i have                           |
| b    | Amount of USDT that i need                          |
| s    | Amount of BNB to swap                               |

> We don't know the values of **b** and **s**.

#### Find b

The ratio between **A** and **B** in the liquidity pool must be constant whatever the liquidity additions.

$$K = AB$$

After the swap, this constant must remain the same.
$$K = (A + (1-f)s)(B-b)$$

So we can express **b** in terms of **s**:
$$b = {{B(1-f)s} \over {A+(1-f)s}}$$

#### Find s

After the swap, the ratio between **A** and **B** in the liquidity pool is:
$${A+s \over B-b} = {a-s \over b}$$

From this equation we can solve for s using [b espression](#find-b) as follow:
(A + s)b - (a - s)(B - b) = 0
Ab + sb - aB + ab + sB - sb = 0
Ab - aB + ab + sB = 0
**(A + a)b - (a - s)B = 0**

##### b expression reminder

b = B(1 - f)s / (A + (1 - f)s)

##### Replace b with the value expressed in terms of s

(A + a)B(1 - f)s / (A + (1 - f)s) - (a - s)B = 0
(A + a)(1 - f)s / (A + (1 - f)s) - (a - s) = 0
(A + a)(1 - f)s - (a - s)(A + (1 - f)s) = 0
(A + a)(1 - f)s - aA - a(1 - f)s +sA + (1 - f)s² = 0
A(1 - f)s aA + sA + (1 - f)s² = 0
A(2 - f)s -aA + (1 - f)s² = 0

**(1-f)s² + A(2-F)s - aA = 0**

$$s = {(- (2 - f)A + \sqrt(((2 - f)A)² + 4(1 - f)Aa)) \over (2(1 - f))}$$
