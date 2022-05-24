import hre from "hardhat";

async function main(): Promise<void> {
    // Factories
    const paraswapOperatorAddr = "";

    const tokenTransferProxy = "0x216B4B4Ba9F3e719726886d34a177484278Bfcae";
    const augustusSwapper = "0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57";

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
