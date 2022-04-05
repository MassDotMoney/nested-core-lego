import hre, { ethers, network } from "hardhat";
import addresses from "../../addresses.json";
import { importOperators, registerParaswap } from "../utils";

const chainId: string = network.config.chainId.toString();
const context = JSON.parse(JSON.stringify(addresses));

// True if you want to enable the etherscan verification
const etherscan = false;

// Used to add delay between deployment and etherscan verification
const delay = async (ms: number) => new Promise(res => setTimeout(res, ms));

async function main(): Promise<void> {
    const paraswapOperatorFactory = await ethers.getContractFactory("ParaswapOperator");
    const operatorResolverFactory = await ethers.getContractFactory("OperatorResolver");
    const nestedFactoryFactory = await ethers.getContractFactory("NestedFactory");
    
    const operatorResolver = await operatorResolverFactory.attach(context[chainId].OperatorResolver);
    const nestedFactory = await nestedFactoryFactory.attach(context[chainId].NestedFactory);

    const tokenTransferProxy = "0x216B4B4Ba9F3e719726886d34a177484278Bfcae";
    const augustusSwapper = "0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57";
 
    // Deploy ParaswapOperator
    const paraswapOperator = await paraswapOperatorFactory.deploy(tokenTransferProxy, augustusSwapper);
    await paraswapOperator.deployed();
    console.log

    // Verify on tenderly
    const contracts = [
        {
            name: 'ParaswapOperator',
            address: paraswapOperator.address
        }]
    await hre.tenderly.verify(...contracts);

    if (etherscan) {
        // wait 1 minute (recommended)
        await delay(60000);
        await hre.run("verify:verify", {
            address: paraswapOperator.address,
            constructorArguments: [tokenTransferProxy, augustusSwapper]
        });
    }

    await importOperators(operatorResolver, [registerParaswap(paraswapOperator)], nestedFactory);
}

main()
    .then(() => process.exit(0))
    .catch((error: Error) => {
        console.error(error);
        process.exit(1);
    });
