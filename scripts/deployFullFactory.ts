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
    const withdrawerFactory = await ethers.getContractFactory("Withdrawer");

    const feeSplitter = await feeSplitterFactory.attach("");
    const nestedAsset = await nestedAssetFactory.attach("");
    const nestedRecords = await nestedRecordsFactory.attach("");
    const nestedReserve = await nestedReserveFactory.attach("");

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

    const operatorResolver = await operatorResolverFactory.deploy();
    await verify("OperatorResolver", operatorResolver, []);
    console.log("OperatorResolver deployed : ", operatorResolver.address);

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
    console.log("New NestedFactory deployed : ", nestedFactory.address);

    const owner = await nestedRecords.owner();

    // Deploy FactoryProxy
    const factoryProxy = await transparentUpgradeableProxyFactory.deploy(nestedFactory.address, owner, []);
    await verify("FactoryProxy", factoryProxy, [nestedFactory.address, owner, []]);
    console.log("FactoryProxy deployed : ", factoryProxy.address);

    // Set factory to asset, records and reserve
    let tx = await nestedAsset.addFactory(factoryProxy.address);
    await tx.wait();
    tx = await nestedRecords.addFactory(factoryProxy.address);
    await tx.wait();
    tx = await nestedReserve.addFactory(factoryProxy.address);
    await tx.wait();

    // Initialize the owner in proxy storage by calling upgradeToAndCall
    // It will upgrade with the same address (no side effects)
    const initData = await nestedFactory.interface.encodeFunctionData("initialize", [owner]);
    tx = await factoryProxy.upgradeToAndCall(nestedFactory.address, initData);
    await tx.wait();

    // Set multisig as admin of proxy, so we can call the implementation as owner
    tx = await factoryProxy.changeAdmin(multisig);
    await tx.wait();

    // Attach factory impl to proxy address
    const proxyImpl = await nestedFactoryFactory.attach(factoryProxy.address);

    // Reset feeSplitter in proxy storage
    tx = await proxyImpl.setFeeSplitter(feeSplitter.address);
    await tx.wait();

    // Set entry fees in proxy storage
    tx = await proxyImpl.setEntryFees(30);
    await tx.wait();

    // Set exit fees in proxy storage
    tx = await proxyImpl.setExitFees(80);
    await tx.wait();

    await importOperators(operatorResolver, [registerFlat(flatOperator), registerZeroEx(zeroExOperator)], proxyImpl);

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
