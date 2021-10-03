import { Fixture } from "ethereum-waffle";
import { ethers, network } from "hardhat";
import { ActorFixture } from "./actors";

import {
    DummyRouter,
    FeeSplitter,
    MockERC20,
    MockSmartChef,
    NestedAsset,
    NestedFactory,
    NestedRecords,
    NestedReserve,
    OperatorResolver,
    OwnableOperator,
    SynthetixOperator,
    TestableOperatorCaller,
    TestableOwnableOperatorCaller,
    TestableOwnedOperator,
    TestableSynthetix,
    WETH9,
    ZeroExOperator,
} from "../../typechain";
import { BaseContract, BigNumber, Wallet } from "ethers";
import { Interface } from "ethers/lib/utils";
import { appendDecimals, toBytes32 } from "../helpers";
import { FakeContract, smock } from "@defi-wonderland/smock";

export type OperatorResolverFixture = { operatorResolver: OperatorResolver };

export const operatorResolverFixture: Fixture<OperatorResolverFixture> = async (wallets, provider) => {
    const signer = new ActorFixture(wallets as Wallet[], provider).addressResolverOwner();

    const operatorResolverFactory = await ethers.getContractFactory("OperatorResolver");
    const operatorResolver = await operatorResolverFactory.connect(signer).deploy();

    return { operatorResolver };
};

export type OwnableOperatorFixture = { ownableOperator: OwnableOperator };

export const ownableOperatorFixture: Fixture<OwnableOperatorFixture> = async (wallets, provider) => {
    const signer = new ActorFixture(wallets as Wallet[], provider).ownableOperatorOwner();

    const ownableOperatorFixtureFactory = await ethers.getContractFactory("OwnableOperator");
    const ownableOperator = await ownableOperatorFixtureFactory.connect(signer).deploy();

    return { ownableOperator };
};

export type TestableOwnableOperatorCallerFixture = {
    testableOwnableOperatorCaller: TestableOwnableOperatorCaller;
    testableOwnedOperator: TestableOwnedOperator;
};

