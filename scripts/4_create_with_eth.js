const axios = require("axios").default
const qs = require("qs")

const abi = require("./../mocks/ERC20.json")

async function main() {
    const accounts = await ethers.getSigners()

    const NestedFactory = await hre.ethers.getContractFactory("NestedFactory")
    const nestedFactory = await NestedFactory.deploy(accounts[10].address)
    await nestedFactory.deployed()

    // we request quotes for WETH: 
    // we will first wrap ETH and then do the swaps because 0x will wrap ETH for each tokens 

    const tokenToSell = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"; // WETH

    const orders = [{
            sellToken: tokenToSell,
            buyToken: "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984", // Uni
            sellAmount: ethers.utils.parseEther("1").toString(),
            slippagePercentage: 0.05,
        },
        {
            sellToken: tokenToSell,
            buyToken: "0x6b175474e89094c44da98b954eedeac495271d0f", // DAI
            sellAmount: ethers.utils.parseEther("1").toString(),
            slippagePercentage: 0.05,
        },
    ]

    let responses = [];
    const resp1 = await axios.get(`https://api.0x.org/swap/v1/quote?${qs.stringify(orders[0])}`);
    const resp2 = await axios.get(`https://api.0x.org/swap/v1/quote?${qs.stringify(orders[1])}`);

    responses.push(resp1)
    responses.push(resp2);

    let maximumSellAmount = 0;
    let sellAmounts = [];
    let tokensToBuy = [];
    let swapCallData = [];

    sellAmounts.push(ethers.BigNumber.from(responses[0].data.sellAmount));
    tokensToBuy.push(responses[0].data.buyTokenAddress);
    swapCallData.push(responses[0].data.data);
    maximumSellAmount = ethers.BigNumber.from(maximumSellAmount).add(ethers.BigNumber.from(responses[0].data.sellAmount));

    sellAmounts.push(ethers.BigNumber.from(responses[1].data.sellAmount));
    tokensToBuy.push(responses[1].data.buyTokenAddress);
    swapCallData.push(responses[1].data.data);
    maximumSellAmount = ethers.BigNumber.from(maximumSellAmount).add(ethers.BigNumber.from(responses[1].data.sellAmount));

    let totalSellAmount = ethers.BigNumber.from(sellAmounts[0]).add(ethers.BigNumber.from(sellAmounts[1]));
    let expectedFee = totalSellAmount.div(100);

    const uni = new ethers.Contract(orders[0].buyToken, abi, accounts[0])
    const link = new ethers.Contract(orders[1].buyToken, abi, accounts[0])

    await nestedFactory.createFromETH(
        "https://gateway.pinata.cloud/ipfs/QmZWtkWCzfyWeyQXESoVALtcCd9cnfyN3gWFfxgWrzaM1i",
        sellAmounts,
        responses[0].data.to,
        tokensToBuy,
        swapCallData, { value: totalSellAmount.add(expectedFee) }
    )

    await nestedFactory.createFromETH(
        "https://gateway.pinata.cloud/ipfs/QmZWtkWCzfyWeyQXESoVALtcCd9cnfyN3gWFfxgWrzaM1i",
        sellAmounts,
        responses[0].data.to,
        tokensToBuy,
        swapCallData, { value: totalSellAmount.add(expectedFee) }
    )

    let provider = ethers.getDefaultProvider();

    let sellTokenUserBalance = await provider.getBalance(accounts[0].address);
    let sellTokenFactoryBalance = await provider.getBalance(nestedFactory.address);
    let sellTokenReserveBalance = await provider.getBalance(nestedFactory.reserve());
    let sellTokenFeeBalance = await provider.getBalance(accounts[10].address);

    let uniUserBalance = await uni.balanceOf(accounts[0].address);
    let uniFactoryBalance = await uni.balanceOf(nestedFactory.address);
    let uniReserveBalance = await uni.balanceOf(nestedFactory.reserve());
    let uniFeeBalance = await uni.balanceOf(accounts[10].address);

    let linkUserBalance = await link.balanceOf(accounts[0].address);
    let linkFactoryBalance = await link.balanceOf(nestedFactory.address);
    let linkReserveBalance = await link.balanceOf(nestedFactory.reserve());
    let linkFeeBalance = await link.balanceOf(accounts[10].address);

    console.log("Balance of user in ETH is ", ethers.utils.formatEther(sellTokenUserBalance.toString()));
    console.log("Balance of factory in ETH is ", ethers.utils.formatEther(sellTokenFactoryBalance.toString()));
    console.log("Balance of reserve in ETH is ", ethers.utils.formatEther(sellTokenReserveBalance.toString()));
    console.log("Balance of feeTo in ETH is ", ethers.utils.formatEther(sellTokenFeeBalance.toString()));
    console.log('--')

    console.log("Balance of user in UNI is ", ethers.utils.formatEther(uniUserBalance.toString()));
    console.log("Balance of factory in UNI is ", ethers.utils.formatEther(uniFactoryBalance.toString()));
    console.log("Balance of reserve in UNI is ", ethers.utils.formatEther(uniReserveBalance.toString()));
    console.log("Balance of feeTo in UNI is ", ethers.utils.formatEther(uniFeeBalance.toString()));
    console.log('--')

    console.log("Balance of user in LINK is ", ethers.utils.formatEther(linkUserBalance.toString()));
    console.log("Balance of factory in LINK is ", ethers.utils.formatEther(linkFactoryBalance.toString()));
    console.log("Balance of reserve in LINK is ", ethers.utils.formatEther(linkReserveBalance.toString()));
    console.log("Balance of feeTo in LINK is ", ethers.utils.formatEther(linkFeeBalance.toString()));

    let assets = await nestedFactory.tokensOf(accounts[0].address);
    console.log('assets: ', assets);

    for(let i = 0; i < assets.length; i++) {
        let holdings = await nestedFactory.tokenHoldings(assets[i]);
        console.log('holdings token: ', holdings);
    }
    
    // now try to destroy our NFT
    console.log('now destroying our first asset to get all the ERC20s back');
    await nestedFactory.destroy(assets[0]);

    assets = await nestedFactory.tokensOf(accounts[0].address);
    console.log('assets: ', assets);

    let holdings = [];
    for(let i = 0; i < assets.length; i++) {
        holdings = await nestedFactory.tokenHoldings(assets[i]);
        console.log('holdings token: ', holdings);
    }

    // destroy to single ERC20
    // getting 0x quote for each of the tokens
    
    let quotes = [];
    for(let i = 0; i < holdings.length; i++) {
        let holding = holdings[i];
        let order = {
            sellToken: holding.token,
            buyToken: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", // WETH
            sellAmount: holding.amount.toString(),
            slippagePercentage: 0.05,
        }
        let quote = await axios.get(`https://api.0x.org/swap/v1/quote?${qs.stringify(order)}`);
        quotes.push(quote);
    }

    let tokensToSell = [];
    swapCallData = [];

    for(let i = 0; i < quotes.length; i++) {
        tokensToSell.push(quotes[i].data.sellTokenAddress);
        swapCallData.push(quotes[i].data.data);
    }
    console.log('destroying our second asset to get WETH back');

    await nestedFactory.destroyForETH(
        assets[0],
        quotes[0].data.to,
        tokensToSell,
        swapCallData
    )
    
    

    sellTokenUserBalance = await provider.getBalance(accounts[0].address);
    sellTokenFactoryBalance = await provider.getBalance(nestedFactory.address);
    sellTokenReserveBalance = await provider.getBalance(nestedFactory.reserve());
    sellTokenFeeBalance = await provider.getBalance(accounts[10].address);

    uniUserBalance = await uni.balanceOf(accounts[0].address);
    uniFactoryBalance = await uni.balanceOf(nestedFactory.address);
    uniReserveBalance = await uni.balanceOf(nestedFactory.reserve());
    uniFeeBalance = await uni.balanceOf(accounts[10].address);

    linkUserBalance = await link.balanceOf(accounts[0].address);
    linkFactoryBalance = await link.balanceOf(nestedFactory.address);
    linkReserveBalance = await link.balanceOf(nestedFactory.reserve());
    linkFeeBalance = await link.balanceOf(accounts[10].address);

    console.log("Balance of user in ETH is ", ethers.utils.formatEther(sellTokenUserBalance.toString()));
    console.log("Balance of factory in ETH is ", ethers.utils.formatEther(sellTokenFactoryBalance.toString()));
    console.log("Balance of reserve in ETH is ", ethers.utils.formatEther(sellTokenReserveBalance.toString()));
    console.log("Balance of feeTo in ETH is ", ethers.utils.formatEther(sellTokenFeeBalance.toString()));
    console.log('--')

    console.log("Balance of user in UNI is ", ethers.utils.formatEther(uniUserBalance.toString()));
    console.log("Balance of factory in UNI is ", ethers.utils.formatEther(uniFactoryBalance.toString()));
    console.log("Balance of reserve in UNI is ", ethers.utils.formatEther(uniReserveBalance.toString()));
    console.log("Balance of feeTo in UNI is ", ethers.utils.formatEther(uniFeeBalance.toString()));
    console.log('--')

    console.log("Balance of user in LINK is ", ethers.utils.formatEther(linkUserBalance.toString()));
    console.log("Balance of factory in LINK is ", ethers.utils.formatEther(linkFactoryBalance.toString()));
    console.log("Balance of reserve in LINK is ", ethers.utils.formatEther(linkReserveBalance.toString()));
    console.log("Balance of feeTo in LINK is ", ethers.utils.formatEther(linkFeeBalance.toString()));

}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error)
        process.exit(1)
    })