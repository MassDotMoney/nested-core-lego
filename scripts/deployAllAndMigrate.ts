import hre, { ethers, network } from "hardhat";
import { Contract, ContractTransaction } from "ethers";
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
const maxHoldingsCount = context[chainId].config.maxHoldingsCount;
const zeroExSwapTarget = context[chainId].config.zeroExSwapTarget;
const WETH = context[chainId].config.WETH;
const nestedTreasury = context[chainId].config.nestedTreasury;
const multisig = context[chainId].config.multisig;

let deployments: Deployment[] = [];

async function main(): Promise<void> {
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
    const migratorFactory = await ethers.getContractFactory("Migrator");

    const oldNestedFactory = await nestedFactoryFactory.attach("");
    const oldNestedAsset = await nestedAssetFactory.attach("");
    const oldNestedRecords = await nestedRecordsFactory.attach("");
    const oldNestedReserve = await nestedReserveFactory.attach("");

    /* ---------------------------- DEPLOY ---------------------------- */

    // Deploy FeeSplitter
    const feeSplitter = await feeSplitterFactory.deploy([nestedTreasury], [20], 20, WETH);
    await verify("FeeSplitter", feeSplitter, [[nestedTreasury], [20], 20, WETH]);
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
    const zeroExStorage = await zeroExOperator.operatorStorage();
    console.log("ZeroExStorage deployed : ", zeroExStorage);
    deployments.push({ name: "ZeroExStorage", address: zeroExStorage })

    // Deploy FlatOperator
    const flatOperator = await flatOperatorFactory.deploy();
    await verify("FlatOperator", flatOperator, []);
    console.log("FlatOperator deployed : ", flatOperator.address);

    // Deploy Withdrawer
    const withdrawer = await withdrawerFactory.deploy(WETH);
    await verify("Withdrawer", withdrawer, []);
    console.log("Withdrawer deployed : ", withdrawer.address);

     // Deploy NestedFactory
    const nestedFactory = await nestedFactoryFactory
    .deploy(
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
        withdrawer.address
    ]);
    console.log("NestedFactory deployed : ", nestedFactory.address);

    const owner = await nestedRecords.owner();

    // Deploy FactoryProxy
    const factoryProxy = await transparentUpgradeableProxyFactory.deploy(nestedFactory.address, owner, []);
    await verify("FactoryProxy", factoryProxy, [nestedFactory.address, owner, []]);
    console.log("FactoryProxy deployed : ", factoryProxy.address);
 
    // Set factory to asset, records and reserve
    await run(await nestedAsset.addFactory(factoryProxy.address));
    await run(await nestedRecords.addFactory(factoryProxy.address));
    await run(await nestedReserve.addFactory(factoryProxy.address));
 
    // Initialize the owner in proxy storage by calling upgradeToAndCall
    // It will upgrade with the same address (no side effects)
    const initData = await nestedFactory.interface.encodeFunctionData("initialize", [owner]);
    await run(await factoryProxy.upgradeToAndCall(nestedFactory.address, initData));
 
    // Set multisig as admin of proxy, so we can call the implementation as owner
    await run(await factoryProxy.changeAdmin(multisig));
 
    // Attach factory impl to proxy address
    const proxyImpl = await nestedFactoryFactory.attach(factoryProxy.address);
 
    // Reset feeSplitter in proxy storage
    await run(await proxyImpl.setFeeSplitter(feeSplitter.address));
 
    await importOperators(operatorResolver, [
        registerFlat(flatOperator),
        registerZeroEx(zeroExOperator),
    ], proxyImpl);

    await delay(5000);

    /* ---------------------------- MIGRATE ---------------------------- */
    const migrator = await migratorFactory.deploy(
        oldNestedFactory.address, 
        oldNestedReserve.address, 
        oldNestedAsset.address, 
        oldNestedRecords.address
    );

    await verify("Migrator", migrator, [oldNestedFactory.address, 
        oldNestedReserve.address, 
        oldNestedAsset.address, 
        oldNestedRecords.address
    ]);
    console.log("Migrator deployed : ", migrator.address);

    const migrationNumber = 27;
    const steps = 4;

    for (let i = 1; i <= migrationNumber; i + steps + 1) {
        let end = i + steps;
        if (i + steps > migrationNumber) {
            end = migrationNumber;
        }
        await run(await migrator.migrate(i, end));
    }
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
    await delay(5000);
}

async function run(tx: ContractTransaction) {
    await tx.wait();
    await delay(5000);
}

main()
    .then(() => process.exit(0))
    .catch((error: Error) => {
        console.log(JSON.stringify(deployments))
        console.error(error);
        process.exit(1);
    });