import { appendDecimals, displayHoldings } from "../test/helpers"
import { ethers, network } from "hardhat"
import { pickNFT, readNumber } from "./cli-interaction"

import { BigNumber } from "ethers"
import { NetworkName } from "./demo-types"
import addresses from "./addresses.json"
import axios from "axios"
import qs from "qs"

const main = async () => {
    const env = network.name as NetworkName
    let envPrefix = env === "localhost" ? "ropsten" : env

    const NestedFactory = await ethers.getContractFactory("NestedFactory")
    const nestedFactory = await NestedFactory.attach(addresses[env].factory)

    const nftId = await pickNFT()
    let holdings = await nestedFactory.tokenHoldings(nftId)
    holdings = holdings.filter((holding: any) => holding.isActive && holding.amount.gt(0))

    const budgetUserInput = await readNumber("What is your budget in Ether?")
    const budget = ethers.utils.parseEther(budgetUserInput.toString())

    const sellToken = addresses[env].tokens.WETH

    const holdingValues = (await Promise.all(
        holdings.map(async (holding: any) => {
            if (holding.token == sellToken) return appendDecimals(1)
            const order = {
                sellToken,
                buyToken: holding.token,
                buyAmount: holding.amount.toString(),
            }
            const response: any = await axios.get(
                `https://${envPrefix}.api.0x.org/swap/v1/price?${qs.stringify(order)}`,
            )
            return BigNumber.from(response.data.sellAmount)
        }),
    )) as BigNumber[]

    // get the total value of the holdings in sellToken.
    const totalHoldingsValue = holdingValues.reduce(
        (prev, next) => prev.add(ethers.BigNumber.from(next)),
        ethers.BigNumber.from(0),
    )

    const orders = holdings.map((holding: any, index: number) => {
        const sellAmount = holdingValues[index].mul(budget).div(totalHoldingsValue)

        return {
            sellToken: sellToken,
            buyToken: holding.token,
            sellAmount: sellAmount.toString(),
            slippagePercentage: 0.3,
        }
    })

    let responses: any = await Promise.all(
        orders.map(async (order: any) =>
            axios.get(`https://${envPrefix}.api.0x.org/swap/v1/quote?${qs.stringify(order)}`),
        ),
    )

    let sellAmounts: BigNumber[] = []
    let tokenOrders: any = []

    responses.forEach((response: any) => {
        sellAmounts.push(ethers.BigNumber.from(response.data.sellAmount))
        tokenOrders.push({ token: response.data.buyTokenAddress, callData: response.data.data })
    })
    const totalSellAmount = sellAmounts.reduce((p, c) => p.add(c), ethers.BigNumber.from(0))

    const totalSellAmountWithFees = totalSellAmount.add(totalSellAmount.div(100))
    await nestedFactory.create(
        nftId,
        "",
        "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
        totalSellAmount,
        responses[0].data.to,
        tokenOrders,
        { value: totalSellAmountWithFees.mul(2) },
    )

    console.log("\nNFT replicated\n")
    const replicatedHoldings = await nestedFactory.tokenHoldings(nftId + 1)
    displayHoldings(replicatedHoldings)
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error)
        process.exit(1)
    })
