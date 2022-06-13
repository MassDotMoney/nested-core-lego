import {
    BeefyVaultOperator,
    FlatOperator,
    NestedFactory,
    OperatorResolver,
    ParaswapOperator,
    StakeDaoCurveStrategyOperator,
    ZeroExOperator,
} from "../typechain";
import { FactoryAndOperatorsFixture, FactoryAndOperatorsForkingBSCFixture, FactoryAndOperatorsForkingETHFixture } from "../test/shared/fixtures";
import * as ethers from "ethers"
import { BigNumber, BigNumberish, BytesLike, Wallet } from "ethers";
import * as w3utils from "web3-utils";
import { UINT256_MAX } from "../test/helpers";
import { YearnCurveVaultOperator } from "../typechain/YearnCurveVaultOperator";
import { BeefyZapUniswapLPVaultOperator } from "../typechain/BeefyZapUniswapLPVaultOperator";
import { BeefyZapBiswapLPVaultOperator } from "../typechain/BeefyZapBiswapLPVaultOperator";

type RawDataType = "address" | "bytes4" | "bytes" | "uint256";
interface Op {
    /** Operator name */
    name: string;
    /** Human readable signature (ex: "function transfer(address to, uint amount)") */
    signature: string;
    /** Target contract address */
    contract: string;
}

export interface OrderStruct {
    operator: BytesLike;
    token: string;
    callData: BytesLike;
}

export interface BatchedInputOrderStruct {
    inputToken: string;
    amount: BigNumberish;
    orders: OrderStruct[];
    fromReserve: boolean;
}
export interface BatchedOutputOrderStruct {
    outputToken: string;
    amounts: BigNumberish[];
    orders: OrderStruct[];
    toReserve: boolean;
}

export const dummyRouterSelector = "0x76ab33a6";

export const abiCoder = new ethers.utils.AbiCoder();

export function buildOrderStruct(operator: string, token: string, data: [RawDataType, any][]): OrderStruct {
    const abiCoder = new ethers.utils.AbiCoder();
    const coded = abiCoder.encode([...data.map(x => x[0])], [...data.map(x => x[1])]);
    return {
        // specify which operator?
        operator: operator,
        // specify the token that this order will retrieve from Reserve or Wallet
        token: token,
        // encode the given data
        callData: coded, // remove the leading 32 bytes (one address) and the leading 0x
        // callData,
    };
}

export async function importOperators(
    inResolver: OperatorResolver,
    operators: Op[],
    nestedFactory: NestedFactory | null,
) {
    // Import operator in resolver
    let tx = await inResolver.importOperators(
        operators.map(o => toBytes32(o.name)),
        operators.map(o => ({
            implementation: o.contract,
            selector: computeSelector(o.signature),
        })),
        [],
    );
    await tx.wait();

    // Add operators to factory and rebuild cache
    for (const o of operators) {
        tx = await nestedFactory?.addOperator(toBytes32(o.name));
        await tx?.wait();
    }
    tx = await nestedFactory?.rebuildCache();
    await tx?.wait();
}

export async function importOperatorsWithSigner(
    inResolver: OperatorResolver,
    operators: Op[],
    nestedFactory: NestedFactory | null,
    signer: ethers.Wallet,
) {
    // Import operator in resolver
    let tx = await inResolver.connect(signer).importOperators(
        operators.map(o => toBytes32(o.name)),
        operators.map(o => ({
            implementation: o.contract,
            selector: computeSelector(o.signature),
        })),
        [],
    );
    await tx.wait();

    // Add operators to factory and rebuild cache
    for (const o of operators) {
        tx = await nestedFactory?.connect(signer).addOperator(toBytes32(o.name));
        await tx?.wait();
    }
    tx = await nestedFactory?.connect(signer).rebuildCache();
    await tx?.wait();
}

/**
 * Computes a function selector from its human-readable signature.
 * @param signature Function signature (ex: "function transfer(address to, uint amount)")
 * @returns the signature hash (ex: '0x70a08231')
 */
export function computeSelector(signature: string): string {
    let iface = new ethers.utils.Interface([signature]);
    const fns = Object.keys(iface.functions);
    if (fns.length !== 1) {
        throw new Error("Multiple functions defined (??!)");
    }
    return iface.getSighash(fns[0]);
}

