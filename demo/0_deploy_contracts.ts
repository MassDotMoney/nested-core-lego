import fs from "fs"
import addresses from "./addresses.json"
import { ethers, network } from "hardhat"
import { NetworkName } from "./demo-types"

async function main() {
    const env = network.name as NetworkName
    const accounts = await ethers.getSigners()

    const dev = accounts[0].address
    const nestedTreasury = accounts[1].address
    const nestedBuyBacker = accounts[2].address
    const weth = addresses[env].tokens.WETH

    const nestedTreasuryPart = ethers.BigNumber.from("50")
    const nestedBuyBackerPart = ethers.BigNumber.from("30")
    const royaltiesPartPart = ethers.BigNumber.from("20")

    const FeeSplitter = await ethers.getContractFactory("FeeSplitter")
    const NestedAsset = await ethers.getContractFactory("NestedAsset")
    const NestedRecords = await ethers.getContractFactory("NestedRecords")
    const NestedFactory = await ethers.getContractFactory("NestedFactory")
    const NestedReserve = await ethers.getContractFactory("NestedReserve")

    const feeSplitter = await FeeSplitter.deploy(
        [nestedTreasury, nestedBuyBacker],
        [nestedTreasuryPart, nestedBuyBackerPart],
        royaltiesPartPart,
        weth,
        0,
        0,
    )
    await feeSplitter.deployed()
    const asset = await NestedAsset.deploy()
    await asset.deployed()
    const records = await NestedRecords.deploy()
    await records.deployed()

    const factory = await NestedFactory.deploy(asset.address, records.address, dev, feeSplitter.address, weth)
    await factory.deployed()
    const tx0 = await asset.setFactory(factory.address)
    await tx0.wait()

    const tx1 = await records.setFactory(factory.address)
    await tx1.wait()

    const reserve = await NestedReserve.deploy(factory.address)
    await reserve.deployed()

    await factory.setReserve(reserve.address)

    console.log("Factory address: ", factory.address)
    addresses[env].factory = factory.address
    // write factory address to addresses.json
    fs.writeFileSync("./demo/addresses.json", JSON.stringify(addresses, null, 2))
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error)
        process.exit(1)
    })
