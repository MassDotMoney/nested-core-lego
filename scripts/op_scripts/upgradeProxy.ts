import hre, { ethers } from "hardhat";

// Used to add delay between deployment and etherscan verification
const delay = async (ms: number) => new Promise(res => setTimeout(res, ms));

async function main(): Promise<void> {
    console.log("Generate calldata : ");

    let proxyAddr = "";
    let singleCallAddr = "";
    let ownerProxyAddr = "";
    let factoryAddr = "";

    const proxyFactory = await ethers.getContractFactory("TransparentUpgradeableProxy");
    const singleCallFactory = await ethers.getContractFactory("SingleCall");
    const ownerProxyFactory = await ethers.getContractFactory("OwnerProxy");

    const proxy = await proxyFactory.attach(proxyAddr);
    const singleCall = await singleCallFactory.attach(singleCallAddr);
    const ownerProxy = await ownerProxyFactory.attach(ownerProxyAddr);

    let upgradeToCalldata = await proxy.interface.encodeFunctionData("upgradeTo", [factoryAddr]);

    let singleCalldata = await singleCall.interface.encodeFunctionData("call", [proxyAddr, upgradeToCalldata]);

    console.log(singleCalldata);

    let executeCalldata = await ownerProxy.interface.encodeFunctionData("execute", [singleCall.address, singleCalldata]);

    console.log(executeCalldata);
}

main()
    .then(() => process.exit(0))
    .catch((error: Error) => {
        console.error(error);
        process.exit(1);
    });