export function registerZeroEx(operator: ZeroExOperator): Op {
    return {
        name: "ZeroEx",
        contract: operator.address,
        signature: "function performSwap(address sellToken, address buyToken, bytes calldata swapCallData)",
    };
}

export function registerParaswap(operator: ParaswapOperator): Op {
    return {
        name: "Paraswap",
        contract: operator.address,
        signature: "function performSwap(address sellToken, address buyToken, bytes calldata swapCallData)",
    };
}

export function registerFlat(operator: FlatOperator): Op {
    return {
        name: "Flat",
        contract: operator.address,
        signature: "function transfer(address token, uint256 amount)",
    };
}

export function registerYearnDeposit(operator: YearnCurveVaultOperator): Op {
    return {
        name: "YearnVaultDepositOperator",
        contract: operator.address,
        signature: "function deposit(address vault, address token, uint256 amount, uint256 minVaultAmount)",
    };
}

export function registerYearnDepositETH(operator: YearnCurveVaultOperator): Op {
    return {
        name: "YearnVaultDepositETHOperator",
        contract: operator.address,
        signature: "function depositETH(address vault, uint256 amount, uint256 minVaultAmount)",
    };
}

export function registerYearnWithdraw128(operator: YearnCurveVaultOperator): Op {
    return {
        name: "YearnVaultWithdraw128Operator",
        contract: operator.address,
        signature: "function withdraw128(address vault, uint256 amount, address outputToken, uint256 minAmountOut)",
    };
}

export function registerYearnWithdraw256(operator: YearnCurveVaultOperator): Op {
    return {
        name: "YearnVaultWithdraw256Operator",
        contract: operator.address,
        signature: "function withdraw256(address vault, uint256 amount, address outputToken, uint256 minAmountOut)",
    };
}

export function registerYearnWithdrawETH(operator: YearnCurveVaultOperator): Op {
    return {
        name: "YearnVaultWithdrawETHOperator",
        contract: operator.address,
        signature: "function withdrawETH(address vault, uint256 amount, uint256 minAmountOut)",
    };
}

export function registerBeefyDeposit(operator: BeefyVaultOperator): Op {
    return {
        name: "BeefyDeposit",
        contract: operator.address,
        signature: "function deposit(address vault, uint256 amount, uint256 minVaultAmount)",
    };
}

export function registerBeefyWithdraw(operator: BeefyVaultOperator): Op {
    return {
        name: "BeefyWithdraw",
        contract: operator.address,
        signature: "function withdraw(address vault, uint256 amount)",
    };
}

export function registerStakeDaoDepositETH(operator: StakeDaoCurveStrategyOperator): Op {
    return {
        name: "stakeDaoCurveStrategyDepositETH",
        contract: operator.address,
        signature: "function depositETH(address strategy, uint256 amount, uint256 minAmountOut)"
    };
}

export function registerStakeDaoDeposit(operator: StakeDaoCurveStrategyOperator): Op {
    return {
        name: "stakeDaoCurveStrategyDeposit",
        contract: operator.address,
        signature: "function deposit(address strategy, address tokenIn, uint256 amount, uint256 minAmountOut)"
    };
}

export function registerStakeDaoWithdrawETH(operator: StakeDaoCurveStrategyOperator): Op {
    return {
        name: "stakeDaoCurveStrategyWithdrawETH",
        contract: operator.address,
        signature: "function withdrawETH(address strategy, uint256 amount, uint256 minAmountOut)"
    };
}

export function registerStakeDaoWithdraw128(operator: StakeDaoCurveStrategyOperator): Op {
    return {
        name: "stakeDaoCurveStrategyWithdraw128",
        contract: operator.address,
        signature: "function withdraw128(address strategy, uint256 amount, address outputToken, uint256 minAmountOut)"
    };
}

export function registerStakeDaoWithdraw256(operator: StakeDaoCurveStrategyOperator): Op {
    return {
        name: "stakeDaoCurveStrategyWithdraw256",
        contract: operator.address,
        signature: "function withdraw256(address strategy, uint256 amount, address outputToken, uint256 minAmountOut)"
    }
}

export function registerBeefyZapBiswapLPDeposit(operator: BeefyZapBiswapLPVaultOperator): Op {
    return {
        name: "BeefyZapBiswapLPDeposit",
        contract: operator.address,
        signature: "function deposit(address vault, address token, uint256 amount, uint256 minVaultAmount)",
    };
}

