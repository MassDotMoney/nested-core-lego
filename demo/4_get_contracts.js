const addresses = require("./addresses.json")

async function main() {
    const env = 'kovan';

    const NestedFactory = await ethers.getContractFactory("NestedFactory")
    const nestedFactory = await NestedFactory.attach(addresses[env].factory)

    const assetAddress = await nestedFactory.nestedAsset();
    const reserveAddress = await nestedFactory.reserve();

    console.log('Nested Factory Contract: ', `https://kovan.etherscan.io/address/${addresses[env].factory}`)
    console.log('Nested Asset Contract: ', `https://kovan.etherscan.io/address/${assetAddress}`)
    console.log('Nested Reserve Contract: ', `https://kovan.etherscan.io/address/${reserveAddress}`)
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error)
        process.exit(1)
    })