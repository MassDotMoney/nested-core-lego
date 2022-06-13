import hre, { ethers } from "hardhat";

// Used to add delay between deployment and etherscan verification
const delay = async (ms: number) => new Promise(res => setTimeout(res, ms));

async function main(): Promise<void> {
    console.log("Deploy OperatorScripts : ");

    const nestedFactoryAddr = "";
    const operatorResolverAddr = "";

    // Get Factories
    const operatorScriptsFactory = await ethers.getContractFactory("OperatorScripts");
    const operatorScripts = await operatorScriptsFactory.deploy(nestedFactoryAddr, operatorResolverAddr);
    await operatorScripts.deployed();

    console.log("OperatorScripts Deployed : ", operatorScripts.address);

    await delay(60000);

    await hre.run("verify:verify", {
        address: operatorScripts.address,
        constructorArguments: [nestedFactoryAddr, operatorResolverAddr],
    });
}

main()
    .then(() => process.exit(0))
    .catch((error: Error) => {
        console.error(error);
        process.exit(1);
    });
