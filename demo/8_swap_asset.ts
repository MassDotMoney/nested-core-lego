import axios, { AxiosResponse } from "axios"
import { ethers, network } from "hardhat"
import { pickHolding, pickNFT, readAmountETH, readNumber, readTokenAddress } from "./cli-interaction"

import { NetworkName } from "./demo-types"
import addresses from "./addresses.json"
import qs from "qs"

async function main() {
    const env = network.name as NetworkName
    const [user] = await ethers.getSigners()

    const NestedFactory = await ethers.getContractFactory("NestedFactory")
    const nestedFactory = await NestedFactory.attach(addresses[env].factory)

    const nftId = await pickNFT()
    const saleHolding = await pickHolding(nftId)

    let orders = []
    const swapCount = await readNumber("How many tokens to add")
    for (let i = parseInt(swapCount); i > 0; i--) {
        const token = await readTokenAddress(`#${i + 1} Enter ERC20 token address (press Enter to stop)`)
        if (!token) break

        const order = {
            sellToken: saleHolding.token,
            buyToken: token,
            sellAmount: saleHolding.amount.div(swapCount).toString(),
            slippagePercentage: 0.3,
        }
        orders.push(order)
    }

    const orderRequests = orders.map(order =>
        axios
            .get(`https://${env === "localhost" ? "ropsten" : env}.api.0x.org/swap/v1/quote?${qs.stringify(order)}`)
            .catch(console.error),
    )
    let responses = ((await Promise.all(orderRequests)) as unknown) as AxiosResponse<any>[]
    responses = responses.filter(r => !!r)
    if (responses.length === 0) return

    const totalSellAmount = responses.reduce(
        (carry, resp) => carry.add(ethers.BigNumber.from(resp.data.sellAmount)),
        ethers.BigNumber.from(0),
    )

    const tx = await nestedFactory.swapTokenForTokens(
        nftId,
        saleHolding.token,
        totalSellAmount,
        responses[0].data.to,
        responses.map(r => ({
            token: r.data.buyTokenAddress,
            callData: r.data.data,
        })),
    )

    console.log("Transaction sent ", tx.hash)
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error)
        process.exit(1)
    })
