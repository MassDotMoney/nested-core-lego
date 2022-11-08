import { ethers, network } from "hardhat";
import { toBytes32 } from "../utils";

async function main(): Promise<void> {
    // Factories
    const operatorScriptsFactory = await ethers.getContractFactory("OperatorScripts");
    const ownerProxyFactory = await ethers.getContractFactory("OwnerProxy");

    // Addresses
    const operator = toBytes32("Paraswap");
    const operatorScript = "";

    // Generate OperatorScripts script calldata
    const calldata = operatorScriptsFactory.interface.encodeFunctionData("removeOperator", [
        operator
    ]);

    const finalCalldata = ownerProxyFactory.interface.encodeFunctionData("execute", [
        operatorScript,
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
