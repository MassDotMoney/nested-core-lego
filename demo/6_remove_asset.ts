import { ethers, network } from "hardhat"
import { pickHolding, pickNFT } from "./cli-interaction"

import { NetworkName } from "./demo-types"
import addresses from "./addresses.json"
import axios from "axios"
import qs from "qs"

async function main() {
    const env = network.name as NetworkName
    const [user] = await ethers.getSigners()

    const NestedFactory = await ethers.getContractFactory("NestedFactory")
    const nestedFactory = await NestedFactory.attach(addresses[env].factory)

    const WethContract = await ethers.getContractFactory("WETH9")
    const wethContract = await WethContract.attach(addresses[env].tokens.WETH)

    const nftId = await pickNFT()
    const pickedHolding = await pickHolding(nftId)

    const order = {
        sellToken: pickedHolding.token,
        buyToken: wethContract.address,
        sellAmount: pickedHolding.amount.toString(),
        slippagePercentage: 0.3,
    }
    const response = await axios
        .get(`https://${env === "localhost" ? "ropsten" : env}.api.0x.org/swap/v1/quote?${qs.stringify(order)}`)
        .catch(console.error)
    if (!response) return

    const tx = await nestedFactory.sellTokensToWallet(
        nftId,
        wethContract.address,
        [pickedHolding.token],
        [pickedHolding.amount],
        response.data.to,
        [
            {
                token: response.data.sellTokenAddress,
                callData: response.data.data,
            },
        ],
    )
    console.log("Transaction sent ", tx.hash)
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error)
        process.exit(1)
    })
