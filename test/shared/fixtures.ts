import { Fixture } from "ethereum-waffle";
import { ethers, network } from "hardhat";
import { ActorFixture } from "./actors";

import {
    AugustusSwapper,
    BeefyVaultOperator,
    BeefyVaultStorage,
    BeefyZapLPVaultOperator,
    DummyRouter,
    FeeSplitter,
    FlatOperator,
    MockERC20,
    NestedAsset,
    NestedAssetBatcher,
    NestedFactory,
    NestedRecords,
    NestedReserve,
    OperatorResolver,
    ParaswapOperator,
    TestableOperatorCaller,
    WETH9,
    Withdrawer,
    ZeroExOperator,
} from "../../typechain";
import { BigNumber, Wallet } from "ethers";
import { Interface } from "ethers/lib/utils";
import { appendDecimals, toBytes32 } from "../helpers";
import {
    importOperatorsWithSigner,
    registerFlat,
    registerZeroEx,
    registerBeefyDeposit,
    registerBeefyWithdraw,
    registerParaswap,
    registerBeefyZapLPDeposit,
    registerBeefyZapLPWithdraw,
} from "../../scripts/utils";

export type OperatorResolverFixture = { operatorResolver: OperatorResolver };

export const operatorResolverFixture: Fixture<OperatorResolverFixture> = async (wallets, provider) => {
    const signer = new ActorFixture(wallets as Wallet[], provider).addressResolverOwner();
    await network.provider.send("hardhat_setBalance", [
        signer.address,
        appendDecimals(100000000000000000).toHexString(),
    ]);

    const operatorResolverFactory = await ethers.getContractFactory("OperatorResolver");
    const operatorResolver = await operatorResolverFactory.connect(signer).deploy();

    return { operatorResolver };
    return { operatorResolver };
};

export type ZeroExOperatorFixture = {
    zeroExOperator: ZeroExOperator;
    dummyRouter: DummyRouter;
    dummyRouterInterface: Interface;
    mockUNI: MockERC20;
    mockDAI: MockERC20;
    testableOperatorCaller: TestableOperatorCaller;
};

export const zeroExOperatorFixture: Fixture<ZeroExOperatorFixture> = async (wallets, provider) => {
    const signer = new ActorFixture(wallets as Wallet[], provider).zeroExOperatorOwner();

    const dummyRouterFactory = await ethers.getContractFactory("DummyRouter");
    const dummyRouter = await dummyRouterFactory.connect(signer).deploy();

    const dummyRouterInterface = dummyRouter.interface;

    const zeroExOperatorFactory = await ethers.getContractFactory("ZeroExOperator");
    const zeroExOperator = await zeroExOperatorFactory.connect(signer).deploy(dummyRouter.address);

    const mockERC20Factory = await ethers.getContractFactory("MockERC20");
    const mockUNI = await mockERC20Factory.deploy("Mocked UNI", "UNI", appendDecimals(3000000));
    await mockUNI.deployed();
    const mockDAI = await mockERC20Factory.deploy("Mocked DAI", "DAI", appendDecimals(3000000));
    await mockDAI.deployed();

    await mockUNI.transfer(dummyRouter.address, appendDecimals(1000));
    await mockDAI.transfer(dummyRouter.address, appendDecimals(1000));

    const testableOperatorCallerFactory = await ethers.getContractFactory("TestableOperatorCaller");
    const testableOperatorCaller = await testableOperatorCallerFactory.connect(signer).deploy(zeroExOperator.address);

    await mockUNI.transfer(testableOperatorCaller.address, appendDecimals(1000));
    await mockDAI.transfer(testableOperatorCaller.address, appendDecimals(1000));

    return { zeroExOperator, dummyRouter, dummyRouterInterface, mockUNI, mockDAI, testableOperatorCaller };
};

export type ParaswapOperatorFixture = {
    paraswapOperator: ParaswapOperator;
    augustusSwapper: AugustusSwapper;
    augustusSwapperInterface: Interface;
    mockUNI: MockERC20;
    mockDAI: MockERC20;
    testableOperatorCaller: TestableOperatorCaller;
};

