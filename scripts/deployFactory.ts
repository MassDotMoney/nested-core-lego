import hre, { ethers, network } from "hardhat";
import { Contract } from "ethers";
import addresses from "../addresses.json";
import { importOperators, registerFlat, registerZeroEx } from "./utils";

interface Deployment {
    name: string;
    address: string;
}

// Used to add delay between deployment and etherscan verification
const delay = async (ms: number) => new Promise(res => setTimeout(res, ms));

const chainId: string = network.config.chainId.toString();
const context = JSON.parse(JSON.stringify(addresses));

// True if you want to enable the etherscan verification
const etherscan = false;

// Configuration variables
const WETH = context[chainId].config.WETH;

async function main(): Promise<void> {
    // Add new proxy/factory with new operators
    const feeSplitterFactory = await ethers.getContractFactory("FeeSplitter");
    const nestedAssetFactory = await ethers.getContractFactory("NestedAsset");
    const nestedRecordsFactory = await ethers.getContractFactory("NestedRecords");
    const operatorResolverFactory = await ethers.getContractFactory("OperatorResolver");
    const nestedFactoryFactory = await ethers.getContractFactory("NestedFactory");
    const nestedReserveFactory = await ethers.getContractFactory("NestedReserve");
    const withdrawerFactory = await ethers.getContractFactory("Withdrawer");

    const feeSplitter = await feeSplitterFactory.attach("0x12a355d004f378eaca8c7caba8ca149b54cedd54");
    const nestedAsset = await nestedAssetFactory.attach("0xf8a8e771aff5ea7c2fabd3953812368491e3ae99");
    const nestedRecords = await nestedRecordsFactory.attach("0x0d320ac0b3475ef93cd41ea895b482484b538f56");
    const nestedReserve = await nestedReserveFactory.attach("0x1734a5eab695d9b7c678adaa9a479dbb88897660");
    const operatorResolver = await operatorResolverFactory.attach("0x743fdf479b8894fc6dd24f92823659934dd30d3f");
    const withdrawer = await withdrawerFactory.attach("0x0384f3b95faa3c2f48c40f15fe8bd8cd1f1f8058");

    // Deploy NestedFactory
    const nestedFactory = await nestedFactoryFactory.deploy(
        nestedAsset.address,
        nestedRecords.address,
        nestedReserve.address,
        feeSplitter.address,
        WETH,
        operatorResolver.address,
        withdrawer.address,
    );

    await nestedFactory.deployed();

    console.log("NestedFactory deployed : ", nestedFactory.address);
    
    // verify Tenderly
    const contracts = [
        {
            name: 'NestedFactory',
            address: nestedFactory.address
        }]
    await hre.tenderly.verify(...contracts);

    // verify etherscan
    if (etherscan) {
        // wait 1 minute (recommended)
        await delay(60000);

        await hre.run("verify:verify", {
            address: nestedFactory.address,
            constructorArguments: [nestedAsset.address,
            nestedRecords.address,
            nestedReserve.address,
            feeSplitter.address,
            WETH,
            operatorResolver.address]
        });
    } 
}

main()
    .then(() => process.exit(0))
    .catch((error: Error) => {
        console.error(error);
        process.exit(1);
    });
