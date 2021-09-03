import { Fixture } from "ethereum-waffle";
import { ethers } from "hardhat";
import { ActorFixture } from "./actors";

import {
    OperatorResolver,
    OwnableOperator,
    TestableOwnableOperatorCaller, TestableOwnedOperator,
} from "../../typechain";
import { Wallet } from "ethers";

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
