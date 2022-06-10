import { ethers } from "hardhat";
import { BigNumber, Wallet } from "ethers";
import { string } from "hardhat/internal/core/params/argumentTypes";
const w3utils = require("web3-utils");
const abiCoder = new ethers.utils.AbiCoder();

export const appendDecimals = (amount: number) => ethers.utils.parseEther(amount.toString());
export const append6Decimals = (amount: number) => { return BigNumber.from(amount).mul(10 ** 6) }; // needed for EURT that has 6 decimals

export const getETHSpentOnGas = async (tx: any) => {
    const receipt = await tx.wait();
    return receipt.gasUsed.mul(tx.gasPrice);
};

export const getTokenName = (address: string, tokens: Record<string, string>) =>
    Object.entries(tokens).find(([_, value]) => value === address)?.[0] || "???";

export const BIG_NUMBER_ZERO = BigNumber.from(0);
export const UINT256_MAX = BigNumber.from(2).pow(256).sub(1);

export const toBytes32 = (key: string) => w3utils.rightPad(w3utils.asciiToHex(key), 64);
export const fromBytes32 = (key: string) => w3utils.hexToAscii(key);

export function getExpectedFees(amount: BigNumber) {
    return amount.div(100);
}

export const setAllowance = async (signer: Wallet, contract: string, spender: string, amount: BigNumber) => {
    const data =
        ethers.utils.keccak256(
            ethers.utils.toUtf8Bytes("approve(address,uint256)")
        ).slice(0, 10) +
        abiCoder.encode(
            ["address", "uint256"],
            [spender, amount]
        ).slice(2, 130)

    await signer.sendTransaction({
        to: contract,
        data: data
    })
}
