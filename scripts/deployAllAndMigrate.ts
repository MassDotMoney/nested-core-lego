import hre, { ethers, network } from "hardhat";
import { Contract } from "ethers";
import addresses from "../addresses.json";
import { importOperators, registerFlat, registerZeroEx } from './utils';

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
const zeroExSwapTarget = context[chainId].config.zeroExSwapTarget;
const WETH = context[chainId].config.WETH;
const multisig = context[chainId].config.multisig;

let deployments: Deployment[] = [];

async function main(): Promise<void> {
    // Add new proxy/factory with new operators

    const feeSplitterFactory = await ethers.getContractFactory("FeeSplitter");
    const nestedAssetFactory = await ethers.getContractFactory("NestedAsset");
    const nestedRecordsFactory = await ethers.getContractFactory("NestedRecords");
    const operatorResolverFactory = await ethers.getContractFactory("OperatorResolver");
    const flatOperatorFactory = await ethers.getContractFactory("FlatOperator");
    const zeroExOperatorFactory = await ethers.getContractFactory("ZeroExOperator");
    const nestedFactoryFactory = await ethers.getContractFactory("NestedFactory");
    const nestedReserveFactory = await ethers.getContractFactory("NestedReserve");
    const transparentUpgradeableProxyFactory = await ethers.getContractFactory("TransparentUpgradeableProxy");


    // WIP
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
    deployments.push({ name: name, address: contract.address })
}

main()
    .then(() => process.exit(0))
    .catch((error: Error) => {
        console.log(JSON.stringify(deployments))
        console.error(error);
        process.exit(1);
    });