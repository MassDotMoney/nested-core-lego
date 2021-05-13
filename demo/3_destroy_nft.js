const addresses = require("./addresses.json")

async function main() {
    const accounts = await ethers.getSigners()
    const env = 'kovan';

    const NestedFactory = await ethers.getContractFactory("NestedFactory")
    const nestedFactory = await NestedFactory.attach(addresses[env].factory)

    let assets = await nestedFactory.tokensOf(accounts[0].address);

    if (assets.length > 0) {
        console.log('Burning last created NFT and redeeming underlying assets.');
        await nestedFactory.destroy(assets[assets.length - 1]);
    } else {
        console.log('No token found for user')
    }
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error)
        process.exit(1)
    })