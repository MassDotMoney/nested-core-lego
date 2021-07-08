import { ethers, network } from "hardhat";

import { NetworkName } from "./demo-types";
import addresses from "./addresses.json";

async function main() {
    const env = network.name as NetworkName;
    const [user1] = await ethers.getSigners();

    const NestedFactory = await ethers.getContractFactory("NestedFactory");
    const nestedFactory = await NestedFactory.attach(addresses[env].factory);

    const FeeSplitter = await ethers.getContractFactory("FeeSplitter");
    const feeSplitterAddress = await nestedFactory.feeTo();
    const feeSplitter = await FeeSplitter.attach(feeSplitterAddress);

    const user1Balance = await user1.getBalance();
    console.log(`User 1 balance is ${ethers.utils.formatEther(user1Balance)}. Claiming fees...`);
    const tx0 = await feeSplitter.releaseETH();
    await tx0.wait();

    const user1newBalance = await user1.getBalance();
    console.log(`User 1 new balance is ${ethers.utils.formatEther(user1newBalance)}`);
}

main()
    .then(() => process.exit(0))
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
