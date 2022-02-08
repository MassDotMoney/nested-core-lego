import { FlatOperator, NestedFactory, OperatorResolver, ZeroExOperator } from '../typechain';
import * as ethers from 'ethers';
import * as w3utils from "web3-utils";

interface Op {
    /** Operator name */
    name: string;
    /** Human readable signature (ex: "function transfer(address to, uint amount)") */
    signature: string;
    /** Target contract address */
    contract: string;
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
