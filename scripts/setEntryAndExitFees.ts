import { ethers } from "hardhat";

async function main(): Promise<void> {
    const nestedFactoryFactory = await ethers.getContractFactory("NestedFactory");

    console.log("Set Entry Fees : ");
    const nestedFactory = await nestedFactoryFactory.attach(""); // Set address
    let tx = await nestedFactory.setEntryFees(30); // 0.3%
    await tx.wait();
    console.log("EntryFees setted");

    console.log("Set Exit Fees : ");
    tx = await nestedFactory.setExitFees(80); // 0.8%
    await tx.wait();
    console.log("Exit Fees setted");
}

main()
    .then(() => process.exit(0))
    .catch((error: Error) => {
        console.error(error);
        process.exit(1);
    });