export function registerBeefyZapBiswapLPWithdraw(operator: BeefyZapBiswapLPVaultOperator): Op {
    return {
        name: "BeefyZapBiswapLPWithdraw",
        contract: operator.address,
        signature: "function withdraw(address vault, uint256 amount, address token, uint256 minTokenAmount)",
    };
}

export function registerBeefyZapUniswapLPDeposit(operator: BeefyZapUniswapLPVaultOperator): Op {
    return {
        name: "BeefyZapUniswapLPDeposit",
        contract: operator.address,
        signature: "function deposit(address vault, address token, uint256 amount, uint256 minVaultAmount)",
    };
}

export function registerBeefyZapUniswapLPWithdraw(operator: BeefyZapBiswapLPVaultOperator): Op {
    return {
        name: "BeefyZapUniswapLPWithdraw",
        contract: operator.address,
        signature: "function withdraw(address vault, uint256 amount, address token, uint256 minTokenAmount)",
    };
}

export function toBytes32(key: string) {
    return w3utils.rightPad(w3utils.asciiToHex(key), 64);
}

export function cleanResult<T>(r: T): T {
    if (!Array.isArray(r)) {
        return r;
    }
    const props = Object.keys(r).filter(x => !/^\d+$/.test(x));
    if (!props.length) {
        return [...r.map(x => cleanResult(x))] as any;
    }
    return props.reduce((acc, x) => ({ ...acc, [x]: cleanResult((r as any)[x]) }), {} as any);
}

// Create the Orders to buy KNC and UNI with DAI
export function getUniAndKncWithDaiOrders(
    context: FactoryAndOperatorsFixture,
    uniBought: BigNumber,
    kncBought: BigNumber,
) {
    return [
        buildOrderStruct(context.zeroExOperatorNameBytes32, context.mockUNI.address, [
            ["address", context.mockDAI.address],
            ["address", context.mockUNI.address],
            [
                "bytes",
                ethers.utils.hexConcat([
                    dummyRouterSelector,
                    abiCoder.encode(
                        ["address", "address", "uint"],
                        [context.mockDAI.address, context.mockUNI.address, uniBought],
                    ),
                ]),
            ],
        ]),
        buildOrderStruct(context.zeroExOperatorNameBytes32, context.mockKNC.address, [
            ["address", context.mockDAI.address],
            ["address", context.mockKNC.address],
            [
                "bytes",
                ethers.utils.hexConcat([
                    dummyRouterSelector,
                    abiCoder.encode(
                        ["address", "address", "uint"],
                        [context.mockDAI.address, context.mockKNC.address, kncBought],
                    ),
                ]),
            ],
        ]),
    ];
}

// Create the Orders to buy KNC and UNI with ETH
export function getUniAndKncWithETHOrders(
    context: FactoryAndOperatorsFixture,
    uniBought: BigNumber,
    kncBought: BigNumber,
) {
    return [
        buildOrderStruct(context.zeroExOperatorNameBytes32, context.mockUNI.address, [
            ["address", context.WETH.address],
            ["address", context.mockUNI.address],
            [
                "bytes",
                ethers.utils.hexConcat([
                    dummyRouterSelector,
                    abiCoder.encode(
                        ["address", "address", "uint"],
                        [context.WETH.address, context.mockUNI.address, uniBought],
                    ),
                ]),
            ],
        ]),
        buildOrderStruct(context.zeroExOperatorNameBytes32, context.mockKNC.address, [
            ["address", context.WETH.address],
            ["address", context.mockKNC.address],
            [
                "bytes",
                ethers.utils.hexConcat([
                    dummyRouterSelector,
                    abiCoder.encode(
                        ["address", "address", "uint"],
                        [context.WETH.address, context.mockKNC.address, kncBought],
                    ),
                ]),
            ],
        ]),
    ];
}

// Create a non-ETH Deposit order in yearn
export function getYearnCurveDepositOrder(context: FactoryAndOperatorsForkingETHFixture, yearnVaultAddress: string, tokenToDeposit: string, amountToDeposit: BigNumber, minVaultAmount?: BigNumber) {
    return [
        buildOrderStruct(context.yearnVaultDepositOperatorNameBytes32, yearnVaultAddress, [
            ["address", yearnVaultAddress],
            ["address", tokenToDeposit],
            ["uint256", amountToDeposit],
            ["uint256", minVaultAmount ? minVaultAmount : 0], // 100% slippage
        ]),
    ];
}

