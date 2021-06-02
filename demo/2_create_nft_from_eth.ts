import { ethers, network } from "hardhat"

import { NetworkName } from "./demo-types"
import addresses from "./addresses.json"
import { createNFTFromETH } from "./create-nft"
import { displayHoldings } from "../test/helpers"

async function main() {
    const env = network.name as NetworkName

    const NestedFactory = await ethers.getContractFactory("NestedFactory")
    const nestedFactory = await NestedFactory.attach(addresses[env].factory)

    await createNFTFromETH()

    console.log("\nNFT created\n")

    const holdings = await nestedFactory.tokenHoldings(0)
    displayHoldings(holdings)
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error)
        process.exit(1)
    })
