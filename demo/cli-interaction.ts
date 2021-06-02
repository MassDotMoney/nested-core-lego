import { ethers, network } from "hardhat"
import inquirer, { DistinctQuestion } from "inquirer"

import { BigNumber } from "@ethersproject/bignumber"
import { NetworkName } from "./demo-types"
import addresses from "./addresses.json"
import { getTokenName } from "../test/helpers"

const getNestedFactory = async () => {
    const env = network.name as NetworkName
    const NestedFactory = await ethers.getContractFactory("NestedFactory")
    return NestedFactory.attach(addresses[env].factory)
}

export const pickNFT = async (message: string = "Pick the NFT you want to update") => {
    const [user] = await ethers.getSigners()

    const nestedFactory = await getNestedFactory()
    const nftIds = await nestedFactory.tokensOf(user.address)

    const pickNftQuestion = {
        name: "nftId",
        message,
        id: "sell",
        type: "list",
        choices: nftIds.map((id: BigNumber) => ({
            name: `#${id.toString()}`,
            value: id,
        })),
    }
    const response = await inquirer.prompt([pickNftQuestion])
    return response.nftId
}

export const pickHolding = async (nftId: BigNumber) => {
    const [user] = await ethers.getSigners()
    const env = network.name as NetworkName
    const nestedFactory = await getNestedFactory()
    const holdings = await nestedFactory.tokenHoldings(nftId)

    if (holdings.length === 0) throw new Error("NFT is empty")

    const assetPickQuestion: DistinctQuestion = {
        name: "asset",
        message: "Pick the asset you want to sell",
        type: "list",
        choices: holdings.map((holding: any) => ({
            name: `${getTokenName(holding.token, addresses[env].tokens)} (${holding.amount})`,
            value: holding,
        })),
    }
    const assetPickAnswer = await inquirer.prompt([assetPickQuestion])
    return assetPickAnswer.asset
}

export const readTokenAddress = async (message: string) => {
    const tokenPickQuestion: DistinctQuestion = {
        name: "token",
        message,
        type: "input",
    }
    const response = await inquirer.prompt([tokenPickQuestion])
    return response.token
}

export const readAmountETH = async () => {
    const amountQuestion: DistinctQuestion = {
        name: "amount",
        message: "Enter the amount to add in ETH",
        type: "number",
        default: "0.1",
    }
    const response = await inquirer.prompt([amountQuestion])
    return response.amount
}

export const readNumber = async (message: string) => {
    const question: DistinctQuestion = {
        name: "count",
        message,
        type: "number",
        default: "1",
    }
    const response = await inquirer.prompt([question])
    return response.count
}
