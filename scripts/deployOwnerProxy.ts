import hre, { ethers, network } from "hardhat";
import addresses from "../addresses.json";

// Used to add delay between deployment and etherscan verification
const delay = async (ms: number) => new Promise(res => setTimeout(res, ms));

const chainId: string = network.config.chainId.toString();
const context = JSON.parse(JSON.stringify(addresses));

async function main(): Promise<void> {
    const timelockAddress = context[chainId].Timelock;
    const feeSplitterAddress = context[chainId].FeeSplitter;
    const nestedAssetAddress = context[chainId].NestedAsset;
    const nestedRecordsAddress = context[chainId].NestedRecords;
    const nestedReserveAddress = context[chainId].NestedReserve;
    const operatorResolverAddress = context[chainId].OperatorResolver;
    const nestedFactoryAddress = context[chainId].NestedFactoryProxy;
    const zeroExStorageAddress = context[chainId].ZeroExStorage;

    // Get factories
    const ownerProxyFactory = await ethers.getContractFactory("OwnerProxy");
    const feeSplitterFactory = await ethers.getContractFactory("FeeSplitter");
    const nestedAssetFactory = await ethers.getContractFactory("NestedAsset");
    const nestedRecordsFactory = await ethers.getContractFactory("NestedRecords");
    const nestedReserveFactory = await ethers.getContractFactory("NestedReserve");
    const operatorResolverFactory = await ethers.getContractFactory("OperatorResolver");
    const nestedFactoryFactory = await ethers.getContractFactory("NestedFactory");
    const zeroExStorageFactory = await ethers.getContractFactory("ZeroExStorage");

    // Get contracts
    const feeSplitter = await feeSplitterFactory.attach(feeSplitterAddress);
    const nestedAsset = await nestedAssetFactory.attach(nestedAssetAddress);
    const nestedRecords = await nestedRecordsFactory.attach(nestedRecordsAddress);
    const nestedReserve = await nestedReserveFactory.attach(nestedReserveAddress);
    const operatorResolver = await operatorResolverFactory.attach(operatorResolverAddress);
    const nestedFactory = await nestedFactoryFactory.attach(nestedFactoryAddress);
    const zeroExStorage = await zeroExStorageFactory.attach(zeroExStorageAddress);

    console.log("Deploy OwnerProxy : ");

    // Deploy OwnerProxy
    const ownerProxy = await ownerProxyFactory.deploy();
    await ownerProxy.deployed();
    console.log("OwnerProxy Deployed : ", ownerProxy.address);

    // Transfer ownerships
    let tx = await ownerProxy.transferOwnership(timelockAddress);
    await tx.wait();
    console.log("OwnerProxy ownership transfered to Timelock");

    tx = await feeSplitter.transferOwnership(ownerProxy.address);
    await tx.wait();
    console.log("FeeSplitter ownership transfered to OwnerProxy");

    tx = await nestedAsset.transferOwnership(ownerProxy.address);
    await tx.wait();
    console.log("NestedAsset ownership transfered to OwnerProxy");

    tx = await nestedRecords.transferOwnership(ownerProxy.address);
    await tx.wait();
    console.log("NestedRecords ownership transfered to OwnerProxy");

    tx = await nestedReserve.transferOwnership(ownerProxy.address);
    await tx.wait();
    console.log("NestedReserve ownership transfered to OwnerProxy");

    tx = await operatorResolver.transferOwnership(ownerProxy.address);
    await tx.wait();
    console.log("OperatorResolver ownership transfered to OwnerProxy");

    tx = await nestedFactory.transferOwnership(ownerProxy.address);
    await tx.wait();
    console.log("NestedFactory ownership transfered to OwnerProxy");

    tx = await zeroExStorage.transferOwnership(ownerProxy.address);
    await tx.wait();
    console.log("ZeroExStorage ownership transfered to OwnerProxy");

    // Verify OwnerProxy on etherscan
    await delay(60000);
    await hre.run("verify:verify", {
        address: ownerProxy.address,
        constructorArguments: [],
    });
}

main()
    .then(() => process.exit(0))
    .catch((error: Error) => {
        console.error(error);
        process.exit(1);
    });
