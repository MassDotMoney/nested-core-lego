import { ethers } from "hardhat"
import { appendDecimals } from "../test/helpers"

export const deployERC20 = async (name: string, symbol: string) => {
    const ERC20Factory = await ethers.getContractFactory("MockERC20")
    return ERC20Factory.deploy(name, symbol, appendDecimals(10000000))
}
