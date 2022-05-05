import { Fixture } from "ethereum-waffle";
import { Wallet } from "ethers";
import { ethers, network } from "hardhat";
import { appendDecimals } from "../../../helpers";
import { ActorFixture } from "../actors";
import { OperatorResolverFixture } from "./types/OperatorResolverFixture";

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