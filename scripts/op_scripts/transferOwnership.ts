import hre, { ethers } from "hardhat";

async function main(): Promise<void> {
    console.log("Generate calldata : ");

    let nestedAssetAddr = "";
    let singleCallAddr = "";
    let ownerProxyAddr = "";
    let newOwner = "";

    const nestedAssetFactory = await ethers.getContractFactory("NestedAsset");
    const singleCallFactory = await ethers.getContractFactory("SingleCall");
    const ownerProxyFactory = await ethers.getContractFactory("OwnerProxy");

    const nestedAsset = await nestedAssetFactory.attach(nestedAssetAddr);
    const singleCall = await singleCallFactory.attach(singleCallAddr);
    const ownerProxy = await ownerProxyFactory.attach(ownerProxyAddr);

    let transferOwnershipCalldata = await nestedAsset.interface.encodeFunctionData("transferOwnership", [newOwner]);
    let singleCalldata = await singleCall.interface.encodeFunctionData("call", [nestedAsset.address, transferOwnershipCalldata]);

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
