const addresses = require("./addresses.json")
const axios = require("axios").default
const qs = require("qs")

async function main() {
    const env = "local"
    const NestedFactory = await ethers.getContractFactory("NestedFactory")
    const nestedFactory = await NestedFactory.attach(addresses[env].factory)

    const orders = [
        {
            sellToken: addresses[env].WETH,
            buyToken: addresses[env].DAI,
            sellAmount: ethers.utils.parseEther("0.00003").toString(),
            slippagePercentage: 0.3,
        },
        {
            sellToken: addresses[env].WETH,
            buyToken: addresses[env].MKR,
            sellAmount: ethers.utils.parseEther("0.00001").toString(),
            slippagePercentage: 0.3,
        },
        {
            sellToken: addresses[env].WETH,
            buyToken: addresses[env].BAT,
            sellAmount: ethers.utils.parseEther("0.00002").toString(),
            slippagePercentage: 0.3,
        },
        {
            sellToken: addresses[env].WETH,
            buyToken: addresses[env].WBTC,
            sellAmount: ethers.utils.parseEther("0.00003").toString(),
            slippagePercentage: 0.3,
        },
        {
            sellToken: addresses[env].WETH,
            buyToken: addresses[env].KNC,
            sellAmount: ethers.utils.parseEther("0.000009").toString(),
            slippagePercentage: 0.3,
        },
        {
            sellToken: addresses[env].WETH,
            buyToken: addresses[env].REP,
            sellAmount: ethers.utils.parseEther("0.00005").toString(),
            slippagePercentage: 0.3,
        },
        {
            sellToken: addresses[env].WETH,
            buyToken: addresses[env].USDC,
            sellAmount: ethers.utils.parseEther("0.00002").toString(),
            slippagePercentage: 0.3,
        },
        {
            sellToken: addresses[env].WETH,
            buyToken: addresses[env].ZRX,
            sellAmount: ethers.utils.parseEther("0.00001").toString(),
            slippagePercentage: 0.3,
        },
        {
            sellToken: addresses[env].WETH,
            buyToken: addresses[env].SAI,
            sellAmount: ethers.utils.parseEther("0.00001").toString(),
            slippagePercentage: 0.3,
        },
        {
            sellToken: addresses[env].WETH,
            buyToken: addresses[env].POLY,
            sellAmount: ethers.utils.parseEther("0.00005").toString(),
            slippagePercentage: 0.3,
        },
        {
            sellToken: addresses[env].WETH,
            buyToken: addresses[env].LINK,
            sellAmount: ethers.utils.parseEther("0.00009").toString(),
            slippagePercentage: 0.3,
        },
    ]

    let envPrefix = env === "kovan" ? "kovan." : ""

    let responses = await Promise.all(
        orders.map(async order => axios.get(`https://${envPrefix}api.0x.org/swap/v1/quote?${qs.stringify(order)}`)),
    )

    responses = responses.filter(element => element !== undefined)

    let sellAmounts = []
    let tokenOrders = [{}]

    responses.forEach(response => {
        sellAmounts.push(ethers.BigNumber.from(response.data.sellAmount))
        tokenOrders.push({ token: response.data.buyTokenAddress, callData: response.data.data })
    })
    totalSellAmount = sellAmounts.reduce((p, c) => p.add(c))

    await nestedFactory.create(
        0,
        "",
        "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
        totalSellAmount,
        responses[0].data.to,
        tokenOrders,
        { value: totalSellAmount },
    )

    console.log("NFT created")
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error)
        process.exit(1)
    })
