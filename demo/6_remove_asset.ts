import { ethers, network } from "hardhat"

import addresses from "./addresses.json"
import inquirer from "inquirer"

async function main() {
    const env = network.name
    const [user] = await ethers.getSigners()

    const NestedFactory = await ethers.getContractFactory("NestedFactory")
    const nestedFactory = await NestedFactory.attach((addresses as any)[env].factory)

    const WethContract = await ethers.getContractFactory("WETH9")
    const wethContract = await WethContract.attach((addresses as any)[env].tokens.WETH)

    // get ID for first NFT user has
    const [nftId] = await nestedFactory.tokensOf(user.address)

    console.log(nftId)
    // get the holdings for this NFT
    const holdings = await nestedFactory.tokenHoldings(nftId)
    if (holdings.length === 0) throw new Error("NFT is empty")

    const question = {
        message: "Pick the asset you want to sell",
        id: "sell",
        type: "list",
        choices: holdings.map((holding: any) => ({
            name: `${holding.token} (${holding.amount})`,
            value: holding.token,
        })),
    }
    const answers = await inquirer.prompt([question])
    console.log(answers)

    //    await nestedFactory.sellTokensToWallet(nftId, wethContract.address, [])

    //const holdings = await nestedFactory.tokenHoldings(1)
    //console.log("Holdings: ", holdings)
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error)
        process.exit(1)
    })
