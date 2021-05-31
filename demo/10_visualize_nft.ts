import { ethers, network } from "hardhat"

import { NetworkName } from "./demo-types"
import addresses from "./addresses.json"
import { displayHoldings } from "../test/helpers"
import { pickNFT } from "./cli-interaction"

const getNestedFactory = async () => {
    const env = network.name as NetworkName
    const NestedFactory = await ethers.getContractFactory("NestedFactory")
    return NestedFactory.attach(addresses[env].factory)
}

async function main() {
    const env = network.name as NetworkName

    const nftId = await pickNFT("Pick the NFT you want to view")
    const nestedFactory = await getNestedFactory()
    const holdings = await nestedFactory.tokenHoldings(nftId)
    displayHoldings(holdings)
}

main()
    .then(() => process.exit(0))
    .catch(err => {
        console.error(err)
        process.exit(1)
    })
