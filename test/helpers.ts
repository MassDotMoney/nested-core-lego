import { ethers } from "hardhat"

export const appendDecimals = (amount: number) => ethers.utils.parseEther(amount.toString())

export const getETHSpentOnGas = async (tx: any) => {
    const receipt = await tx.wait()
    return receipt.gasUsed.mul(tx.gasPrice)
}

export const deployNestedLibrary = async () => {
    const nestedLibraryFactory = await ethers.getContractFactory("NestedLibrary")
    return nestedLibraryFactory.deploy()
}
