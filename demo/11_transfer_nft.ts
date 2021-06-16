import { ethers, network } from "hardhat"
import { pickNFT, readAddress } from "./cli-interaction"

import { NetworkName } from "./demo-types"
import { getNestedFactory } from "./helpers"

async function main() {
    const env = network.name as NetworkName
    const [user] = await ethers.getSigners()

    const nftId = await pickNFT()
    const to = await readAddress()

    const nestedFactory = await getNestedFactory()
    const nestedAssetFactory = await ethers.getContractFactory("NestedAsset")
    const nestedAsset = nestedAssetFactory.attach(await nestedFactory.nestedAsset())
    console.log("approve...")
    const tx0 = await nestedAsset.approve(to, nftId)
    await tx0.wait()

    console.log("transfer...")
    const tx1 = await nestedAsset.transferFrom(user.address, to, nftId)
    await tx1.wait()
}

main()
    .then(() => process.exit(0))
    .catch(err => {
        console.error(err)
        process.exit(1)
    })
