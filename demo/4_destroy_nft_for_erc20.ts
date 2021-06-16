import { ethers, network } from "hardhat"

import { NetworkName } from "./demo-types"
import addresses from "./addresses.json"
import axios from "axios"
import { pickNFT } from "./cli-interaction"
import qs from "qs"

async function main() {
    const env = network.name as NetworkName

    const NestedFactory = await ethers.getContractFactory("NestedFactory")
    const nestedFactory = await NestedFactory.attach(addresses[env].factory)

    const nftId = await pickNFT()
    const holdings = await nestedFactory.tokenHoldings(1)

    let orders: any[] = []
    holdings.forEach((holding: any) => {
        orders.push({
            sellToken: holdings[0].token,
            buyToken: addresses[env].tokens.WETH,
            sellAmount: holding.amount.toString(),
            slippagePercentage: 0.3,
        })
    })

    let envPrefix = env === "ropsten" ? "ropsten." : ""

    let responses = await Promise.all(
        orders.map(async order => axios.get(`https://${envPrefix}api.0x.org/swap/v1/quote?${qs.stringify(order)}`)),
    )

    responses = responses.filter(element => element !== undefined)
    let tokenOrders: any[] = []

    responses.forEach(response => {
        tokenOrders.push({ token: response.data.buyTokenAddress, callData: response.data.data })
    })

    await nestedFactory.destroyForERC20(nftId, addresses[env].tokens.WETH, responses[0].data.to, tokenOrders)
    console.log("\nNFT destroyed\n")

    //const holdings = await nestedFactory.tokenHoldings(1)
    //console.log("Holdings: ", holdings)
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error)
        process.exit(1)
    })
