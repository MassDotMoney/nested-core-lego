import { NetworkName } from "./demo-types"
import { displayHoldings } from "../test/helpers"
import { getNestedFactory } from "./helpers"
import { network } from "hardhat"
import { pickNFT } from "./cli-interaction"

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