export const paraswapOperatorFixture: Fixture<ParaswapOperatorFixture> = async (wallets, provider) => {
    const signer = new ActorFixture(wallets as Wallet[], provider).zeroExOperatorOwner();

    const augustusSwapperFactory = await ethers.getContractFactory("AugustusSwapper");
    const augustusSwapper = await augustusSwapperFactory.connect(signer).deploy();

    const augustusSwapperInterface = augustusSwapper.interface;

    const paraswapOperatorFactory = await ethers.getContractFactory("ParaswapOperator");
    const paraswapOperator = await paraswapOperatorFactory
        .connect(signer)
        .deploy(await augustusSwapper.proxy(), augustusSwapper.address);

    const mockERC20Factory = await ethers.getContractFactory("MockERC20");
    const mockUNI = await mockERC20Factory.deploy("Mocked UNI", "UNI", appendDecimals(3000000));
    await mockUNI.deployed();
    const mockDAI = await mockERC20Factory.deploy("Mocked DAI", "DAI", appendDecimals(3000000));
    await mockDAI.deployed();

    await mockUNI.transfer(augustusSwapper.address, appendDecimals(1000));
    await mockDAI.transfer(augustusSwapper.address, appendDecimals(1000));

    const testableOperatorCallerFactory = await ethers.getContractFactory("TestableOperatorCaller");
    const testableOperatorCaller = await testableOperatorCallerFactory.connect(signer).deploy(paraswapOperator.address);

    await mockUNI.transfer(testableOperatorCaller.address, appendDecimals(1000));
    await mockDAI.transfer(testableOperatorCaller.address, appendDecimals(1000));

    return { paraswapOperator, augustusSwapper, augustusSwapperInterface, mockUNI, mockDAI, testableOperatorCaller };
};

export type FactoryAndOperatorsFixture = {
    WETH: WETH9;
    mockUNI: MockERC20;
    mockKNC: MockERC20;
    mockDAI: MockERC20;
    mockUSDC: MockERC20;
    shareholder1: Wallet;
    shareholder2: Wallet;
    feeSplitter: FeeSplitter;
    royaltieWeigth: BigNumber;
    nestedAsset: NestedAsset;
    nestedRecords: NestedRecords;
    maxHoldingsCount: BigNumber;
    operatorResolver: OperatorResolver;
    dummyRouter: DummyRouter;
    augustusSwapper: AugustusSwapper;
    zeroExOperator: ZeroExOperator;
    zeroExOperatorNameBytes32: string;
    paraswapOperator: ParaswapOperator;
    paraswapOperatorNameBytes32: string;
    flatOperator: FlatOperator;
    flatOperatorNameBytes32: string;
    withdrawer: Withdrawer;
    nestedFactory: NestedFactory;
    nestedReserve: NestedReserve;
    masterDeployer: Wallet;
    user1: Wallet;
    proxyAdmin: Wallet;
    baseAmount: BigNumber;
    nestedAssetBatcher: NestedAssetBatcher;
};

