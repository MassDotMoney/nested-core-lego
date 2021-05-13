const addresses = require("./addresses.json")
const abi = require("../mocks/ERC20.json")

const main = async() => {
    const accounts = await ethers.getSigners()
    const env = 'kovan'

    const NestedFactory = await ethers.getContractFactory("NestedFactory")
    const nestedFactory = await NestedFactory.attach(addresses[env].factory)

    const dai = new ethers.Contract(addresses[env].DAI, abi, accounts[0])
    const mkr = new ethers.Contract(addresses[env].MKR, abi, accounts[0])
    const weth = new ethers.Contract(addresses[env].WETH, abi, accounts[0])
    const rpl = new ethers.Contract(addresses[env].RPL, abi, accounts[0])

    const provider = ethers.getDefaultProvider();
    const ethBalance = await provider.getBalance(accounts[0].address);
    const feeCollector = await nestedFactory.feeTo();

    const rplUserBalance = await rpl.balanceOf(accounts[0].address);
    const rplFactoryBalance = await rpl.balanceOf(nestedFactory.address);
    const rplReserveBalance = await rpl.balanceOf(nestedFactory.reserve());
    const rplFeeBalance = await rpl.balanceOf(feeCollector);

    const daiUserBalance = await dai.balanceOf(accounts[0].address);
    const daiFactoryBalance = await dai.balanceOf(nestedFactory.address);
    const daiReserveBalance = await dai.balanceOf(nestedFactory.reserve());
    const daiFeeBalance = await dai.balanceOf(feeCollector);

    const mkrUserBalance = await mkr.balanceOf(accounts[0].address);
    const mkrFactoryBalance = await mkr.balanceOf(nestedFactory.address);
    const mkrReserveBalance = await mkr.balanceOf(nestedFactory.reserve());
    const mkrFeeBalance = await mkr.balanceOf(feeCollector);

    const wethUserBalance = await weth.balanceOf(accounts[0].address);
    const wethFactoryBalance = await weth.balanceOf(nestedFactory.address);
    const wethReserveBalance = await weth.balanceOf(nestedFactory.reserve());
    const wethFeeBalance = await weth.balanceOf(feeCollector);

    console.log("--------------------------------------------------------")
    console.log("Balance of user in ETH is ", ethers.utils.formatEther(ethBalance));
    console.log('-')
    console.log("Balance of user in RPL is ", ethers.utils.formatEther(rplUserBalance));
    console.log("Balance of factory in RPL is ", ethers.utils.formatEther(rplFactoryBalance));
    console.log("Balance of reserve in RPL is ", ethers.utils.formatEther(rplReserveBalance));
    console.log("Balance of feeTo in RPL is ", ethers.utils.formatEther(rplFeeBalance));
    console.log('--')
    console.log("Balance of user in DAI is ", ethers.utils.formatEther(daiUserBalance));
    console.log("Balance of factory in DAI is ", ethers.utils.formatEther(daiFactoryBalance));
    console.log("Balance of reserve in DAI is ", ethers.utils.formatEther(daiReserveBalance));
    console.log("Balance of feeTo in DAI is ", ethers.utils.formatEther(daiFeeBalance));
    console.log('--')
    console.log("Balance of user in MKR is ", ethers.utils.formatEther(mkrUserBalance));
    console.log("Balance of factory in MKR is ", ethers.utils.formatEther(mkrFactoryBalance));
    console.log("Balance of reserve in MKR is ", ethers.utils.formatEther(mkrReserveBalance));
    console.log("Balance of feeTo in MKR is ", ethers.utils.formatEther(mkrFeeBalance));
    console.log('--')
    console.log("Balance of user in WETH is ", ethers.utils.formatEther(wethUserBalance));
    console.log("Balance of factory in WETH is ", ethers.utils.formatEther(wethFactoryBalance));
    console.log("Balance of reserve in WETH is ", ethers.utils.formatEther(wethReserveBalance));
    console.log("Balance of feeTo in WETH is ", ethers.utils.formatEther(wethFeeBalance));
    console.log('------')
    let userTokens = await nestedFactory.tokensOf(accounts[0].address);
    const resultFormatted = userTokens.map((e) => e.toString());
    console.log('NFTs owned by user', resultFormatted);
    console.log(userTokens)

    userTokens.forEach(async(tokenId) => {
        await displayHoldings(tokenId)
    });
}

const displayHoldings = async(tokenId) => {
    console.log(tokenId)
    const holdings = await nestedFactory.tokenHoldings(tokenId)
    holdings.forEach((holding) => {
        console.log(holding)
    })
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error)
        process.exit(1)
    })