// Create an ETH Deposit order in yearn
export function getYearnCurveDepositETHOrder(context: FactoryAndOperatorsForkingETHFixture, yearnVaultAddress: string, amountToDeposit: BigNumber, minVaultAmount?: BigNumber) {
    return [
        buildOrderStruct(context.yearnVaultDepositETHOperatorNameBytes32, yearnVaultAddress, [
            ["address", yearnVaultAddress],
            ["uint256", amountToDeposit],
            ["uint256", minVaultAmount ? minVaultAmount : 0], // 100% slippage
        ]),
    ];
}

// Create a Withdraw256 order in yearn (for Curve pool that require a uint256 index param in the function remove_liquidity_one_coin)
export function getYearnCurveWithdraw256Order(context: FactoryAndOperatorsForkingETHFixture, yearnVaultAddress: string, amountToWithdraw: BigNumber, outputToken: string, minAmountOut?: BigNumber) {
    return [
        buildOrderStruct(context.yearnVaultWithdraw256OperatorNameBytes32, yearnVaultAddress, [
            ["address", yearnVaultAddress],
            ["uint256", amountToWithdraw],
            ["address", outputToken],
            ["uint256", minAmountOut ? minAmountOut : 0], // 100% slippage
        ]),
    ];
}

// Create a Withdraw128 order in yearn (for Curve pool that require a int128 index param in the function remove_liquidity_one_coin)
export function getYearnCurveWithdraw128Order(context: FactoryAndOperatorsForkingETHFixture, yearnVaultAddress: string, amountToWithdraw: BigNumber, outputToken: string, minAmountOut?: BigNumber) {
    return [
        buildOrderStruct(context.yearnVaultWithdraw128OperatorNameBytes32, yearnVaultAddress, [
            ["address", yearnVaultAddress],
            ["uint256", amountToWithdraw],
            ["address", outputToken],
            ["uint256", minAmountOut ? minAmountOut : 0], // 100% slippage
        ]),
    ];
}

// Create a WithdrawETH order in yearn
export function getYearnCurveWithdrawETHOrder(context: FactoryAndOperatorsForkingETHFixture, yearnVaultAddress: string, amountToWithdraw: BigNumber, minAmountOut?: BigNumber) {
    return [
        buildOrderStruct(context.yearnVaultWithdrawETHOperatorNameBytes32, yearnVaultAddress, [
            ["address", yearnVaultAddress],
            ["uint256", amountToWithdraw],
            ["uint256", minAmountOut ? minAmountOut : 0], // 100% slippage
        ]),
    ];
}



// Create an ETH Deposit order in StakeDAO
export function getStakeDaoDepositETHOrder(context: FactoryAndOperatorsForkingETHFixture, strategyAddress: string, amountToDeposit: BigNumber, minStrategyToken?: BigNumber) {
    return [
        buildOrderStruct(context.stakeDaoCurveStrategyDepositETHOperatorNameBytes32, strategyAddress, [
            ["address", strategyAddress],
            ["uint256", amountToDeposit],
            ["uint256", minStrategyToken ? minStrategyToken : 0], // 100% slippage if minAmountOut is null
        ]),
    ];
}


// Create a non-ETH Deposit order in StakeDAO
export function getStakeDaoDepositOrder(context: FactoryAndOperatorsForkingBSCFixture, strategyAddress: string, tokenToDeposit: string, amountToDeposit: BigNumber, minStrategyToken?: BigNumber) {
    return [
        buildOrderStruct(context.stakeDaoCurveStrategyDepositOperatorNameBytes32, strategyAddress, [
            ["address", strategyAddress],
            ["address", tokenToDeposit],
            ["uint256", amountToDeposit],
            ["uint256", minStrategyToken ? minStrategyToken : 0], // 100% slippage if minAmountOut is null
        ]),
    ];
}


// Create a WithdrawETH order in StakeDAO
export function getStakeDaoWithdrawETHOrder(context: FactoryAndOperatorsForkingETHFixture, strategyAddress: string, amountToWithdraw: BigNumber, minAmountOut?: BigNumber) {
    return [
        buildOrderStruct(context.stakeDaoCurveStrategyWithdrawETHOperatorNameBytes32, strategyAddress, [
            ["address", strategyAddress],
            ["uint256", amountToWithdraw],
            ["uint256", minAmountOut ? minAmountOut : 0], // 100% slippage if minAmountOut is null
        ]),
    ];
}


