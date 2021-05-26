import { ethers, network } from "hardhat"
import { pickHolding, pickNFT, readAmountETH, readTokenAddress } from "./cli-interaction"

import { NetworkName } from "./demo-types"
import addresses from "./addresses.json"
import axios from "axios"
import qs from "qs"

async function main() {
    const env = network.name as NetworkName
    const [user] = await ethers.getSigners()

    const NestedFactory = await ethers.getContractFactory("NestedFactory")
    const nestedFactory = await NestedFactory.attach(addresses[env].factory)

    const nftId = await pickNFT()
    const token = await readTokenAddress()
    const inputAmount = await readAmountETH()
    const sellAmount = ethers.utils.parseEther(inputAmount.toString())

    const order = {
        sellToken: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
        buyToken: token,
        sellAmount: sellAmount.toString(),
        slippagePercentage: 0.3,
    }

    const response = await axios
        .get(`https://${env === "localhost" ? "ropsten" : env}.api.0x.org/swap/v1/quote?${qs.stringify(order)}`)
        .catch(console.error)

    if (!response) return

    const tx = await nestedFactory.addTokens(
        nftId,
        "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
        sellAmount,
        response.data.to,
        [
            {
                token,
                callData: response.data.data,
            },
        ],
        {
            value: sellAmount.add(sellAmount.div(100)),
        },
    )

    console.log("Transaction sent ", tx.hash)
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error)
        process.exit(1)
    })
