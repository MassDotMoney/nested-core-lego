import { ethers, network } from "hardhat";
import addresses from "../../../addresses.json";
import { abiCoder, toBytes32 } from "../../utils";

const chainId: string = network.config.chainId.toString();
const context = JSON.parse(JSON.stringify(addresses));

async function main(): Promise<void> {
    // Factories
    const paraswapOperatorFactory = await ethers.getContractFactory("ParaswapOperator");
    const scriptDeployAddOperatorsFactory = await ethers.getContractFactory("DeployAddOperators");

    // Addresses
    const nestedFactoryAddr = context[chainId].NestedFactoryProxy;
    const tokenTransferProxy = "0x216B4B4Ba9F3e719726886d34a177484278Bfcae";
    const augustusSwapper = "0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57";

    // Concat deploy bytecode + args
    const deployCalldata = abiCoder.encode(
        ["bytes", "address", "address"],
        [paraswapOperatorFactory.bytecode, tokenTransferProxy, augustusSwapper],
    );

    // Generate DeployAddOperators script calldata
    const calldata = scriptDeployAddOperatorsFactory.interface.encodeFunctionData("deployAddOperators", [
        nestedFactoryAddr,
        deployCalldata,
        [
            {
                name: toBytes32("Paraswap"),
                selector: paraswapOperatorFactory.interface.getSighash("performSwap(address,address,bytes)"),
            },
        ],
    ]);

    console.log("Calldata for OwnerProxy => ", calldata);
}

main()
    .then(() => process.exit(0))
    .catch((error: Error) => {
        console.error(error);
        process.exit(1);
    });
