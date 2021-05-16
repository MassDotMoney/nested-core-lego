const addresses = require("./addresses.json")
const axios = require("axios").default
const qs = require("qs")

const main = async () => {
    const env = hre.network.name

    const NestedFactory = await ethers.getContractFactory("NestedFactory")
    const nestedFactory = await NestedFactory.attach(addresses[env].factory)

    let holdings = await nestedFactory.tokenHoldings(1)

    const budget = ethers.BigNumber.from("1")
    const sellToken = address[env].USDC

    // get the total value of the holdings in sellToken.
    const totalHoldingsValue = holdings.reduce((prev, next) => {
        // call to 0x to get rate holding token / sell token
        // compute holding value in sell token value
        // add to sum
    })

    const orders = holdings.map(holding => {
        return {
            sellToken: sellToken,
            buyToken: holding[0],
            buyAmount: holding[1].mul(budget).div(totalHoldingsValue).toString(),
            slippagePercentage: 0.3,
        }
    })

    let envPrefix = env === "kovan" ? "kovan." : ""

    let responses = await Promise.all(
        orders.map(async order => axios.get(`https://${envPrefix}api.0x.org/swap/v1/quote?${qs.stringify(order)}`)),
    )

    responses = responses.filter(element => element !== undefined)

    let sellAmounts = []
    let tokenOrders = []

    responses.forEach(response => {
        sellAmounts.push(ethers.BigNumber.from(response.data.sellAmount))
        tokenOrders.push({ token: response.data.buyTokenAddress, callData: response.data.data })
    })
    totalSellAmount = sellAmounts.reduce((p, c) => p.add(c))

    const totalSellAmountWithFees = totalSellAmount.add(totalSellAmount.div(100))

    await nestedFactory.create(
        1,
        "",
        "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
        totalSellAmount,
        responses[0].data.to,
        tokenOrders,
        { value: totalSellAmountWithFees },
    )

    console.log("\nNFT replicated\n")

    console.log("Holdings: ", holdings)
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error)
        process.exit(1)
    })
