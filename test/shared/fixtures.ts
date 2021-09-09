import { Fixture } from "ethereum-waffle";
import { ethers } from "hardhat";
import { ActorFixture } from "./actors";

import {
    DummyRouter,
    MockERC20,
    OperatorResolver,
    OwnableOperator,
    TestableOperatorCaller,
    TestableOwnableOperatorCaller,
    TestableOwnedOperator,
    ZeroExOperator,
} from "../../typechain";
import { Wallet } from "ethers";
import { Interface } from "ethers/lib/utils";
import { appendDecimals } from "../helpers";

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
    const mockDAI = await mockERC20Factory.deploy("Mocked DAI", "DAI", appendDecimals(3000000));

    await mockUNI.transfer(dummyRouter.address, appendDecimals(1000));
    await mockDAI.transfer(dummyRouter.address, appendDecimals(1000));

    const testableOperatorCallerFactory = await ethers.getContractFactory("TestableOperatorCaller");
    const testableOperatorCaller = await testableOperatorCallerFactory.connect(signer).deploy(zeroExOperator.address);

    await mockUNI.transfer(testableOperatorCaller.address, appendDecimals(1000));
    await mockDAI.transfer(testableOperatorCaller.address, appendDecimals(1000));

    return { zeroExOperator, dummyRouter, dummyRouterInterface, mockUNI, mockDAI, testableOperatorCaller };
};
