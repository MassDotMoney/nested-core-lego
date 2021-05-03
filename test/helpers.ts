import { ethers } from "hardhat"

export const appendDecimals = (amount: number) => ethers.utils.parseEther(amount.toString())
