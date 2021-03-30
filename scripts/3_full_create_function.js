const axios = require("axios").default
const qs = require("qs")

const abi = require("./../mocks/ERC20.json")

async function main() {
    const accounts = await ethers.getSigners()

    const NestedFactory = await hre.ethers.getContractFactory("NestedFactory")
    const nestedFactory = await NestedFactory.deploy(accounts[10].address)
    await nestedFactory.deployed()

    const tokenToSell = process.env.ERC20_CONTRACT_ADDRESS;

    const orders = [{
            sellToken: tokenToSell,
            buyToken: "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984", // Uni
            buyAmount: ethers.utils.parseEther("2").toString(),
        },
        {
            sellToken: tokenToSell,
            buyToken: "0xdd974d5c2e2928dea5f71b9825b8b646686bd200", // KNC
            buyAmount: ethers.utils.parseEther("1").toString(),
        },
    ]

    let responses = [];
    const resp1 = await axios.get(`https://api.0x.org/swap/v1/quote?${qs.stringify(orders[0])}`);
    const resp2 = await axios.get(`https://api.0x.org/swap/v1/quote?${qs.stringify(orders[1])}`);

    responses.push(resp1)
    responses.push(resp2);

    let maximumSellAmount = 0;
    let tokensToBuy = [];
    let swapCallData = [];

    maximumSellAmount = ethers.BigNumber.from(maximumSellAmount).add(ethers.BigNumber.from(responses[0].data.sellAmount));
    tokensToBuy.push(responses[0].data.buyTokenAddress);
    swapCallData.push(responses[0].data.data);

    maximumSellAmount = ethers.BigNumber.from(maximumSellAmount).add(ethers.BigNumber.from(responses[1].data.sellAmount));
    tokensToBuy.push(responses[1].data.buyTokenAddress);
    swapCallData.push(responses[1].data.data);

    const tokenToSellContract = new ethers.Contract(tokenToSell, abi, accounts[0])
    await tokenToSellContract.approve(nestedFactory.address, ethers.utils.parseEther("100"))

    const uni = new ethers.Contract(orders[0].buyToken, abi, accounts[0])
    const link = new ethers.Contract(orders[1].buyToken, abi, accounts[0])

    await nestedFactory.create(
        tokenToSell,
        maximumSellAmount,
        responses[0].data.to,
        tokensToBuy,
        swapCallData
    )

    const sellTokenUserBalance = await tokenToSellContract.balanceOf(accounts[0].address);
    const sellTokenFactoryBalance = await tokenToSellContract.balanceOf(nestedFactory.address);
    const sellTokenFeeBalance = await tokenToSellContract.balanceOf(accounts[10].address);

    const uniUserBalance = await uni.balanceOf(accounts[0].address);
    const uniFactoryBalance = await uni.balanceOf(nestedFactory.address);
    const uniFeeBalance = await uni.balanceOf(accounts[10].address);

    const linkUserBalance = await link.balanceOf(accounts[0].address);
    const linkFactoryBalance = await link.balanceOf(nestedFactory.address);
    const linkFeeBalance = await link.balanceOf(accounts[10].address);

    console.log("Balance of user in sell token is ", sellTokenUserBalance.toString());
    console.log("Balance of factory in sell token is ", sellTokenFactoryBalance.toString());
    console.log("Balance of feeTo in sell token is ", sellTokenFeeBalance.toString());
    console.log('--')
    console.log("Balance of user in UNI is ", uniUserBalance.toString());
    console.log("Balance of factory in UNI is ", uniFactoryBalance.toString());
    console.log("Balance of feeTo in UNI is ", uniFeeBalance.toString());
    console.log('--')
    console.log("Balance of user in LINK is ", linkUserBalance.toString());
    console.log("Balance of factory in LINK is ", linkFactoryBalance.toString());
    console.log("Balance of feeTo in LINK is ", linkFeeBalance.toString());

}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error)
        process.exit(1)
    })