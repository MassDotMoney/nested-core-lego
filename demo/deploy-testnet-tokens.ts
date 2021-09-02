import { ethers, network } from "hardhat"

import { Contract } from "@ethersproject/contracts"
import IERC20Artifact from "../artifacts/contracts/mocks/MockERC20.sol/MockERC20.json"
import IUniswap02Router from "@uniswap/v2-periphery/build/IUniswapV2Router02.json"
import IUniswapFactory from "@uniswap/v2-core/build/IUniswapV2Factory.json"
import { NetworkName } from "./demo-types"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import addresses from "./addresses.json"
import { appendDecimals } from "../test/helpers"
import { deployERC20 } from "./deploy-erc20"
import fs from "fs"

const env = network.name as NetworkName
const INITIAL_ETH_LIQUIDITY = ethers.utils.parseEther("0.2")
const INITIAL_TOKEN_LIQUIDITY = appendDecimals(200000)

const deployLiquidityPool = async (
    WETH: Contract,
    token: Contract,
    uniswapFactory: Contract,
    uniswapRouter: Contract,
    signer: SignerWithAddress,
) => {
    await uniswapFactory.createPair(WETH.address, token.address)
    console.log("Pair created.")
    const tx1 = await token.approve(uniswapRouter.address, INITIAL_TOKEN_LIQUIDITY)
    await tx1.wait()
    await uniswapRouter.addLiquidityETH(
        token.address,
        INITIAL_TOKEN_LIQUIDITY,
        INITIAL_TOKEN_LIQUIDITY,
        INITIAL_ETH_LIQUIDITY,
        signer.address,
        Math.floor(Date.now() / 1000 + 1000),
        { value: INITIAL_ETH_LIQUIDITY },
    )
    console.log("Liquidity added.")
}

// This deploy a few tokens meant to look like real tokens on testnets
async function main(name: string, symbol: string) {
    if (!name || !symbol) {
        console.error("Missing name or symbol")
        return
    }
    const [owner] = await ethers.getSigners()
    const WETH = new Contract(addresses[env].tokens.WETH, IERC20Artifact.abi, owner)
    const uniswapRouter = new Contract(addresses[env].uniswapRouter, IUniswap02Router.abi, owner)
    const factory = await uniswapRouter.factory()
    const uniswapFactory = new Contract(factory, IUniswapFactory.abi, owner)

    const token = await deployERC20(name, symbol)
    await deployLiquidityPool(WETH, token, uniswapFactory, uniswapRouter, owner)
    ;(addresses[env].tokens as any)[symbol] = token.address
    fs.writeFileSync("./demo/addresses.json", JSON.stringify(addresses, null, 2))
}

main(process.env.NAME, process.env.SYMBOL)
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error)
        process.exit(1)
    })
