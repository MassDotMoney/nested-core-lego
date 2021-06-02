const addresses = require("./addresses.json")

async function main() {
    const env = hre.network.name

    const NestedFactory = await ethers.getContractFactory("NestedFactory")
    const nestedFactory = await NestedFactory.attach(addresses[env].factory)

    const assetAddress = await nestedFactory.nestedAsset()
    const reserveAddress = await nestedFactory.reserve()
    const recordsAddress = await nestedFactory.nestedRecords()
    const feeSplitterAddress = await nestedFactory.feeTo()

    if (env === "kovan") {
        console.log("Nested Factory Contract: ", `https://kovan.etherscan.io/address/${addresses[env].factory}`)
        console.log("Nested Asset Contract: ", `https://kovan.etherscan.io/address/${assetAddress}`)
        console.log("Nested Reserve Contract: ", `https://kovan.etherscan.io/address/${reserveAddress}`)
        console.log("Nested Records Contract: ", `https://kovan.etherscan.io/address/${recordsAddress}`)
        console.log("Fee Splitter Contract: ", `https://kovan.etherscan.io/address/${feeSplitterAddress}`)
    } else {
        console.log("Nested Factory Contract: ", addresses[env].factory)
        console.log("Nested Asset Contract: ", assetAddress)
        console.log("Nested Reserve Contract: ", reserveAddress)
        console.log("Nested Records Contract: ", recordsAddress)
        console.log("Fee Splitter Contract: ", feeSplitterAddress)
    }
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error)
        process.exit(1)
    })
