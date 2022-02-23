import { FlatOperator, NestedFactory, OperatorResolver, ZeroExOperator } from '../typechain';
import { FactoryAndOperatorsFixture } from "../test/shared/fixtures";
import * as ethers from 'ethers';
import { BigNumber, BigNumberish, BytesLike } from "ethers";
import * as w3utils from "web3-utils";

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

export function buildOrderStruct(operator: string, outToken: string, data: [RawDataType, any][]): OrderStruct {
    const abiCoder = new ethers.utils.AbiCoder();
    const coded = abiCoder.encode([...data.map(x => x[0])], [...data.map(x => x[1])]);
    return {
        // specify which operator?
        operator: operator,
        // specify the token that this order will output
        token: outToken,
        // encode the given data
        callData: coded, // remove the leading 32 bytes (one address) and the leading 0x
        // callData,
    };
}

export async function importOperators(inResolver: OperatorResolver, operators: Op[], nestedFactory: NestedFactory | null) {
    // Import operator in resolver
    let tx = await inResolver.importOperators(
        operators.map(o => toBytes32(o.name)),
        operators.map(o => ({
            implementation: o.contract,
            selector: computeSelector(o.signature),
        })),
        []
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

export async function importOperatorsWithSigner(inResolver: OperatorResolver, operators: Op[], nestedFactory: NestedFactory | null, signer: ethers.Wallet) {
    // Import operator in resolver
    let tx = await inResolver.connect(signer).importOperators(
        operators.map(o => toBytes32(o.name)),
        operators.map(o => ({
            implementation: o.contract,
            selector: computeSelector(o.signature),
        })),
        []
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
        throw new Error('Multiple functions defined (??!)');
    }
    return iface.getSighash(fns[0]);
}


export function registerZeroEx(operator: ZeroExOperator): Op {
    return {
        name: 'ZeroEx',
        contract: operator.address,
        signature: 'function performSwap(address sellToken, address buyToken, bytes calldata swapCallData)',
    }
}

export function registerFlat(operator: FlatOperator): Op {
    return {
        name: 'Flat',
        contract: operator.address,
        signature: 'function transfer(address token, uint256 amount)',
    }
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
export function getUniAndKncWithDaiOrders(context: FactoryAndOperatorsFixture, uniBought: BigNumber, kncBought: BigNumber) {
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
export function getUniAndKncWithETHOrders(context: FactoryAndOperatorsFixture, uniBought: BigNumber, kncBought: BigNumber) {
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

// Generic function to create a 1:1 Order
export function getTokenBWithTokenAOrders(context: FactoryAndOperatorsFixture, amount: BigNumber, tokenA: string, tokenB: string) {
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
export function getUsdcWithUniAndKncOrders(context: FactoryAndOperatorsFixture, uniSold: BigNumber, kncSold: BigNumber) {
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
export function getWethWithUniAndKncOrders(context: FactoryAndOperatorsFixture, uniSold: BigNumber, kncSold: BigNumber) {
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