// Create a Withdraw128 order in StakeDAO
export function getStakeDaoWithdraw128Order(context: FactoryAndOperatorsForkingBSCFixture, strategyAddress: string, amountToWithdraw: BigNumber, outputToken: string, minAmountOut?: BigNumber) {
    return [
        buildOrderStruct(context.stakeDaoCurveStrategyWithdraw128OperatorNameBytes32, strategyAddress, [
            ["address", strategyAddress],
            ["uint256", amountToWithdraw],
            ["address", outputToken],
            ["uint256", minAmountOut ? minAmountOut : 0], // 100% slippage if minAmountOut is null
        ]),
    ];
}


// Create a Withdraw256 order in StakeDAO
export function getStakeDaoWithdraw256Order(context: FactoryAndOperatorsForkingBSCFixture, strategyAddress: string, amountToWithdraw: BigNumber, outputToken: string, minAmountOut?: BigNumber) {
    return [
        buildOrderStruct(context.stakeDaoCurveStrategyWithdraw256OperatorNameBytes32, strategyAddress, [
            ["address", strategyAddress],
            ["uint256", amountToWithdraw],
            ["address", outputToken],
            ["uint256", minAmountOut ? minAmountOut : 0], // 100% slippage if minAmountOut is null
        ]),
    ];
}

// Create a Deposit order in Beefy (BNB Venus Vault on BSC)
export function getBeefyBnbVenusDepositOrder(context: FactoryAndOperatorsForkingBSCFixture, bnbToDeposit: BigNumber) {
    return [
        buildOrderStruct(context.beefyVaultDepositOperatorNameBytes32, context.beefyVenusBNBVaultAddress, [
            ["address", context.beefyVenusBNBVaultAddress],
            ["uint256", bnbToDeposit],
            ["uint256", 0], // 100% slippage
        ]),
    ];
}

// Create a Withdraw order in Beefy (BNB Venus Vault on BSC)
export function getBeefyBnbVenusWithdrawOrder(context: FactoryAndOperatorsForkingBSCFixture, mooToWithdraw: BigNumber) {
    return [
        buildOrderStruct(context.beefyVaultWithdrawOperatorNameBytes32, context.beefyVenusBNBVaultAddress, [
            ["address", context.beefyVenusBNBVaultAddress],
            ["uint256", mooToWithdraw],
        ]),
    ];
}

// Create a Deposit order in Beefy
export function getBeefyUniswapDepositOrder(
    context: FactoryAndOperatorsForkingBSCFixture,
    depositTokenAddress: string,
    tokenToDeposit: BigNumber,
    vaultAddress: string,
    minOutputToken?: BigNumber,
) {
    return [
        buildOrderStruct(context.beefyZapUniswapLPVaultDepositOperatorNameBytes32, vaultAddress, [
            ["address", vaultAddress],
            ["address", depositTokenAddress],
            ["uint256", tokenToDeposit],
            ["uint256", minOutputToken != null ? minOutputToken : 0], // 100% slippage if the provided slippage is null
        ]),
    ];
}

// Create a Withdraw order in Beefy
export function getBeefyUniswapWithdrawOrder(
    context: FactoryAndOperatorsForkingBSCFixture,
    withdrawTokenAddress: string,
    mooToWithdraw: BigNumber,
    vaultAddress: string,
    minOutputToken?: BigNumber,
) {
    return [
        buildOrderStruct(context.beefyZapUniswapLPVaultWithdrawOperatorNameBytes32, vaultAddress, [
            ["address", vaultAddress],
            ["uint256", mooToWithdraw],
            ["address", withdrawTokenAddress],
            ["uint256", minOutputToken != null ? minOutputToken : 0], // 100% slippage if the provided slippage is null
        ]),
    ];
}

// Create a Deposit order in Beefy (Biswap USDT-BNB on Bsc)
export function getBeefyBiswapDepositOrder(
    context: FactoryAndOperatorsForkingBSCFixture,
    depositTokenAddress: string,
    tokenToDeposit: BigNumber,
    vaultAddress: string,
    minOutputToken?: BigNumber,
) {
    return [
        buildOrderStruct(context.beefyZapBiswapLPVaultDepositOperatorNameBytes32, vaultAddress, [
            ["address", vaultAddress],
            ["address", depositTokenAddress],
            ["uint256", tokenToDeposit],
            ["uint256", minOutputToken != null ? minOutputToken : 0], // 100% slippage if the provided slippage is null
        ]),
    ];
}

