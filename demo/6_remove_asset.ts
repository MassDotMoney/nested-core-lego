import { ethers, network } from "hardhat"

import { BigNumber } from "@ethersproject/bignumber"
import { NetworkName } from "./demo-types"
import addresses from "./addresses.json"
import axios from "axios"
import { getTokenName } from "../test/helpers"
import inquirer from "inquirer"
import qs from "qs"

async function main() {
    const env = network.name as NetworkName
    const [user] = await ethers.getSigners()

    const NestedFactory = await ethers.getContractFactory("NestedFactory")
    const nestedFactory = await NestedFactory.attach(addresses[env].factory)

    const WethContract = await ethers.getContractFactory("WETH9")
    const wethContract = await WethContract.attach(addresses[env].tokens.WETH)

    const nftIds = await nestedFactory.tokensOf(user.address)

    const pickNftQuestion = {
        name: "nftId",
        message: "Pick the NFT you want to update",
        id: "sell",
        type: "list",
        choices: nftIds.map((id: BigNumber) => ({
            name: `#${id.toString()}`,
            value: id,
        })),
    }
    const nftPickAnswer = await inquirer.prompt([pickNftQuestion])

    const holdings = await nestedFactory.tokenHoldings(nftPickAnswer.nftId)
    if (holdings.length === 0) throw new Error("NFT is empty")

    const assetPickQuestion = {
        name: "asset",
        message: "Pick the asset you want to sell",
        id: "sell",
        type: "list",
        choices: holdings.map((holding: any) => ({
            name: `${getTokenName(holding.token, addresses[env].tokens)} (${holding.amount})`,
            value: holding,
        })),
    }
    const assetPickAnswer = await inquirer.prompt([assetPickQuestion])
    const pickedHolding = assetPickAnswer.asset

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
        nftPickAnswer.nftId,
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
