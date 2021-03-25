const axios = require('axios').default;
const qs = require('qs');

async function main() {
    const accounts = await ethers.getSigners();
    // Get the Factory contract to deploy
    const NestedFactory = await hre.ethers.getContractFactory("NestedFactory");
    // Deploy the Nested factory, and allow the first account to choose which address will collect fees
    const nestedFactory = await NestedFactory.deploy(accounts[0].address);
    // Wait that the contract is deployed
    await nestedFactory.deployed();
    const params = {
        buyToken: 'WETH',
        sellToken: 'DAI',
        buyAmount: ethers.utils.parseEther("10").toString(),
    }
    const response = await axios.get(
        `https://api.0x.org/swap/v1/quote?${qs.stringify(params)}`
    )
    const { sellTokenAddress, buyTokenAddress, allowanceTarget, to, data } = response.data;
    await nestedFactory.swapTokens(sellTokenAddress, buyTokenAddress, allowanceTarget, to, data);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });