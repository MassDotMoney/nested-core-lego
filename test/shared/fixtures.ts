import { Fixture } from "ethereum-waffle";
import { ethers, network } from "hardhat";
import { ActorFixture } from "./actors";
import { addEthEurtBalanceTo, addBscUsdcBalanceTo } from "./impersonnate"

import {
    AugustusSwapper,
    BeefyVaultOperator,
    BeefyVaultStorage,
    BeefyZapUniswapLPVaultOperator,
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
    StakeDaoCurveStrategyOperator,
    StakeDaoStrategyStorage,
    TestableOperatorCaller,
    WETH9,
    Withdrawer,
    YearnCurveVaultOperator,
    YearnVaultStorage,
    ZeroExOperator,
} from "../../typechain";
import { BigNumber, Wallet } from "ethers";
import { Interface } from "ethers/lib/utils";
import { append6Decimals, appendDecimals, getExpectedFees, setAllowance, toBytes32, UINT256_MAX } from "../helpers";
import {
    importOperatorsWithSigner,
    registerFlat,
    registerZeroEx,
    registerBeefyDeposit,
    registerBeefyWithdraw,
    registerParaswap,
    registerBeefyZapBiswapLPDeposit,
    registerBeefyZapBiswapLPWithdraw,
    registerBeefyZapUniswapLPDeposit,
    registerBeefyZapUniswapLPWithdraw,
    registerYearnDeposit,
    registerYearnWithdraw128,
    registerYearnWithdraw256,
    registerYearnDepositETH,
    registerYearnWithdrawETH,
    setMaxAllowance,
    registerStakeDaoDeposit,
    registerStakeDaoDepositETH,
    registerStakeDaoWithdrawETH,
    registerStakeDaoWithdraw128,
    registerStakeDaoWithdraw256,
} from "../../scripts/utils";

import { BeefyZapBiswapLPVaultOperator } from "../../typechain/BeefyZapBiswapLPVaultOperator";

export type OperatorResolverFixture = { operatorResolver: OperatorResolver };
// Token addresses on mainnet
export const USDCEth = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
export const EURTEth = "0xC581b735A1688071A1746c968e0798D642EDE491"

// Token addresses on BSC
export const USDCBsc = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d";

