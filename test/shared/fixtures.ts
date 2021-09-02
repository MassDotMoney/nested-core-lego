import { Fixture } from "ethereum-waffle";
import { ethers } from "hardhat";
import { ActorFixture } from "./actors";

import { OperatorResolver, TestableOwnableOperator } from "../../typechain";
import { Wallet } from "ethers";

export type OperatorResolverFixture = { operatorResolver: OperatorResolver };

export const operatorResolverFixture: Fixture<OperatorResolverFixture> = async (wallets, provider) => {
    const signer = new ActorFixture(wallets as Wallet[], provider).addressResolverOwner();

    const operatorResolverFactory = await ethers.getContractFactory("OperatorResolver");
    const operatorResolver = await operatorResolverFactory.connect(signer).deploy();

    return { operatorResolver };
};

export type TestableOwnableOperatorFixture = { testableOwnableOperator: TestableOwnableOperator };

export const testableOwnableOperatorFixture: Fixture<TestableOwnableOperatorFixture> = async (wallets, provider) => {
    const signer = new ActorFixture(wallets as Wallet[], provider).ownableOperatorOwner();

    const testableOwnableOperatorFactory = await ethers.getContractFactory("TestableOwnableOperator");
    const testableOwnableOperator = await testableOwnableOperatorFactory.connect(signer).deploy();

    return { testableOwnableOperator };
};
