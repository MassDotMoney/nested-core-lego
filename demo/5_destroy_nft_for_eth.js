const addresses = require("./addresses.json")
const axios = require("axios").default
const qs = require("qs")

async function main() {
    const env = hre.network.name

    const NestedFactory = await ethers.getContractFactory("NestedFactory")
    const nestedFactory = await NestedFactory.attach(addresses[env].factory)

    const WethContract = await ethers.getContractFactory("WETH9")
    const wethContract = await WethContract.attach(addresses[env].WETH)

    const holdings = await nestedFactory.tokenHoldings(1)
    
    let orders = []
    holdings.forEach(holding => {
        orders.push({
            sellToken: holdings[0].token,
            buyToken: addresses[env].WETH,
            sellAmount: ethers.BigNumber.from(holdings[0].amount).toString(),
            slippagePercentage: 0.3,
        })
    })

    let envPrefix = env === "kovan" ? "kovan." : ""

    let responses = await Promise.all(
        orders.map(async order => axios.get(`https://${envPrefix}api.0x.org/swap/v1/quote?${qs.stringify(order)}`)),
    )

    responses = responses.filter(element => element !== undefined)
    let tokenOrders = []

    responses.forEach(response => {
        tokenOrders.push({ token: response.data.buyTokenAddress, callData: response.data.data })
    })

    await nestedFactory.destroyForETH(1, responses[0].data.to, tokenOrders)
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
