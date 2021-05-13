const address = require("./addresses.json")

async function main() {
    const accounts = await ethers.getSigners()

    const dev = accounts[0].address
    const nestedTreasury = accounts[1].address
    const nestedBuyBacker = accounts[2].address
    const weth = address.kovan.WETH

    const nestedTreasuryPart = ethers.BigNumber.from("50")
    const nestedBuyBackerPart = ethers.BigNumber.from("30")
    const royaltiesPartPart = ethers.BigNumber.from("20")

    const FeeSplitter = await hre.ethers.getContractFactory("FeeSplitter")
    const NestedAsset = await hre.ethers.getContractFactory("NestedAsset")
    const NestedRecords = await hre.ethers.getContractFactory("NestedRecords")
    const NestedFactory = await hre.ethers.getContractFactory("NestedFactory")
    const NestedReserve = await hre.ethers.getContractFactory("NestedReserve")

    const feeSplitter = await FeeSplitter.deploy(
        [nestedTreasury, nestedBuyBacker],
        [nestedTreasuryPart, nestedBuyBackerPart],
        royaltiesPartPart,
        weth,
        0,
        0,
    )
    const asset = await NestedAsset.deploy()
    const records = await NestedRecords.deploy()

    await feeSplitter.deployed()
    await asset.deployed()
    await records.deployed()

    const factory = await NestedFactory.deploy(asset.address, records.address, dev, feeSplitter.address, weth)
    await factory.deployed()

    const reserve = await NestedReserve.deploy(factory.address)
    await reserve.deployed()

    await factory.setReserve(reserve.address)

    console.log("Factory address: ", factory.address)
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error)
        process.exit(1)
    })
