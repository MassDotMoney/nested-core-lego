import hre, { ethers } from "hardhat";

// Used to add delay between deployment and etherscan verification
const delay = async (ms: number) => new Promise(res => setTimeout(res, ms));

async function main(): Promise<void> {
    console.log("Deploy DeployAddOperators : ");
    
    // Get Factories
    const scriptDeployAddOperatorsFactory = await ethers.getContractFactory("DeployAddOperators");
    const scriptDeployAddOperators = await scriptDeployAddOperatorsFactory.deploy();
    await scriptDeployAddOperators.deployed();

    console.log("DeployAddOperators Deployed : ", scriptDeployAddOperators.address);

    await delay(60000);

    await hre.run("verify:verify", {
        address: scriptDeployAddOperators.address,
        constructorArguments: [],
    });
}

main()
    .then(() => process.exit(0))
    .catch((error: Error) => {
        console.error(error);
        process.exit(1);
    });
