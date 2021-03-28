const axios = require("axios").default
const qs = require("qs")

const abi = require("./../mocks/ERC20")

async function main() {
    const accounts = await ethers.getSigners()

    const NestedFactory = await hre.ethers.getContractFactory("NestedFactory")
    const nestedFactory = await NestedFactory.deploy(accounts[1].address)
    await nestedFactory.deployed()

    const tokenToSell = process.env.ERC20_CONTRACT_ADDRESS;

    const orders = [{
            sellToken: tokenToSell,
            buyToken: "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984", // Uni
            buyAmount: ethers.utils.parseEther("5").toString(),
        },
        {
            sellToken: tokenToSell,
            buyToken: "0x514910771af9ca656af840dff83e8264ecf986ca", // LINK
            buyAmount: ethers.utils.parseEther("3").toString(),
        },
    ]

    const tokensToTransfer = [process.env.ERC20_CONTRACT_ADDRESS];
    const amountsToTransfer = [ethers.parseEther(1).toString()];

    const responses = orders.map(async(order) => {
        await axios.get(`https://api.0x.org/swap/v1/quote?${qs.stringify(order)}`)
    })

    let maximumSellAmount = 0;
    let tokensToBuy = [];
    let swapCallData = [];
    let tokensToTransfer = [];
    let amountsToTransfer = [];

    responses.forEach((response) => {
        maximumSellAmount += response.data.sellAmount;
        tokensToBuy.push(response.data.tokensToBuy);
        swapCallData.push(response.data.swapCallData);
    })

    const tokenToSellContract = new ethers.Contract(tokenToSell, abi, accounts[0])
    await tokenToSellContract.transfer(nestedFactory.address, ethers.utils.parseEther("50"))

    await nestedFactory.create(
        sellToken,
        maximumSellAmount,
        responses[0].data.allowanceTarget,
        responses[0].data.to,
        tokensToBuy,
        swapCallData,
        tokensToTransfer,
        amountsToTransfer
    )
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error)
        process.exit(1)
    })