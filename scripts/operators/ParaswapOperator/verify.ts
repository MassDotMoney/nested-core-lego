import hre from "hardhat";

async function main(): Promise<void> {
    // Factories
    const paraswapOperatorAddr = "";

    const tokenTransferProxy = "";
    const augustusSwapper = "";

    await hre.run("verify:verify", {
        address: paraswapOperatorAddr,
        constructorArguments: [tokenTransferProxy, augustusSwapper],
    });
}

main()
    .then(() => process.exit(0))
    .catch((error: Error) => {
        console.error(error);
        process.exit(1);
    });
