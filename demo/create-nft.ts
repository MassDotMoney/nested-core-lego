import axios, { AxiosResponse } from "axios"
import { ethers, network } from "hardhat"

import { BigNumber } from "ethers"
import { NetworkName } from "./demo-types"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import addresses from "./addresses.json"
import qs from "qs"

const create = async (useWeth: boolean, user?: SignerWithAddress, replicateNFT: number = 0) => {
    const env = network.name as NetworkName
    const WETH = addresses[env].tokens.WETH
    if (!user) [user] = await ethers.getSigners()

    const NestedFactory = await ethers.getContractFactory("NestedFactory")
    const nestedFactory = await NestedFactory.attach(addresses[env].factory)

    const WethContract = await ethers.getContractFactory("WETH9")
    const wethContract = await WethContract.attach(WETH)

    const orders = [
        {
            sellToken: addresses[env].tokens.WETH,
            buyToken: addresses[env].tokens.DAI,
            sellAmount: ethers.utils.parseEther("0.003").toString(),
            slippagePercentage: 0.3,
        },
        {
            sellToken: addresses[env].tokens.WETH,
            buyToken: addresses[env].tokens.MKR,
            sellAmount: ethers.utils.parseEther("0.001").toString(),
            slippagePercentage: 0.3,
        },
        {
            sellToken: addresses[env].tokens.WETH,
            buyToken: addresses[env].tokens.BAT,
            sellAmount: ethers.utils.parseEther("0.002").toString(),
            slippagePercentage: 0.3,
        },
        {
            sellToken: addresses[env].tokens.WETH,
            buyToken: addresses[env].tokens.WBTC,
            sellAmount: ethers.utils.parseEther("0.003").toString(),
            slippagePercentage: 0.3,
        },
        {
            sellToken: addresses[env].tokens.WETH,
            buyToken: addresses[env].tokens.KNC,
            sellAmount: ethers.utils.parseEther("0.009").toString(),
            slippagePercentage: 0.3,
        },
        {
            sellToken: addresses[env].tokens.WETH,
            buyToken: addresses[env].tokens.REP,
            sellAmount: ethers.utils.parseEther("0.005").toString(),
            slippagePercentage: 0.3,
        },
        {
            sellToken: addresses[env].tokens.WETH,
            buyToken: addresses[env].tokens.USDC,
            sellAmount: ethers.utils.parseEther("0.002").toString(),
            slippagePercentage: 0.3,
        },
        {
            sellToken: addresses[env].tokens.WETH,
            buyToken: addresses[env].tokens.ZRX,
            sellAmount: ethers.utils.parseEther("0.001").toString(),
            slippagePercentage: 0.3,
        },
        {
            sellToken: addresses[env].tokens.WETH,
            buyToken: addresses[env].tokens.SAI,
            sellAmount: ethers.utils.parseEther("0.001").toString(),
            slippagePercentage: 0.3,
        },
        {
            sellToken: addresses[env].tokens.WETH,
            buyToken: addresses[env].tokens.POLY,
            sellAmount: ethers.utils.parseEther("0.005").toString(),
            slippagePercentage: 0.3,
        },
        {
            sellToken: addresses[env].tokens.WETH,
            buyToken: addresses[env].tokens.LINK,
            sellAmount: ethers.utils.parseEther("0.009").toString(),
            slippagePercentage: 0.3,
        },
    ]
    let responses = (await Promise.all(
        orders.map(async order =>
            axios.get(`https://${env}.api.0x.org/swap/v1/quote?${qs.stringify(order)}`).catch(err => console.log(err)),
        ),
    )) as AxiosResponse<any>[]

    if (responses.length === 0) {
        console.error("0x didn't send any quote.")
        process.exit(1)
    }
    responses = responses.filter(element => element !== undefined)

    let sellAmounts: BigNumber[] = []
    let tokenOrders: { token: string; callData: string }[] = []

    responses.forEach(response => {
        sellAmounts.push(ethers.BigNumber.from(response.data.sellAmount))
        tokenOrders.push({ token: response.data.buyTokenAddress, callData: response.data.data })
    })
    const totalSellAmount = sellAmounts.reduce((p, c) => p.add(c))

    const totalSellAmountWithFees = totalSellAmount.add(totalSellAmount.div(100))

    let sellToken = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"

    if (useWeth) {
        const tx0 = await wethContract.connect(user).deposit({ value: totalSellAmountWithFees })
        await tx0.wait()
        const tx1 = await wethContract.connect(user).approve(nestedFactory.address, totalSellAmountWithFees)
        await tx1.wait()
        sellToken = WETH
    }

    const metadataUri = "ipfs://bafybeiam5u4xc5527tv6ghlwamd6azfthmcuoa6uwnbbvqbtsyne4p7khq/metadata.json"
    const tx2 = await nestedFactory
        .connect(user)
        .create(replicateNFT, metadataUri, sellToken, totalSellAmount, responses[0].data.to, tokenOrders, {
            value: !useWeth && totalSellAmountWithFees,
        })
    return tx2.wait()
}

export const createNFTFromETH = (user?: SignerWithAddress, replicateNFT: number = 0) =>
    create(false, user, replicateNFT)

export const createNFTFromWETH = (user?: SignerWithAddress, replicateNFT: number = 0) =>
    create(true, user, replicateNFT)