export const operatorResolverFixture: Fixture<OperatorResolverFixture> = async (wallets, provider) => {
    const signer = new ActorFixture(wallets as Wallet[], provider).addressResolverOwner();
    await network.provider.send("hardhat_setBalance", [
        signer.address,
        appendDecimals(100000000000000000).toHexString(),
    ]);

    const operatorResolverFactory = await ethers.getContractFactory("OperatorResolver");
    const operatorResolver = await operatorResolverFactory.connect(signer).deploy();

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
    stakeDaoUsdStrategyAddress: string;
    stakeDaoNonWhitelistedStrategy: string;
    stakeDaoCurveStrategyOperator: StakeDaoCurveStrategyOperator;
    stakeDaoStrategyStorage: StakeDaoStrategyStorage;
    stakeDaoCurveStrategyDepositOperatorNameBytes32: string;
    stakeDaoCurveStrategyDepositETHOperatorNameBytes32: string;
    stakeDaoCurveStrategyWithdrawETHOperatorNameBytes32: string;
    stakeDaoCurveStrategyWithdraw128OperatorNameBytes32: string;
    stakeDaoCurveStrategyWithdraw256OperatorNameBytes32: string;
    beefyBiswapVaultAddress: string;
    beefyUnregisteredBiswapVaultAddress: string;
    beefyBiswapBtcEthLPVaultAddress: string;
    beefyZapBiswapLPVaultOperator: BeefyZapBiswapLPVaultOperator;
    beefyZapBiswapLPVaultDepositOperatorNameBytes32: string;
    beefyZapBiswapLPVaultWithdrawOperatorNameBytes32: string;
    beefyUniswapVaultAddress: string;
    beefyUnregisteredUniswapVaultAddress: string;
    beefyUniswapBtcEthLPVaultAddress: string;
    beefyZapUniswapLPVaultOperator: BeefyZapUniswapLPVaultOperator;
    beefyZapUniswapLPVaultDepositOperatorNameBytes32: string;
    beefyZapUniswapLPVaultWithdrawOperatorNameBytes32: string;
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

    const BNB = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
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

    // Deploy Withdrawer
    const withdrawerFactory = await ethers.getContractFactory("Withdrawer");
    const withdrawer = await withdrawerFactory.connect(masterDeployer).deploy(WBNB.address);
    await withdrawer.deployed();

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

    // Deploy Beefy vault storage
    const beefyVaultStorageFactory = await ethers.getContractFactory("BeefyVaultStorage");
    const beefyVaultStorage = beefyVaultStorageFactory.attach(await beefyVaultOperator.operatorStorage());

    // Deploy StakeDAO operator storage (USD Strategy 3pool)
    const stakeDaoUsdStrategyAddress = "0x4835BC54e87ff7722a89450dc26D9dc2d3A69F36";
    const usd3poolAddress = "0x160CAed03795365F3A589f10C379FfA7d75d4E76";
    const usd3poolLpTokenAddress = "0xaF4dE8E872131AE328Ce21D909C74705d3Aaf452";
    const stakeDaoCurveStrategyOperatorFactory = await ethers.getContractFactory("StakeDaoCurveStrategyOperator");
    const stakeDaoCurveStrategyOperator = await stakeDaoCurveStrategyOperatorFactory
        .connect(masterDeployer)
        .deploy(
            [stakeDaoUsdStrategyAddress],
            [{
                poolAddress: usd3poolAddress,
                poolCoinAmount: 3,
                lpToken: usd3poolLpTokenAddress
            }],
            withdrawer.address,
            BNB,
            WBNB.address
        );
    await stakeDaoCurveStrategyOperator.deployed();

    const stakeDaoStrategyStorageFactory = await ethers.getContractFactory("StakeDaoStrategyStorage");
    const stakeDaoStrategyStorage = stakeDaoStrategyStorageFactory.attach(await stakeDaoCurveStrategyOperator.operatorStorage());


    // Deploy Beefy Zap Biswap LP vault operator (USDT-BNB and BTCB-ETH LP vaults)
    const biswapRouterAddress = "0x3a6d8cA21D1CF76F653A67577FA0D27453350dD8";
    const beefyBiswapVaultAddress = "0xe2AD2c5702f6c9073f85b00E4743066E1D1035f8";
    const beefyBiswapBtcEthLPVaultAddress = "0xEeB87e7bAbF17cA97F0Eb897F24Bf475e0A9Aef7";
    const beefyZapBiswapLPVaultOperatorFactory = await ethers.getContractFactory("BeefyZapBiswapLPVaultOperator");
    const beefyZapBiswapLPVaultOperator = await beefyZapBiswapLPVaultOperatorFactory
        .connect(masterDeployer)
        .deploy([beefyBiswapVaultAddress, beefyBiswapBtcEthLPVaultAddress], [biswapRouterAddress, biswapRouterAddress]);
    await beefyZapBiswapLPVaultOperator.deployed();

    // Deploy Beefy Zap Uniswap LP vault operator (ERA-WBNB and BTCB-ETH LP vaults)
    const uniswapRouterAddress = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
    const beefyUniswapVaultAddress = "0xbaAcbb2A18Db15D185AE5fAdc53bEe21Ed626a5e";
    const beefyUniswapBtcEthLPVaultAddress = "0xEf43E54Bb4221106953951238FC301a1f8939490";
    const beefyZapUniswapLPVaultOperatorFactory = await ethers.getContractFactory("BeefyZapUniswapLPVaultOperator");
    const beefyZapUniswapLPVaultOperator = await beefyZapUniswapLPVaultOperatorFactory
        .connect(masterDeployer)
        .deploy(
            [beefyUniswapVaultAddress, beefyUniswapBtcEthLPVaultAddress],
            [uniswapRouterAddress, uniswapRouterAddress],
        );
    await beefyZapUniswapLPVaultOperator.deployed();

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
            registerStakeDaoDepositETH(stakeDaoCurveStrategyOperator),
            registerStakeDaoDeposit(stakeDaoCurveStrategyOperator),
            registerStakeDaoWithdrawETH(stakeDaoCurveStrategyOperator),
            registerStakeDaoWithdraw128(stakeDaoCurveStrategyOperator),
            registerStakeDaoWithdraw256(stakeDaoCurveStrategyOperator),
            registerBeefyZapBiswapLPDeposit(beefyZapBiswapLPVaultOperator),
            registerBeefyZapBiswapLPWithdraw(beefyZapBiswapLPVaultOperator),
            registerBeefyZapUniswapLPDeposit(beefyZapUniswapLPVaultOperator),
            registerBeefyZapUniswapLPWithdraw(beefyZapUniswapLPVaultOperator)
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

    // add ERC20 token balance to user1
    await addBscUsdcBalanceTo(user1, appendDecimals(1000000))
    await setMaxAllowance(user1, nestedFactory.address, USDCBsc)

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
        stakeDaoUsdStrategyAddress,
        stakeDaoNonWhitelistedStrategy: "0xf479e1252481360f67c2b308F998395cA056a77f",
        stakeDaoCurveStrategyOperator,
        stakeDaoStrategyStorage,
        stakeDaoCurveStrategyDepositOperatorNameBytes32: toBytes32("stakeDaoCurveStrategyDeposit"),
        stakeDaoCurveStrategyDepositETHOperatorNameBytes32: toBytes32("stakeDaoCurveStrategyDepositETH"),
        stakeDaoCurveStrategyWithdrawETHOperatorNameBytes32: toBytes32("stakeDaoCurveStrategyWithdrawETH"),
        stakeDaoCurveStrategyWithdraw128OperatorNameBytes32: toBytes32("stakeDaoCurveStrategyWithdraw128"),
        stakeDaoCurveStrategyWithdraw256OperatorNameBytes32: toBytes32("stakeDaoCurveStrategyWithdraw256"),
        beefyBiswapVaultAddress,
        beefyUnregisteredBiswapVaultAddress: "0xd4548D0b71D4f925aaA2be59E10c6B9248d1EF70",
        beefyBiswapBtcEthLPVaultAddress,
        beefyZapBiswapLPVaultOperator,
        beefyZapBiswapLPVaultDepositOperatorNameBytes32: toBytes32("BeefyZapBiswapLPDeposit"),
        beefyZapBiswapLPVaultWithdrawOperatorNameBytes32: toBytes32("BeefyZapBiswapLPWithdraw"),
        beefyUniswapVaultAddress,
        beefyUnregisteredUniswapVaultAddress: "0xcc3D722E518fF86b113Fa6aa4434fBAA0449a0e1",
        beefyUniswapBtcEthLPVaultAddress,
        beefyZapUniswapLPVaultOperator,
        beefyZapUniswapLPVaultDepositOperatorNameBytes32: toBytes32("BeefyZapUniswapLPDeposit"),
        beefyZapUniswapLPVaultWithdrawOperatorNameBytes32: toBytes32("BeefyZapUniswapLPWithdraw"),
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

export type FactoryAndOperatorsForkingETHFixture = {
    WETH: WETH9;
    shareholder1: Wallet;
    shareholder2: Wallet;
    feeSplitter: FeeSplitter;
    royaltieWeigth: BigNumber;
    nestedAsset: NestedAsset;
    nestedRecords: NestedRecords;
    maxHoldingsCount: BigNumber;
    operatorResolver: OperatorResolver;
    stakeDaoStEthStrategyAddress: string;
    stakeDaoNonWhitelistedStrategy: string;
    stakeDaoCurveStrategyOperator: StakeDaoCurveStrategyOperator;
    stakeDaoStrategyStorage: StakeDaoStrategyStorage;
    stakeDaoCurveStrategyDepositOperatorNameBytes32: string;
    stakeDaoCurveStrategyDepositETHOperatorNameBytes32: string;
    stakeDaoCurveStrategyWithdrawETHOperatorNameBytes32: string;
    stakeDaoCurveStrategyWithdraw128OperatorNameBytes32: string;
    stakeDaoCurveStrategyWithdraw256OperatorNameBytes32: string;
    yearnCurveVaultOperator: YearnCurveVaultOperator;
    yearnVaultStorage: YearnVaultStorage;
    yearnVaultDepositOperatorNameBytes32: string;
    yearnVaultDepositETHOperatorNameBytes32: string;
    yearnVaultWithdraw128OperatorNameBytes32: string;
    yearnVaultWithdraw256OperatorNameBytes32: string;
    yearnVaultWithdrawETHOperatorNameBytes32: string;
    yearnVaultAddresses: {
        triCryptoVault: string;
        alEthVault: string;
        threeEurVault: string;
        nonWhitelistedVault: string;
    };
    withdrawer: Withdrawer;
    nestedFactory: NestedFactory;
    nestedReserve: NestedReserve;
    masterDeployer: Wallet;
    user1: Wallet;
    proxyAdmin: Wallet;
    baseAmount: BigNumber;
    nestedAssetBatcher: NestedAssetBatcher;
};

export const factoryAndOperatorsForkingETHFixture: Fixture<FactoryAndOperatorsForkingETHFixture> = async (
    wallets,
    provider,
) => {
    const masterDeployer = new ActorFixture(wallets as Wallet[], provider).masterDeployer();

    const ETH = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
    const WETHFactory = await ethers.getContractFactory("WETH9");
    const WETH = await WETHFactory.attach("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");

    // Get the Fee shareholders (two actors)
    const shareholder1 = new ActorFixture(wallets as Wallet[], provider).shareHolder1();
    const shareholder2 = new ActorFixture(wallets as Wallet[], provider).shareHolder2();

    // Define the royaltie weight value (used in FeeSplitter)
    const royaltieWeigth = BigNumber.from(300);

    // Deploy the FeeSplitter
    const feeSplitterFactory = await ethers.getContractFactory("FeeSplitter");
    const feeSplitter = await feeSplitterFactory
        .connect(masterDeployer)
        .deploy([shareholder1.address, shareholder2.address], [150, 150], royaltieWeigth, WETH.address);
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

    // Deploy Withdrawer
    const withdrawerFactory = await ethers.getContractFactory("Withdrawer");
    const withdrawer = await withdrawerFactory.connect(masterDeployer).deploy(WETH.address);
    await withdrawer.deployed();

    // Deploy StakeDAO operator storage (USD Strategy 3pool)
    const stakeDaoStEthStrategyAddress = "0xbC10c4F7B9FE0B305e8639B04c536633A3dB7065";
    const stEthPoolAddress = "0xDC24316b9AE028F1497c275EB9192a3Ea0f67022";
    const stEthPoolLpTokenAddress = "0x06325440D014e39736583c165C2963BA99fAf14E";
    const stakeDaoCurveStrategyOperatorFactory = await ethers.getContractFactory("StakeDaoCurveStrategyOperator");
    const stakeDaoCurveStrategyOperator = await stakeDaoCurveStrategyOperatorFactory
        .connect(masterDeployer)
        .deploy(
            [stakeDaoStEthStrategyAddress],
            [{
                poolAddress: stEthPoolAddress,
                poolCoinAmount: 2,
                lpToken: stEthPoolLpTokenAddress
            }],
            withdrawer.address,
            ETH,
            WETH.address
        );
    await stakeDaoCurveStrategyOperator.deployed();

    const stakeDaoStrategyStorageFactory = await ethers.getContractFactory("StakeDaoStrategyStorage");
    const stakeDaoStrategyStorage = stakeDaoStrategyStorageFactory.attach(await stakeDaoCurveStrategyOperator.operatorStorage());

    // Deploy Yearn Curve operator (Curve 3crypto, Curve alETH and Curve 3EUR)
    const triCryptoVault = "0xE537B5cc158EB71037D4125BDD7538421981E6AA";
    const curveTriCryptoPoolAddress = "0xD51a44d3FaE010294C616388b506AcdA1bfAAE46";
    const curveTriCryptoLpTokenAddress = "0xc4AD29ba4B3c580e6D59105FFf484999997675Ff";

    const alEthVault = "0x718AbE90777F5B778B52D553a5aBaa148DD0dc5D";
    const curveAlEthFactoryPoolAddress = "0xC4C319E2D4d66CcA4464C0c2B32c9Bd23ebe784e";
    const curveAlEthFactoryLpTokenAddress = "0xC4C319E2D4d66CcA4464C0c2B32c9Bd23ebe784e";

    const threeEurVault = "0x5AB64C599FcC59f0f2726A300b03166A395578Da";
    const curveThreeEurPoolAddress = "0xb9446c4Ef5EBE66268dA6700D26f96273DE3d571";
    const curveThreeEurLpTokenAddress = "0xb9446c4Ef5EBE66268dA6700D26f96273DE3d571";

    const nonWhitelistedVault = "0x3B96d491f067912D18563d56858Ba7d6EC67a6fa"

    const yearnCurveVaultOperatorFactory = await ethers.getContractFactory("YearnCurveVaultOperator");
    const yearnCurveVaultOperator = await yearnCurveVaultOperatorFactory
        .connect(masterDeployer)
        .deploy(
            [
                triCryptoVault,
                alEthVault,
                threeEurVault
            ],
            [
                {
                    poolAddress: curveTriCryptoPoolAddress,
                    poolCoinAmount: 3,
                    lpToken: curveTriCryptoLpTokenAddress
                },
                {
                    poolAddress: curveAlEthFactoryPoolAddress,
                    poolCoinAmount: 2,
                    lpToken: curveAlEthFactoryLpTokenAddress
                },
                {
                    poolAddress: curveThreeEurPoolAddress,
                    poolCoinAmount: 3,
                    lpToken: curveThreeEurLpTokenAddress
                }

            ],
            withdrawer.address,
            ETH,
            WETH.address
        );

    await yearnCurveVaultOperator.deployed();

    const yearnVaultStorageFactory = await ethers.getContractFactory("YearnVaultStorage");
    const yearnVaultStorage = yearnVaultStorageFactory.attach(await yearnCurveVaultOperator.operatorStorage());

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
        [
            registerStakeDaoDeposit(stakeDaoCurveStrategyOperator),
            registerStakeDaoDepositETH(stakeDaoCurveStrategyOperator),
            registerStakeDaoWithdraw128(stakeDaoCurveStrategyOperator),
            registerStakeDaoWithdraw256(stakeDaoCurveStrategyOperator),
            registerStakeDaoWithdrawETH(stakeDaoCurveStrategyOperator),
            registerYearnDeposit(yearnCurveVaultOperator),
            registerYearnDepositETH(yearnCurveVaultOperator),
            registerYearnWithdraw128(yearnCurveVaultOperator),
            registerYearnWithdraw256(yearnCurveVaultOperator),
            registerYearnWithdrawETH(yearnCurveVaultOperator)
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

    const eurtToAddToBalance = append6Decimals(1000);
    const eurtToAddToBalanceAndFees = eurtToAddToBalance.add(getExpectedFees(eurtToAddToBalance));
    // Add fund ThreeEur to balance
    await addEthEurtBalanceTo(user1, eurtToAddToBalanceAndFees);
    await setAllowance(user1, EURTEth, nestedFactory.address, UINT256_MAX);

    return {
        WETH,
        shareholder1,
        shareholder2,
        feeSplitter,
        royaltieWeigth,
        nestedAsset,
        nestedRecords,
        maxHoldingsCount,
        operatorResolver,
        stakeDaoStEthStrategyAddress,
        stakeDaoNonWhitelistedStrategy: "0xa2761B0539374EB7AF2155f76eb09864af075250",
        stakeDaoCurveStrategyOperator,
        stakeDaoStrategyStorage,
        stakeDaoCurveStrategyDepositOperatorNameBytes32: toBytes32("stakeDaoCurveStrategyDeposit"),
        stakeDaoCurveStrategyDepositETHOperatorNameBytes32: toBytes32("stakeDaoCurveStrategyDepositETH"),
        stakeDaoCurveStrategyWithdrawETHOperatorNameBytes32: toBytes32("stakeDaoCurveStrategyWithdrawETH"),
        stakeDaoCurveStrategyWithdraw128OperatorNameBytes32: toBytes32("stakeDaoCurveStrategyWithdraw128"),
        stakeDaoCurveStrategyWithdraw256OperatorNameBytes32: toBytes32("stakeDaoCurveStrategyWithdraw256"),
        yearnCurveVaultOperator,
        yearnVaultStorage,
        yearnVaultDepositOperatorNameBytes32: toBytes32("YearnVaultDepositOperator"),
        yearnVaultDepositETHOperatorNameBytes32: toBytes32("YearnVaultDepositETHOperator"),
        yearnVaultWithdraw128OperatorNameBytes32: toBytes32("YearnVaultWithdraw128Operator"),
        yearnVaultWithdraw256OperatorNameBytes32: toBytes32("YearnVaultWithdraw256Operator"),
        yearnVaultWithdrawETHOperatorNameBytes32: toBytes32("YearnVaultWithdrawETHOperator"),
        yearnVaultAddresses: {
            triCryptoVault,
            alEthVault,
            threeEurVault,
            nonWhitelistedVault,
        },
        withdrawer,
        nestedFactory,
        nestedReserve,
        masterDeployer,
        user1,
        proxyAdmin,
        baseAmount,
        nestedAssetBatcher,
    };
};