export const factoryAndOperatorsFixture: Fixture<FactoryAndOperatorsFixture> = async (wallets, provider) => {
    const masterDeployer = new ActorFixture(wallets as Wallet[], provider).masterDeployer();

    // Deploy WETH
    const WETHFactory = await ethers.getContractFactory("WETH9");
    const WETH = await WETHFactory.connect(masterDeployer).deploy();
    await WETH.deployed();

    // Deploy ERC20 mocks
    const mockERC20Factory = await ethers.getContractFactory("MockERC20");
    const mockUNI = await mockERC20Factory.connect(masterDeployer).deploy("Mocked UNI", "UNI", appendDecimals(3000000));
    await mockUNI.deployed();
    const mockKNC = await mockERC20Factory.connect(masterDeployer).deploy("Mocked KNC", "KNC", appendDecimals(3000000));
    await mockKNC.deployed();
    const mockDAI = await mockERC20Factory.connect(masterDeployer).deploy("Mocked DAI", "DAI", appendDecimals(3000000));
    await mockDAI.deployed();
    const mockUSDC = await mockERC20Factory
        .connect(masterDeployer)
        .deploy("Mocked USDC", "USDC", appendDecimals(3000000));
    await mockUSDC.deployed();

    // Get the Fee shareholders (two actors)
    const shareholder1 = new ActorFixture(wallets as Wallet[], provider).shareHolder1();
    const shareholder2 = new ActorFixture(wallets as Wallet[], provider).shareHolder2();

    // Define the royaltie weight value (used in FeeSplitter)
    const royaltieWeigth = BigNumber.from(300);

    // Deploy the FeeSplitter
    const feeSplitterFactory = await ethers.getContractFactory("FeeSplitter");
    const feeSplitter = await feeSplitterFactory
        .connect(masterDeployer)
        .deploy([shareholder1.address, shareholder2.address], [1000, 1700], royaltieWeigth, WETH.address);
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

    // Deploy DummyRouter (fake 0x)
    const dummyRouterFactory = await ethers.getContractFactory("DummyRouter");
    const dummyRouter = await dummyRouterFactory.connect(masterDeployer).deploy();
    await dummyRouter.deployed();

    // Deploy ZeroExOperator
    const zeroExOperatorFactory = await ethers.getContractFactory("ZeroExOperator");
    const zeroExOperator = await zeroExOperatorFactory.connect(masterDeployer).deploy(dummyRouter.address);
    await zeroExOperator.deployed();

    // Deploy AugustusSwapper (Fake Paraswap)
    const augustusSwapperFactory = await ethers.getContractFactory("AugustusSwapper");
    const augustusSwapper = await augustusSwapperFactory.connect(masterDeployer).deploy();
    await augustusSwapper.deployed();

    // Deploy ParaswapOperator
    const paraswapOperatorFactory = await ethers.getContractFactory("ParaswapOperator");
    const paraswapOperator = await paraswapOperatorFactory
        .connect(masterDeployer)
        .deploy(await augustusSwapper.proxy(), augustusSwapper.address);
    await paraswapOperator.deployed();

    // Deploy FlatOperator
    const flatOperatorFactory = await ethers.getContractFactory("FlatOperator");
    const flatOperator = await flatOperatorFactory.connect(masterDeployer).deploy();
    await flatOperator.deployed();

    // Deploy Withdrawer
    const withdrawerFactory = await ethers.getContractFactory("Withdrawer");
    const withdrawer = await withdrawerFactory.connect(masterDeployer).deploy(WETH.address);
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
            WETH.address,
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
        [registerZeroEx(zeroExOperator), registerFlat(flatOperator), registerParaswap(paraswapOperator)],
        nestedFactory,
        masterDeployer,
    );

    // Set factory to asset, records and reserve
    await nestedAsset.connect(masterDeployer).addFactory(nestedFactory.address);
    await nestedRecords.connect(masterDeployer).addFactory(nestedFactory.address);
    await nestedReserve.connect(masterDeployer).addFactory(nestedFactory.address);

    // Define the base amount
    const baseAmount = appendDecimals(1000);

    // Send funds to User and router
    await mockUNI.connect(masterDeployer).transfer(dummyRouter.address, baseAmount);
    await mockKNC.connect(masterDeployer).transfer(dummyRouter.address, baseAmount);
    await mockDAI.connect(masterDeployer).transfer(dummyRouter.address, baseAmount);
    await mockUSDC.connect(masterDeployer).transfer(dummyRouter.address, baseAmount);
    await mockUNI.connect(masterDeployer).transfer(augustusSwapper.address, baseAmount);
    await mockKNC.connect(masterDeployer).transfer(augustusSwapper.address, baseAmount);
    await mockDAI.connect(masterDeployer).transfer(augustusSwapper.address, baseAmount);
    await mockUSDC.connect(masterDeployer).transfer(augustusSwapper.address, baseAmount);
    await mockUNI.connect(masterDeployer).transfer(user1.address, baseAmount);
    await mockKNC.connect(masterDeployer).transfer(user1.address, baseAmount);
    await mockDAI.connect(masterDeployer).transfer(user1.address, baseAmount);
    await mockUSDC.connect(masterDeployer).transfer(user1.address, baseAmount);

    // User1 approves factory to spend all his tokens (UNI, KNC, and DAI)
    await mockUNI.connect(user1).approve(nestedFactory.address, baseAmount);
    await mockKNC.connect(user1).approve(nestedFactory.address, baseAmount);
    await mockDAI.connect(user1).approve(nestedFactory.address, baseAmount);
    await mockUSDC.connect(user1).approve(nestedFactory.address, baseAmount);

    // Wrap some ETH and send them to the dummy router
    await WETH.connect(masterDeployer).deposit({ value: appendDecimals(200) });
    await WETH.connect(masterDeployer).transfer(dummyRouter.address, appendDecimals(100));
    await WETH.connect(masterDeployer).transfer(augustusSwapper.address, appendDecimals(100));

    // Deploy NestedAssetBatcher
    const nestedAssetBatcherFactory = await ethers.getContractFactory("NestedAssetBatcher");
    const nestedAssetBatcher = await nestedAssetBatcherFactory
        .connect(masterDeployer)
        .deploy(nestedAsset.address, nestedRecords.address);
    await nestedAssetBatcher.deployed();

    return {
        WETH,
        mockUNI,
        mockKNC,
        mockDAI,
        mockUSDC,
        shareholder1,
        shareholder2,
        feeSplitter,
        royaltieWeigth,
        nestedAsset,
        nestedRecords,
        maxHoldingsCount,
        operatorResolver,
        zeroExOperatorNameBytes32: toBytes32("ZeroEx"),
        flatOperator,
        flatOperatorNameBytes32: toBytes32("Flat"),
        withdrawer,
        dummyRouter,
        augustusSwapper,
        paraswapOperator,
        paraswapOperatorNameBytes32: toBytes32("Paraswap"),
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

export type FactoryAndOperatorsForkingBSCFixture = {
    WBNB: WETH9;
    shareholder1: Wallet;
    shareholder2: Wallet;
    feeSplitter: FeeSplitter;
    royaltieWeigth: BigNumber;
    nestedAsset: NestedAsset;
    nestedRecords: NestedRecords;
    maxHoldingsCount: BigNumber;
    operatorResolver: OperatorResolver;
    swapTargetAddress: string;
    zeroExOperator: ZeroExOperator;
    zeroExOperatorNameBytes32: string;
    flatOperator: FlatOperator;
    flatOperatorNameBytes32: string;
    beefyVenusBNBVaultAddress: string;
    beefyVaultOperator: BeefyVaultOperator;
    beefyVaultStorage: BeefyVaultStorage;
    beefyVaultDepositOperatorNameBytes32: string;
    beefyVaultWithdrawOperatorNameBytes32: string;
    beefyBiswapVaultAddress: string;
    beefyZapLPVaultOperator: BeefyZapLPVaultOperator;
    beefyZapLPVaultStorage: BeefyVaultStorage;
    beefyZapLPVaultDepositOperatorNameBytes32: string;
    beefyZapLPVaultWithdrawOperatorNameBytes32: string;
    withdrawer: Withdrawer;
    nestedFactory: NestedFactory;
    nestedReserve: NestedReserve;
    masterDeployer: Wallet;
    user1: Wallet;
    proxyAdmin: Wallet;
    baseAmount: BigNumber;
    nestedAssetBatcher: NestedAssetBatcher;
};

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

    // Deploy Beefy Zap LP (Biswap USDT-BNB LP vault)
    const biswapZapperAddress = "0x9a76a315109663d9f2e105be7a6df18b4f7b16f0";
    const beefyBiswapVaultAddress = "0xe2AD2c5702f6c9073f85b00E4743066E1D1035f8";
    const beefyZapLPVaultOperatorFactory = await ethers.getContractFactory("BeefyZapLPVaultOperator");
    const beefyZapLPVaultOperator = await beefyZapLPVaultOperatorFactory
        .connect(masterDeployer)
        .deploy([beefyBiswapVaultAddress], [biswapZapperAddress]);
    await beefyZapLPVaultOperator.deployed();

    const beefyZapLPVaultStorage = beefyVaultStorageFactory.attach(await beefyZapLPVaultOperator.operatorStorage());

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
            registerBeefyZapLPDeposit(beefyZapLPVaultOperator),
            registerBeefyZapLPWithdraw(beefyZapLPVaultOperator),
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
        beefyBiswapVaultAddress,
        beefyZapLPVaultOperator,
        beefyZapLPVaultStorage,
        beefyZapLPVaultDepositOperatorNameBytes32: toBytes32("BeefyZapLPDeposit"),
        beefyZapLPVaultWithdrawOperatorNameBytes32: toBytes32("BeefyZapLPWithdraw"),
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
