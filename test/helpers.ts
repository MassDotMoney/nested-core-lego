import { ethers } from "hardhat"

export const appendDecimals = (amount: number) => ethers.utils.parseEther(amount.toString())

export const getETHSpentOnGas = async (tx: any) => {
    const receipt = await tx.wait()
    return receipt.gasUsed.mul(tx.gasPrice)
}

export const displayHoldings = (holdings: any[]) => {
    console.log("Holdings: ")
    holdings.forEach(holding => console.log(holding.token + " " + ethers.utils.formatEther(holding.amount)))
}

export const getTokenName = (address: string, tokens: Record<string, string>) =>
    Object.entries(tokens).find(([_, value]) => value === address)?.[0] || "???"
