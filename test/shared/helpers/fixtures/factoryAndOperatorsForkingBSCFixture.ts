import { Fixture } from "ethereum-waffle";
import { BigNumber, Wallet } from "ethers";
import { ethers, network } from "hardhat";
import { importOperatorsWithSigner, registerBeefyDeposit, registerBeefyWithdraw, registerFlat, registerZeroEx, toBytes32 } from "../../../scripts/utils";
import { BeefyVaultOperator, BeefyVaultStorage, FeeSplitter, FlatOperator, NestedAsset, NestedAssetBatcher, NestedFactory, NestedRecords, NestedReserve, OperatorResolver, WETH9, Withdrawer, ZeroExOperator } from "../../../typechain";
import { appendDecimals } from "../../helpers";
import { ActorFixture } from "../actors";
import { FactoryAndOperatorsForkingBSCFixture } from "./types/FactoryAndOperatorsForkingBSCFixture";

export const factoryAndOperatorsForkingBSCFixture: Fixture<FactoryAndOperatorsForkingBSCFixture> = async (
    wallets,
    provider,
) => {
    const masterDeployer = new ActorFixture(wallets as Wallet[], provider).masterDeployer();

    const WBNBFactory = await ethers.getContractFactory("WETH9");
    const WBNB = await WBNBFactory.attach("0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c");

    // Get the Fee shareholders (two actors)
    const shareholder1 = new ActorFixture(wallets as Wallet[], provider).shareHolder1();
    const shareholder2 = new ActorFixture(wallets as Wallet[], provider).shareHolder2();

    // Define the royaltie weight value (used in FeeSplitter)
    const royaltieWeigth = BigNumber.from(300);

    // Deploy the FeeSplitter
    const feeSplitterFactory = await ethers.getContractFactory("FeeSplitter");
    const feeSplitter = await feeSplitterFactory
        .connect(masterDeployer)
        .deploy([shareholder1.address, shareholder2.address], [150, 150], royaltieWeigth, WBNB.address);
    await feeSplitter.deployed();

    // Deploy NestedAsset
    const nestedAssetFactory = await ethers.getContractFactory("NestedAsset");
    const nestedAsset = await nestedAssetFactory.connect(masterDeployer).deploy();
    await nestedAsset.deployed();

    // Define maxHoldingsCount value (used in NestedRecords)
    const maxHoldingsCount = BigNumber.from(15);

    // Deploy NestedRecords
    const nestedRecordsFactory = await ethers.getContractFactory("NestedRecords");
    const nestedRecords = await nestedRecordsFactory.connect(masterDeployer).deploy(maxHoldingsCount);
    await nestedRecords.deployed();

    // Deploy Reserve
    const nestedReserveFactory = await ethers.getContractFactory("NestedReserve");
    const nestedReserve = await nestedReserveFactory.connect(masterDeployer).deploy();
    await nestedReserve.deployed();

    // Deploy OperatorResolver
    const operatorResolverFactory = await ethers.getContractFactory("OperatorResolver");
    const operatorResolver = await operatorResolverFactory.connect(masterDeployer).deploy();
    await operatorResolver.deployed();

    // Get 0x SwapTarget
    const swapTargetAddress = "0xdef1c0ded9bec7f1a1670819833240f027b25eff";

    // Deploy ZeroExOperator
    const zeroExOperatorFactory = await ethers.getContractFactory("ZeroExOperator");
    const zeroExOperator = await zeroExOperatorFactory.connect(masterDeployer).deploy(swapTargetAddress);
    await zeroExOperator.deployed();

    // Deploy FlatOperator
    const flatOperatorFactory = await ethers.getContractFactory("FlatOperator");
    const flatOperator = await flatOperatorFactory.connect(masterDeployer).deploy();
    await flatOperator.deployed();

    // Deploy Beefy V6 (Venus BNB)
    const beefyVenusBNBVaultAddress = "0x6BE4741AB0aD233e4315a10bc783a7B923386b71";
    const beefyVaultOperatorFactory = await ethers.getContractFactory("BeefyVaultOperator");
    const beefyVaultOperator = await beefyVaultOperatorFactory
        .connect(masterDeployer)
        .deploy([beefyVenusBNBVaultAddress], [WBNB.address]);
    await beefyVaultOperator.deployed();

    const beefyVaultStorageFactory = await ethers.getContractFactory("BeefyVaultStorage");
    const beefyVaultStorage = beefyVaultStorageFactory.attach(await beefyVaultOperator.operatorStorage());

    // Deploy Withdrawer
    const withdrawerFactory = await ethers.getContractFactory("Withdrawer");
    const withdrawer = await withdrawerFactory.connect(masterDeployer).deploy(WBNB.address);
    await withdrawer.deployed();

    // Deploy NestedFactory
    const nestedFactoryFactory = await ethers.getContractFactory("NestedFactory");
    const nestedFactoryImpl = await nestedFactoryFactory
        .connect(masterDeployer)
        .deploy(
            nestedAsset.address,
            nestedRecords.address,
            nestedReserve.address,
            feeSplitter.address,
            WBNB.address,
            operatorResolver.address,
            withdrawer.address,
        );
    await nestedFactoryImpl.deployed();

    // Get the user1 actor
    const user1 = new ActorFixture(wallets as Wallet[], provider).user1();

    // add ether to wallets
    await network.provider.send("hardhat_setBalance", [
        masterDeployer.address,
        appendDecimals(100000000000000000).toHexString(),
    ]);
    await network.provider.send("hardhat_setBalance", [
        user1.address,
        appendDecimals(100000000000000000).toHexString(),
    ]);

    // Deploy FactoryProxy
    const transparentUpgradeableProxyFactory = await ethers.getContractFactory("TransparentUpgradeableProxy");
    const factoryProxy = await transparentUpgradeableProxyFactory.deploy(
        nestedFactoryImpl.address,
        masterDeployer.address,
        [],
    );

    // Set factory to asset, records and reserve
    let tx = await nestedAsset.addFactory(factoryProxy.address);
    await tx.wait();
    tx = await nestedRecords.addFactory(factoryProxy.address);
    await tx.wait();
    tx = await nestedReserve.addFactory(factoryProxy.address);
    await tx.wait();

    // Initialize the owner in proxy storage by calling upgradeToAndCall
    // It will upgrade with the same address (no side effects)
    const initData = await nestedFactoryImpl.interface.encodeFunctionData("initialize", [masterDeployer.address]);
    tx = await factoryProxy.connect(masterDeployer).upgradeToAndCall(nestedFactoryImpl.address, initData);
    await tx.wait();

    // Set multisig as admin of proxy, so we can call the implementation as owner
    const proxyAdmin = new ActorFixture(wallets as Wallet[], provider).proxyAdmin();
    tx = await factoryProxy.connect(masterDeployer).changeAdmin(proxyAdmin.address);
    await tx.wait();

    // Attach factory impl to proxy address
    const nestedFactory = await nestedFactoryFactory.attach(factoryProxy.address);

    // Reset feeSplitter in proxy storage
    tx = await nestedFactory.connect(masterDeployer).setFeeSplitter(feeSplitter.address);
    await tx.wait();

    // Set entry fees in proxy storage
    tx = await nestedFactory.connect(masterDeployer).setEntryFees(100);
    await tx.wait();

    // Set exit fees in proxy storage
    tx = await nestedFactory.connect(masterDeployer).setExitFees(100);
    await tx.wait();

    await importOperatorsWithSigner(
        operatorResolver,
        [
            registerZeroEx(zeroExOperator),
            registerFlat(flatOperator),
            registerBeefyDeposit(beefyVaultOperator),
            registerBeefyWithdraw(beefyVaultOperator),
        ],
        nestedFactory,
        masterDeployer,
    );

    // Set factory to asset, records and reserve
    await nestedAsset.connect(masterDeployer).addFactory(nestedFactory.address);
    await nestedRecords.connect(masterDeployer).addFactory(nestedFactory.address);
    await nestedReserve.connect(masterDeployer).addFactory(nestedFactory.address);

    // Deploy NestedAssetBatcher
    const nestedAssetBatcherFactory = await ethers.getContractFactory("NestedAssetBatcher");
    const nestedAssetBatcher = await nestedAssetBatcherFactory
        .connect(masterDeployer)
        .deploy(nestedAsset.address, nestedRecords.address);
    await nestedAssetBatcher.deployed();

    // Define the base amount
    const baseAmount = appendDecimals(1000);

    return {
        WBNB,
        shareholder1,
        shareholder2,
        feeSplitter,
        royaltieWeigth,
        nestedAsset,
        nestedRecords,
        maxHoldingsCount,
        operatorResolver,
        swapTargetAddress,
        zeroExOperatorNameBytes32: toBytes32("ZeroEx"),
        flatOperator,
        flatOperatorNameBytes32: toBytes32("Flat"),
        beefyVenusBNBVaultAddress,
        beefyVaultOperator,
        beefyVaultStorage,
        beefyVaultDepositOperatorNameBytes32: toBytes32("BeefyDeposit"),
        beefyVaultWithdrawOperatorNameBytes32: toBytes32("BeefyWithdraw"),
        withdrawer,
        zeroExOperator,
        nestedFactory,
        nestedReserve,
        masterDeployer,
        user1,
        proxyAdmin,
        baseAmount,
        nestedAssetBatcher,
    };
};