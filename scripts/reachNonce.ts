import hre from "hardhat";
import { getSigners } from "hardhat-deploy-ethers/dist/src/helpers";

async function main(): Promise<void> {
    const nonceToReach = 139; // to set

    const signers = await getSigners(hre);
    const nextNonce = await hre.ethers.provider.getTransactionCount(signers[0].address);

    if (nonceToReach < nextNonce) {
        console.log("Nonce already reached");
        return;
    }

    for (let i = nextNonce; i <= nonceToReach; i++) {
        let txSent = await signers[0].sendTransaction({
            to: signers[0].address,
            value: 0,
        });
        await txSent.wait();
        console.log("Reach ", i);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error: Error) => {
        console.error(error);
        process.exit(1);
    });
