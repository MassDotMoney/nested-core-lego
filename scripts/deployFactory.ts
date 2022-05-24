import hre, { ethers, network } from "hardhat";
import addresses from "../addresses.json";

// Used to add delay between deployment and etherscan verification
const delay = async (ms: number) => new Promise(res => setTimeout(res, ms));

const chainId: string = network.config.chainId.toString();
const context = JSON.parse(JSON.stringify(addresses));

// True if you want to enable the etherscan verification
const etherscan = true;

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

    const feeSplitter = await feeSplitterFactory.attach("");
    const nestedAsset = await nestedAssetFactory.attach("");
    const nestedRecords = await nestedRecordsFactory.attach("");
    const nestedReserve = await nestedReserveFactory.attach("");
    const operatorResolver = await operatorResolverFactory.attach("");
    const withdrawer = await withdrawerFactory.attach("");

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
            name: "NestedFactory",
            address: nestedFactory.address,
        },
    ];
    await hre.tenderly.verify(...contracts);

    // verify etherscan
    if (etherscan) {
        // wait 1 minute (recommended)
        await delay(60000);

        await hre.run("verify:verify", {
            address: nestedFactory.address,
            constructorArguments: [
                nestedAsset.address,
                nestedRecords.address,
                nestedReserve.address,
                feeSplitter.address,
                WETH,
                operatorResolver.address,
                withdrawer.address,
            ],
        });
    }
}

main()
    .then(() => process.exit(0))
    .catch((error: Error) => {
        console.error(error);
        process.exit(1);
    });
