import hre from "hardhat";

async function main(): Promise<void> {
    const contracts = [
        {
            name: "contract_name",
            address: "contract_address",
        },
    ];
    await hre.tenderly.verify(...contracts);
}

main()
    .then(() => process.exit(0))
    .catch((error: Error) => {
        console.error(error);
        process.exit(1);
    });
