import { ethers, network } from "hardhat";
import addresses from "../../../addresses.json";
import { abiCoder, toBytes32 } from "../../utils";

const chainId: string = network.config.chainId.toString();
const context = JSON.parse(JSON.stringify(addresses));

async function main(): Promise<void> {
    // Factories
    const paraswapOperatorFactory = await ethers.getContractFactory("ParaswapOperator");
    const operatorScriptsFactory = await ethers.getContractFactory("OperatorScripts");
    const ownerProxyFactory = await ethers.getContractFactory("OwnerProxy");

    // Addresses
    const tokenTransferProxy = "";
    const augustusSwapper = "";

    // Concat deploy bytecode + args
    // We are using slice(2) to remove the "0x" from the encodeDeploy (args)
    const deployCalldata =
        paraswapOperatorFactory.bytecode +
        paraswapOperatorFactory.interface.encodeDeploy([tokenTransferProxy, augustusSwapper]).slice(2);

    // Generate OperatorScripts script calldata
    const calldata = operatorScriptsFactory.interface.encodeFunctionData("deployAddOperators", [
        deployCalldata,
        [
            {
                name: toBytes32("Paraswap"),
                selector: paraswapOperatorFactory.interface.getSighash("performSwap(address,address,bytes)"),
            },
        ],
    ]);

    const finalCalldata = ownerProxyFactory.interface.encodeFunctionData("execute", [
        context[chainId].scripts.OperatorScripts,
        calldata,
    ]);
    console.log("Calldata for OwnerProxy => ", finalCalldata);
}

main()
    .then(() => process.exit(0))
    .catch((error: Error) => {
        console.error(error);
        process.exit(1);
    });
