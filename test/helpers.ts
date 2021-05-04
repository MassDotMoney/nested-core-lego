import { ethers } from "hardhat"

export const appendDecimals = (amount: number) => ethers.utils.parseEther(amount.toString())

export const getTxGasSpent = async tx => {
    const receipt = await tx.wait()
    return receipt.gasUsed.mul(tx.gasPrice)
}
