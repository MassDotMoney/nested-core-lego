import { ethers, network } from "hardhat"

import IUniswap02Factory from "@uniswap/v2-core/build/IUniswapV2Factory.json"
import IUniswap02Pair from "@uniswap/v2-core/build/IUniswapV2Pair.json"
import { NetworkName } from "./demo-types"
import addresses from "./addresses.json"

const env = network.name as NetworkName

const showTokenLiquidity = async (key: string, token: string) => {
    const [signer] = await ethers.getSigners()
    const factory = new ethers.Contract(addresses[env].uniswapFactory, IUniswap02Factory.abi, signer)
    const pairAddress = await factory.getPair(addresses[env].tokens.WETH, token)
    const pair = new ethers.Contract(pairAddress, IUniswap02Pair.abi, signer)
    const reserves = await pair.getReserves()
    const token0 = await pair.token0()
    let tokenReserve = reserves.reserve1
    let ETH = reserves.reserve0
    if (token0 === token) {
        tokenReserve = reserves.reserve0
        ETH = reserves.reserve1
    }
    console.log(`ETH: ${ethers.utils.formatEther(ETH)}, ${key}: ${ethers.utils.formatEther(tokenReserve)}`)
}

const main = async () => {
    for (const token of Object.keys(addresses[env].tokens)) {
        if (token === "WETH") continue
        await showTokenLiquidity(token, (addresses[env].tokens as any)[token])
    }
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error)
        process.exit(1)
    })
