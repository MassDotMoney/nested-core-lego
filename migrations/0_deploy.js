async function main() {
    const accounts = await ethers.getSigners()

    const FeeSplitter = await hre.ethers.getContractFactory("FeeSplitter")
    const NestedFactory = await hre.ethers.getContractFactory("NestedFactory")
    const NestedAsset = await hre.ethers.getContractFactory("NestedAsset")
    const NestedReserve = await hre.ethers.getContractFactory("NestedReserve")

    const dev = accounts[0].address
    const weth = accounts[1].address
    const nestedTreasury = accounts[2].address

    // Deploy FeeSlitter
    const feeSplitter = await FeeSplitter.deploy([nestedTreasury], [80], 20)
    await feeSplitter.deployed()

    // Deploy Asset
    const nestedAsset = await NestedAsset.deploy()
    await nestedAsset.deployed()

    // Deploy Factory
    const nestedFactory = await NestedFactory.deploy(nestedAsset.address, dev, feeSplitter.address, weth)
    await nestedFactory.deployed()

    // Deploy the Reserve associated to the factory
    const nestedReserve = await NestedReserve.deploy(nestedFactory.address)
    await nestedReserve.deployed()

    // Link the Factory to the reserve
    await nestedFactory.setReserve(nestedReserve.address)

    // Link the Factory to the Asset
    await nestedAsset.setFactory(nestedFactory.address)

    // TODO: uncomment once the NestedRecords is merged:
    // const NestedRecords = await hre.ethers.getContractFactory("NestedRecords");
    // const nestedRecords = await NestedRecords.deploy();
    // await nestedRecords.deployed();
    // await nestedRecords.setFactory(nestedFactory.address)
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error)
        process.exit(1)
    })
