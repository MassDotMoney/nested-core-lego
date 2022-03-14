import hre, { ethers, network } from "hardhat";
import addresses from "../addresses.json";

// Used to add delay between deployment and etherscan verification
const delay = async (ms: number) => new Promise(res => setTimeout(res, ms));

const chainId: string = network.config.chainId.toString();
const context = JSON.parse(JSON.stringify(addresses));

async function main(): Promise<void> {
    console.log("Deploy TimelockControllerEmergency : ");

    // Get Addresses
    const multisig = context[chainId].config.multisig;
    const emergencyMultisig = context[chainId].config.emergencyMultisig;

    // Get Factories
    const timelockControllerEmergencyFactory = await ethers.getContractFactory("TimelockControllerEmergency");
    const timelockControllerEmergency = await timelockControllerEmergencyFactory.deploy(
        21600,
        [multisig, emergencyMultisig],
        [multisig, emergencyMultisig],
        emergencyMultisig,
    );
    await timelockControllerEmergency.deployed();

    console.log("TimelockControllerEmergency Deployed : ", timelockControllerEmergency.address);

    await delay(60000);

    await hre.run("verify:verify", {
        address: timelockControllerEmergency.address,
        constructorArguments: [21600, [multisig, emergencyMultisig], [multisig, emergencyMultisig], emergencyMultisig],
    });
}

main()
    .then(() => process.exit(0))
    .catch((error: Error) => {
        console.error(error);
        process.exit(1);
    });
