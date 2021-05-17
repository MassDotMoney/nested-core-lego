const addresses = require("./addresses.json")
const axios = require("axios").default
const qs = require("qs")

async function main() {
    const env = hre.network.name

    const NestedFactory = await ethers.getContractFactory("NestedFactory")
    const nestedFactory = await NestedFactory.attach(addresses[env].factory)

    const WethContract = await ethers.getContractFactory("WETH9")
    const wethContract = await WethContract.attach(addresses[env].tokens.WETH)

    const orders = [
        {
            sellToken: addresses[env].tokens.WETH,
            buyToken: addresses[env].tokens.DAI,
            sellAmount: ethers.utils.parseEther("0.00003").toString(),
            slippagePercentage: 0.3,
        },
        {
            sellToken: addresses[env].tokens.WETH,
            buyToken: addresses[env].tokens.MKR,
            sellAmount: ethers.utils.parseEther("0.00001").toString(),
            slippagePercentage: 0.3,
        },
        {
            sellToken: addresses[env].tokens.WETH,
            buyToken: addresses[env].tokens.BAT,
            sellAmount: ethers.utils.parseEther("0.00002").toString(),
            slippagePercentage: 0.3,
        },
        {
            sellToken: addresses[env].tokens.WETH,
            buyToken: addresses[env].tokens.WBTC,
            sellAmount: ethers.utils.parseEther("0.00003").toString(),
            slippagePercentage: 0.3,
        },
        {
            sellToken: addresses[env].tokens.WETH,
            buyToken: addresses[env].tokens.KNC,
            sellAmount: ethers.utils.parseEther("0.000009").toString(),
            slippagePercentage: 0.3,
        },
        {
            sellToken: addresses[env].tokens.WETH,
            buyToken: addresses[env].tokens.REP,
            sellAmount: ethers.utils.parseEther("0.00005").toString(),
            slippagePercentage: 0.3,
        },
        {
            sellToken: addresses[env].tokens.WETH,
            buyToken: addresses[env].tokens.USDC,
            sellAmount: ethers.utils.parseEther("0.00002").toString(),
            slippagePercentage: 0.3,
        },
        {
            sellToken: addresses[env].tokens.WETH,
            buyToken: addresses[env].tokens.ZRX,
            sellAmount: ethers.utils.parseEther("0.00001").toString(),
            slippagePercentage: 0.3,
        },
        {
            sellToken: addresses[env].tokens.WETH,
            buyToken: addresses[env].tokens.SAI,
            sellAmount: ethers.utils.parseEther("0.00001").toString(),
            slippagePercentage: 0.3,
        },
        {
            sellToken: addresses[env].tokens.WETH,
            buyToken: addresses[env].tokens.POLY,
            sellAmount: ethers.utils.parseEther("0.00005").toString(),
            slippagePercentage: 0.3,
        },
        {
            sellToken: addresses[env].tokens.WETH,
            buyToken: addresses[env].tokens.LINK,
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
    let tokenOrders = []

    responses.forEach(response => {
        sellAmounts.push(ethers.BigNumber.from(response.data.sellAmount))
        tokenOrders.push({ token: response.data.buyTokenAddress, callData: response.data.data })
    })
    totalSellAmount = sellAmounts.reduce((p, c) => p.add(c))

    const totalSellAmountWithFees = totalSellAmount.add(totalSellAmount.div(100))

    await wethContract.deposit({ value: totalSellAmountWithFees })
    await wethContract.approve(nestedFactory.address, totalSellAmountWithFees)

    await nestedFactory.create(0, "", addresses[env].tokens.WETH, totalSellAmount, responses[0].data.to, tokenOrders)

    console.log("\nNFT created\n")

    const holdings = await nestedFactory.tokenHoldings(1)
    console.log("Holdings: ", holdings)
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error)
        process.exit(1)
    })
