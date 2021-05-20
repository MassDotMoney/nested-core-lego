import { ethers, network } from "hardhat"

import { NetworkName } from "./demo-types"
import addresses from "./addresses.json"
import { createNFT } from "./create-nft"

async function main(replicateNFT: number = 0) {
    const env = network.name as NetworkName
    const [user1, user2] = await ethers.getSigners()

    const NestedFactory = await ethers.getContractFactory("NestedFactory")
    const nestedFactory = await NestedFactory.attach(addresses[env].factory)

    const FeeSplitter = await ethers.getContractFactory("FeeSplitter")
    const feeSplitterAddress = await nestedFactory.feeTo()
    const feeSplitter = await FeeSplitter.attach(feeSplitterAddress)

    if (!replicateNFT) {
        await createNFT(user1)
        const assets = await nestedFactory.tokensOf(user1.address)
        console.log(`NFT created and has ID ${assets[0]}`)
        replicateNFT = assets[0]

        await createNFT(user2, replicateNFT)
        const assetsUser2 = await nestedFactory.tokensOf(user2.address)
        console.log(`NFT replicated by user 2. It has ID ${assetsUser2[0]}`)
    }

    const user1Balance = await user1.getBalance()
    console.log(`User 1 balance is ${ethers.utils.formatEther(user1Balance)}. Claiming fees...`)
    const tx0 = await feeSplitter.releaseETH()
    await tx0.wait()

    const user1newBalance = await user1.getBalance()
    console.log(`User 1 new balance is ${ethers.utils.formatEther(user1newBalance)}`)
}

main(1)
    .then(() => process.exit(0))
    .catch(err => {
        console.error(err)
        process.exit(1)
    })
