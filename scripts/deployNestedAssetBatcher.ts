import hre, { ethers, network } from "hardhat";
import addresses from "../addresses.json";

// Used to add delay between deployment and etherscan verification
const delay = async (ms: number) => new Promise(res => setTimeout(res, ms));

const chainId: string = network.config.chainId.toString();
const context = JSON.parse(JSON.stringify(addresses));

async function main(): Promise<void> {
    console.log("Deploy NestedAssetBatcher : ");

    // Get Addresses
    const nestedAssetAddress = context[chainId].NestedAsset;
    const nestedRecordsAddress = context[chainId].NestedRecords;

    // Get Factories
    const nestedAssetBatcherFactory = await ethers.getContractFactory("NestedAssetBatcher");
    const nestedAssetBatcher = await nestedAssetBatcherFactory.deploy(nestedAssetAddress, nestedRecordsAddress);
    await nestedAssetBatcher.deployed();

    console.log("NestedAssetBatcher Deployer : ", nestedAssetBatcher.address);

    await delay(60000);

    await hre.run("verify:verify", {
        address: nestedAssetBatcher.address,
        constructorArguments: [nestedAssetAddress, nestedRecordsAddress],
    });
}

main()
    .then(() => process.exit(0))
    .catch((error: Error) => {
        console.error(error);
        process.exit(1);
    });
