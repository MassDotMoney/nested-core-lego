import { ethers, network } from "hardhat";
import addresses from "../../../addresses.json";
import { toBytes32 } from "../../utils";

const chainId: string = network.config.chainId.toString();
const context = JSON.parse(JSON.stringify(addresses));

async function main(): Promise<void> {
    // Factories
    const flatOperatorFactory = await ethers.getContractFactory("FlatOperator");
    const operatorScriptsFactory = await ethers.getContractFactory("OperatorScripts");
    const ownerProxyFactory = await ethers.getContractFactory("OwnerProxy");

    // Generate OperatorScripts script calldata
    const calldata = operatorScriptsFactory.interface.encodeFunctionData("deployAddOperators", [
        flatOperatorFactory.bytecode,
        [
            {
                name: toBytes32("Flat"),
                selector: flatOperatorFactory.interface.getSighash("transfer(address,uint256)"),
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
