import hre from "hardhat";
import addresses from "../addresses.json";
import { BigNumberish, Wallet } from "ethers";

const chainId: string = hre.network.config.chainId.toString();
const context = JSON.parse(JSON.stringify(addresses));

async function main(): Promise<void> {
    let accounts: string[] = [];
    let weights: BigNumberish[] = [];

    // Add the accounts with the weights
    accounts.push(Wallet.createRandom().address);
    weights.push(100);

    const feeSplitterFactory = await hre.ethers.getContractFactory("FeeSplitter");
    const feeSplitter = await feeSplitterFactory.attach(context[chainId].FeeSplitter);
    await feeSplitter.setShareholders(accounts, weights);
}

main()
    .then(() => process.exit(0))
    .catch((error: Error) => {
        console.error(error);
        process.exit(1);
    });
