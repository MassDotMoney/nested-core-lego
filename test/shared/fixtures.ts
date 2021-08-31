import { Fixture } from "ethereum-waffle";
import { ethers } from "hardhat";
import { ActorFixture } from "./actors";

import { OperatorResolver } from "../../typechain";
import { Wallet } from "ethers";

export type OperatorResolverFixture = { operatorResolver: OperatorResolver };

export const operatorResolverFixture: Fixture<OperatorResolverFixture> = async (wallets, provider) => {
    const signer = new ActorFixture(wallets as Wallet[], provider).addressResolverOwner();

    const operatorResolverFactory = await ethers.getContractFactory("OperatorResolver");
    // @ts-ignore
    const operatorResolver = (await operatorResolverFactory.connect(signer).deploy()) as OperatorResolver;

    return { operatorResolver };
};