// Create a Withdraw order in Beefy (Biswap USDT-BNB on Bsc)
export function getBeefyBiswapWithdrawOrder(
    context: FactoryAndOperatorsForkingBSCFixture,
    withdrawTokenAddress: string,
    mooToWithdraw: BigNumber,
    vaultAddress: string,
    minOutputToken?: BigNumber,
) {
    return [
        buildOrderStruct(context.beefyZapBiswapLPVaultWithdrawOperatorNameBytes32, vaultAddress, [
            ["address", vaultAddress],
            ["uint256", mooToWithdraw],
            ["address", withdrawTokenAddress],
            ["uint256", minOutputToken != null ? minOutputToken : 0], // 100% slippage if the provided slippage is null
        ]),
    ];
}


// Generic function to create a 1:1 Order
export function getTokenBWithTokenAOrders(
    context: FactoryAndOperatorsFixture,
    amount: BigNumber,
    tokenA: string,
    tokenB: string,
) {
    return [
        buildOrderStruct(context.zeroExOperatorNameBytes32, tokenB, [
            ["address", tokenA],
            ["address", tokenB],
            [
                "bytes",
                ethers.utils.hexConcat([
                    dummyRouterSelector,
                    abiCoder.encode(["address", "address", "uint"], [tokenA, tokenB, amount]),
                ]),
            ],
        ]),
    ];
}

// Create the Orders to get USDC with UNI and KNC
export function getUsdcWithUniAndKncOrders(
    context: FactoryAndOperatorsFixture,
    uniSold: BigNumber,
    kncSold: BigNumber,
) {
    return [
        buildOrderStruct(context.zeroExOperatorNameBytes32, context.mockUNI.address, [
            ["address", context.mockUNI.address],
            ["address", context.mockUSDC.address],
            [
                "bytes",
                ethers.utils.hexConcat([
                    dummyRouterSelector,
                    abiCoder.encode(
                        ["address", "address", "uint"],
                        [context.mockUNI.address, context.mockUSDC.address, uniSold],
                    ),
                ]),
            ],
        ]),
        buildOrderStruct(context.zeroExOperatorNameBytes32, context.mockKNC.address, [
            ["address", context.mockKNC.address],
            ["address", context.mockUSDC.address],
            [
                "bytes",
                ethers.utils.hexConcat([
                    dummyRouterSelector,
                    abiCoder.encode(
                        ["address", "address", "uint"],
                        [context.mockKNC.address, context.mockUSDC.address, kncSold],
                    ),
                ]),
            ],
        ]),
    ];
}

// Create the Orders to get Eth with UNI and KNC
export function getWethWithUniAndKncOrders(
    context: FactoryAndOperatorsFixture,
    uniSold: BigNumber,
    kncSold: BigNumber,
) {
    return [
        buildOrderStruct(context.zeroExOperatorNameBytes32, context.mockUNI.address, [
            ["address", context.mockUNI.address],
            ["address", context.WETH.address],
            [
                "bytes",
                ethers.utils.hexConcat([
                    dummyRouterSelector,
                    abiCoder.encode(
                        ["address", "address", "uint"],
                        [context.mockUNI.address, context.WETH.address, uniSold],
                    ),
                ]),
            ],
        ]),
        buildOrderStruct(context.zeroExOperatorNameBytes32, context.mockKNC.address, [
            ["address", context.mockKNC.address],
            ["address", context.WETH.address],
            [
                "bytes",
                ethers.utils.hexConcat([
                    dummyRouterSelector,
                    abiCoder.encode(
                        ["address", "address", "uint"],
                        [context.mockKNC.address, context.WETH.address, kncSold],
                    ),
                ]),
            ],
        ]),
    ];
}

export const setMaxAllowance = async (signer: Wallet, spender: string, contract: string) => {
    const data =
        ethers.utils.keccak256(
            ethers.utils.toUtf8Bytes("increaseAllowance(address,uint256)")
        ).slice(0, 10) +
        abiCoder.encode(
            ["address", "uint256"],
            [spender, UINT256_MAX]
        ).slice(2, 1000)

    await signer.sendTransaction({
        to: contract,
        data: data
    })
}