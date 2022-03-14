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
const maxHoldingsCount = context[chainId].config.maxHoldingsCount;
const zeroExSwapTarget = context[chainId].config.zeroExSwapTarget;
const WETH = context[chainId].config.WETH;
const nestedTreasury = context[chainId].config.nestedTreasury;

let deployments: Deployment[] = [];

async function main(): Promise<void> {
    console.log("Deploy All : ");

    // Get Factories
    const feeSplitterFactory = await ethers.getContractFactory("FeeSplitter");
    const nestedAssetFactory = await ethers.getContractFactory("NestedAsset");
    const nestedRecordsFactory = await ethers.getContractFactory("NestedRecords");
    const operatorResolverFactory = await ethers.getContractFactory("OperatorResolver");
    const flatOperatorFactory = await ethers.getContractFactory("FlatOperator");
    const zeroExOperatorFactory = await ethers.getContractFactory("ZeroExOperator");
    const nestedFactoryFactory = await ethers.getContractFactory("NestedFactory");
    const nestedReserveFactory = await ethers.getContractFactory("NestedReserve");
    const withdrawerFactory = await ethers.getContractFactory("Withdrawer");

    // Deploy FeeSplitter
    const feeSplitter = await feeSplitterFactory.deploy([nestedTreasury], [80], 20, WETH);
    await verify("FeeSplitter", feeSplitter, [[nestedTreasury], [80], 20, WETH]);
    console.log("FeeSplitter deployed : ", feeSplitter.address);

    // Deploy NestedAsset
    const nestedAsset = await nestedAssetFactory.deploy();
    await verify("NestedAsset", nestedAsset, []);
    console.log("NestedAsset deployed : ", nestedAsset.address);

    // Deploy NestedRecords
    const nestedRecords = await nestedRecordsFactory.deploy(maxHoldingsCount);
    await verify("NestedRecords", nestedRecords, [maxHoldingsCount]);
    console.log("NestedRecords deployed : ", nestedRecords.address);

    // Deploy NestedReserve
    const nestedReserve = await nestedReserveFactory.deploy();
    await verify("NestedReserve", nestedReserve, []);
    console.log("NestedReserve deployed : ", nestedReserve.address);

    // Deploy OperatorResolver
    const operatorResolver = await operatorResolverFactory.deploy();
    await verify("OperatorResolver", operatorResolver, []);
    console.log("OperatorResolver deployed : ", operatorResolver.address);

    // Deploy ZeroExOperator
    const zeroExOperator = await zeroExOperatorFactory.deploy(zeroExSwapTarget);
    await verify("ZeroExOperator", zeroExOperator, [zeroExSwapTarget]);
    console.log("ZeroExOperator deployed : ", zeroExOperator.address);

    // Add ZeroExStorage address
    deployments.push({ name: "ZeroExStorage", address: await zeroExOperator.operatorStorage() });

    // Deploy FlatOperator
    const flatOperator = await flatOperatorFactory.deploy();
    await verify("FlatOperator", flatOperator, []);
    console.log("FlatOperator deployed : ", flatOperator.address);

    // Deploy Withdrawer
    const withdrawer = await withdrawerFactory.deploy(WETH);
    await verify("Withdrawer", withdrawer, []);
    console.log("Withdrawer deployed : ", withdrawer.address);

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
    await verify("NestedFactory", nestedFactory, [
        nestedAsset.address,
        nestedRecords.address,
        nestedReserve.address,
        feeSplitter.address,
        WETH,
        operatorResolver.address,
    ]);
    console.log("NestedFactory deployed : ", nestedFactory.address);

    // Set factory to asset, records and reserve
    let tx = await nestedAsset.addFactory(nestedFactory.address);
    await tx.wait();
    tx = await nestedRecords.addFactory(nestedFactory.address);
    await tx.wait();
    tx = await nestedReserve.addFactory(nestedFactory.address);
    await tx.wait();

    // Add operators to OperatorResolver

    // Add operators to OperatorResolver
    await importOperators(
        operatorResolver,
        [registerFlat(flatOperator), registerZeroEx(zeroExOperator)],
        nestedFactory,
    );

    // Convert JSON object to string
    const data = JSON.stringify(deployments);
    console.log(data);
}

async function verify(name: string, contract: Contract, params: any[]) {
    await contract.deployed();
    if (etherscan) {
        // wait 1 minute (recommended)
        await delay(60000);
        await hre.run("verify:verify", {
            address: contract.address,
            constructorArguments: params,
        });
    }
    deployments.push({ name: name, address: contract.address });
}

main()
    .then(() => process.exit(0))
    .catch((error: Error) => {
        console.log(JSON.stringify(deployments));
        console.error(error);
        process.exit(1);
    });