export const testableOwnableOperatorCallerFixture: Fixture<TestableOwnableOperatorCallerFixture> = async (
    wallets,
    provider,
) => {
    const signer = new ActorFixture(wallets as Wallet[], provider).ownableOperatorOwner();

    const testableOwnedOperatorFactory = await ethers.getContractFactory("TestableOwnedOperator");
    const testableOwnedOperator = await testableOwnedOperatorFactory.connect(signer).deploy();

    const testableOwnableOperatorCallerFactory = await ethers.getContractFactory("TestableOwnableOperatorCaller");
    const testableOwnableOperatorCaller = await testableOwnableOperatorCallerFactory
        .connect(signer)
        .deploy(testableOwnedOperator.address);

    return { testableOwnableOperatorCaller, testableOwnedOperator };
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

export type SynthetixOperatorFixture = {
    synthetix: FakeContract<TestableSynthetix>;
    synthetixOperator: SynthetixOperator;
    testableOperatorCaller: TestableOperatorCaller;
    mockUNI: MockERC20;
    mockDAI: MockERC20;
};

export const synthetixOperatorFixture: Fixture<SynthetixOperatorFixture> = async (wallets, provider) => {
    const signer = new ActorFixture(wallets as Wallet[], provider).synthetixOperatorOwner();

    const synthetixResolver: FakeContract<BaseContract> = await smock.fake([
        "function getAddress(bytes32 name) external view returns (address)",
        "function getSynth(bytes32 key) external view returns (address)",
        "function requireAndGetAddress(bytes32 name, string calldata reason) external view returns (address)",
    ]);

    const synthetixAddress = Wallet.createRandom().address;

    synthetixResolver.getAddress.returns(synthetixAddress);
    const synthetix = await smock.fake<TestableSynthetix>("TestableSynthetix", { address: synthetixAddress });

    const synthetixOperatorFactory = await ethers.getContractFactory("SynthetixOperator");
    const synthetixOperator = await synthetixOperatorFactory.connect(signer).deploy(synthetixAddress);

    const testableOperatorCallerFactory = await ethers.getContractFactory("TestableOperatorCaller");
    const testableOperatorCaller = await testableOperatorCallerFactory
        .connect(signer)
        .deploy(synthetixOperator.address);

    const mockERC20Factory = await ethers.getContractFactory("MockERC20");
    const mockUNI = await mockERC20Factory.deploy("Mocked UNI", "UNI", appendDecimals(3000000));
    const mockDAI = await mockERC20Factory.deploy("Mocked DAI", "DAI", appendDecimals(3000000));

    await mockUNI.transfer(testableOperatorCaller.address, appendDecimals(1000));
    await mockDAI.transfer(synthetix.address, appendDecimals(1000));

    return { synthetix, synthetixOperator, testableOperatorCaller, mockUNI, mockDAI };
};

export type FactoryAndZeroExFixture = {
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
    zeroExOperator: ZeroExOperator;
    zeroExOperatorNameBytes32: string;
    nestedFactory: NestedFactory;
    nestedReserve: NestedReserve;
    smartChef: MockSmartChef;
    masterDeployer: Wallet;
    user1: Wallet;
    baseAmount: BigNumber;
};

export const factoryAndZeroExFixture: Fixture<FactoryAndZeroExFixture> = async (wallets, provider) => {
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

    // Deploy NestedFactory
    const nestedFactoryFactory = await ethers.getContractFactory("NestedFactory");
    const nestedFactory = await nestedFactoryFactory.connect(masterDeployer).deploy(
        nestedAsset.address,
        nestedRecords.address,
        feeSplitter.address,
        WETH.address,
        operatorResolver.address,
        100, // 10% VIP Discount
        appendDecimals(500), // If 500 NST staked
    );
    await nestedFactory.deployed();

    // Deploy Reserve
    const nestedReserveFactory = await ethers.getContractFactory("NestedReserve");
    const nestedReserve = await nestedReserveFactory.connect(masterDeployer).deploy(nestedFactory.address);
    await nestedReserve.deployed();

    // Deploy smartchef
    const smartChefFactory = await ethers.getContractFactory("MockSmartChef");
    const smartChef = await smartChefFactory.connect(masterDeployer).deploy(0);
    await smartChef.deployed();

    // Set smartChef to factory
    await nestedFactory.connect(masterDeployer).updateSmartChef(smartChef.address);

    // Get the user1 actor
    const user1 = new ActorFixture(wallets as Wallet[], provider).user1();

    // Set factory to asset and records
    await nestedAsset.connect(masterDeployer).setFactory(nestedFactory.address);
    await nestedRecords.connect(masterDeployer).setFactory(nestedFactory.address);

    // Add ZeroExOperator to OperatorResolver
    const zeroExOperatorNameBytes32 = toBytes32("ZeroEx");
    await operatorResolver
        .connect(masterDeployer)
        .importOperators([zeroExOperatorNameBytes32], [zeroExOperator.address]);

    // Add ZeroExOperator to factory and rebuild cache
    await nestedFactory.connect(masterDeployer).addOperator(zeroExOperatorNameBytes32);
    await nestedFactory.connect(masterDeployer).rebuildCache();

    // Define the base amount
    const baseAmount = appendDecimals(1000);

    // Send funds to User and router
    await network.provider.send("hardhat_setBalance", [user1.address, baseAmount.toHexString()]);
    await mockUNI.connect(masterDeployer).transfer(dummyRouter.address, baseAmount);
    await mockKNC.connect(masterDeployer).transfer(dummyRouter.address, baseAmount);
    await mockDAI.connect(masterDeployer).transfer(dummyRouter.address, baseAmount);
    await mockUSDC.connect(masterDeployer).transfer(dummyRouter.address, baseAmount);
    await mockUNI.connect(masterDeployer).transfer(user1.address, baseAmount);
    await mockKNC.connect(masterDeployer).transfer(user1.address, baseAmount);
    await mockDAI.connect(masterDeployer).transfer(user1.address, baseAmount);
    await mockUSDC.connect(masterDeployer).transfer(user1.address, baseAmount);

    // User1 approves factory to spend all his tokens (UNI, KNC, and DAI)
    await mockUNI.connect(user1).approve(nestedFactory.address, baseAmount);
    await mockKNC.connect(user1).approve(nestedFactory.address, baseAmount);
    await mockDAI.connect(user1).approve(nestedFactory.address, baseAmount);
    await mockUSDC.connect(user1).approve(nestedFactory.address, baseAmount);

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
        zeroExOperatorNameBytes32,
        dummyRouter,
        zeroExOperator,
        nestedFactory,
        nestedReserve,
        smartChef,
        masterDeployer,
        user1,
        baseAmount,
    };
};
