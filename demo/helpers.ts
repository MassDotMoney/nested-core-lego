import { ethers, network } from "hardhat"

import { NetworkName } from "./demo-types"
import addresses from "./addresses.json"

const env = network.name as NetworkName

export const getNestedFactory = async () => {
    const NestedFactory = await ethers.getContractFactory("NestedFactory")
    return NestedFactory.attach(addresses[env].factory)
}

export const waitAndShowEtherscanLink = (tx: any) => {
    const subdomain = env === "ropsten" ? "ropsten." : ""
    console.log(`https://${subdomain}etherscan.io/tx/${tx.hash}`)
    return tx.wait()
}
