const axios = require("axios").default
const qs = require("qs")

const abi = require("./../mocks/ERC20.json")

async function main() {
    const accounts = await ethers.getSigners()

    const NestedFactory = await hre.ethers.getContractFactory("NestedFactory")
    const nestedFactory = await NestedFactory.deploy(accounts[10].address)
    await nestedFactory.deployed()

    const tokenToSell = "ETH"; // ETH for 0x

    const orders = [{
            sellToken: tokenToSell,
            buyToken: "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984", // Uni
            sellAmount: ethers.utils.parseEther("1").toString(),
        },
        {
            sellToken: tokenToSell,
            buyToken: "0x6b175474e89094c44da98b954eedeac495271d0f", // DAI
            sellAmount: ethers.utils.parseEther("1").toString(),
        },
    ]

    let responses = [];
    const resp1 = await axios.get(`https://api.0x.org/swap/v1/quote?${qs.stringify(orders[0])}`);
    const resp2 = await axios.get(`https://api.0x.org/swap/v1/quote?${qs.stringify(orders[1])}`);

    responses.push(resp1)
    responses.push(resp2);

    let sellAmounts = [];
    let tokensToBuy = [];
    let swapCallData = [];

    sellAmounts.push(ethers.BigNumber.from(responses[0].data.sellAmount));
    tokensToBuy.push(responses[0].data.buyTokenAddress);
    swapCallData.push(responses[0].data.data);

    sellAmounts.push(ethers.BigNumber.from(responses[1].data.sellAmount));
    tokensToBuy.push(responses[1].data.buyTokenAddress);
    swapCallData.push(responses[1].data.data);

    let totalSellAmount = ethers.BigNumber.from(sellAmounts[0]).add(ethers.BigNumber.from(sellAmounts[1]));

    const uni = new ethers.Contract(orders[0].buyToken, abi, accounts[0])
    const link = new ethers.Contract(orders[1].buyToken, abi, accounts[0])

    await nestedFactory.createFromETH(
        sellAmounts,
        responses[0].data.to,
        tokensToBuy,
        swapCallData,
        {value: totalSellAmount}
    )

    const uniUserBalance = await uni.balanceOf(accounts[0].address);
    const uniFactoryBalance = await uni.balanceOf(nestedFactory.address);
    const uniReserveBalance = await uni.balanceOf(nestedFactory.reserve());
    const uniFeeBalance = await uni.balanceOf(accounts[10].address);

    const linkUserBalance = await link.balanceOf(accounts[0].address);
    const linkFactoryBalance = await link.balanceOf(nestedFactory.address);
    const linkReserveBalance = await link.balanceOf(nestedFactory.reserve());
    const linkFeeBalance = await link.balanceOf(accounts[10].address);

    console.log("Balance of user in UNI is ", uniUserBalance.toString());
    console.log("Balance of factory in UNI is ", uniFactoryBalance.toString());
    console.log("Balance of reserve in UNI is ", uniReserveBalance.toString());
    console.log("Balance of feeTo in UNI is ", uniFeeBalance.toString());
    console.log('--')
    console.log("Balance of user in DAI is ", linkUserBalance.toString());
    console.log("Balance of factory in DAI is ", linkFactoryBalance.toString());
    console.log("Balance of reserve in DAI is ", linkReserveBalance.toString());
    console.log("Balance of feeTo in DAI is ", linkFeeBalance.toString());

    let result = await nestedFactory.tokensOf(accounts[0].address);
    console.log('result', result);

    let holdings = await nestedFactory.tokenHoldings(result[0]);
    console.log('holdings', holdings);

}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error)
        process.exit(1)
    })