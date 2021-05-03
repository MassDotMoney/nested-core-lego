import axios from "axios"
import { expect } from "chai"
import * as qs from "qs"
//import ierc20Abi from "./../mocks/IERC20.json"
//import wethAbi from "./../mocks/IWETH.json"

import { ethers } from "hardhat"
import { Contract, ContractFactory } from "@ethersproject/contracts"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { Interface } from "@ethersproject/abi"
import { appendDecimals } from "./helpers"
import { BigNumber } from "@ethersproject/bignumber"

describe("NestedFactory", () => {
    let nestedFactory: ContractFactory, factory: Contract
    let alice: SignerWithAddress, bob: SignerWithAddress, feeToSetter: SignerWithAddress, feeTo: SignerWithAddress
    let mockWETH: Contract, mockUNI: Contract, mockKNC: Contract
    let dummyRouter: Contract

    const metadataUri = "ipfs://bafybeiam5u4xc5527tv6ghlwamd6azfthmcuoa6uwnbbvqbtsyne4p7khq/metadata.json"

    before(async () => {
        nestedFactory = await ethers.getContractFactory("NestedFactory")

        const signers = await ethers.getSigners()
        // All transactions will be sent from Alice unless explicity specified
        alice = signers[0] as any
        bob = signers[1] as any
        feeToSetter = signers[2] as any
        feeTo = signers[2] as any

        const dummyRouterFactory = await ethers.getContractFactory("DummyRouter")
        dummyRouter = await dummyRouterFactory.deploy()
    })

    beforeEach(async () => {
        factory = await nestedFactory.deploy(feeToSetter.address)
        await factory.deployed()

        const MockWETHFactory = await ethers.getContractFactory("WETH9")
        mockWETH = await MockWETHFactory.deploy()
    })

    describe("#initialization", () => {
        it("deploys a reserve contract", async () => {
            // TODO: test with dynamic reserve and assets contracts
        })
    })

    describe("#setFeeToSetter", () => {
        it("set feeToSetter state variable", async () => {
            await factory.connect(feeToSetter).setFeeToSetter(bob.address)
            expect(await factory.feeToSetter()).to.equal(bob.address)
        })

        it("reverts if unauthorized", async () => {
            await expect(factory.connect(alice).setFeeToSetter(bob.address)).to.be.revertedWith(
                "NestedFactory: FORBIDDEN",
            )
        })

        it("reverts if the address is invalid", async () => {
            await expect(
                factory.connect(feeToSetter).setFeeToSetter("0x0000000000000000000000000000000000000000"),
            ).to.be.revertedWith("NestedFactory: INVALID_ADDRESS")
        })
    })

    describe("#setFeeTo", () => {
        it("sets feeTo state variable", async () => {
            await factory.connect(feeToSetter).setFeeTo(bob.address)
            expect(await factory.feeTo()).to.equal(bob.address)
        })

        it("reverts if unauthorized", async () => {
            await expect(factory.connect(alice).setFeeTo(bob.address)).to.be.revertedWith("NestedFactory: FORBIDDEN")
        })

        it("reverts if the address is invalid", async () => {
            await expect(
                factory.connect(feeToSetter).setFeeTo("0x0000000000000000000000000000000000000000"),
            ).to.be.revertedWith("NestedFactory: INVALID_ADDRESS")
        })
    })

    describe("#create", () => {
        const totalSellAmount = appendDecimals(10)
        let tokensToBuy: string[] = []
        let tokenOrders: TokenOrder[] = []
        const expectedFee = totalSellAmount.div(100)

        beforeEach(async () => {
            const mockWETHFactory = await ethers.getContractFactory("WETH9")
            mockWETH = await mockWETHFactory.deploy()

            const mockERC20Factory = await ethers.getContractFactory("MockERC20")
            mockUNI = await mockERC20Factory.deploy("Mocked UNI", "INU", appendDecimals(3000000))
            mockKNC = await mockERC20Factory.deploy("Mcoked KNC", "CNK", appendDecimals(3000000))

            mockUNI.transfer(dummyRouter.address, appendDecimals(1000))
            mockKNC.transfer(dummyRouter.address, appendDecimals(1000))

            tokensToBuy = [mockUNI.address, mockKNC.address]

            mockWETH.approve(factory.address, appendDecimals(10.1))
            await mockWETH.deposit({ value: appendDecimals(10.1) })

            const abi = ["function dummyswapToken(address _inputToken, address _outputToken, uint256 _amount)"]
            const iface = new Interface(abi)

            tokenOrders = [
                {
                    token: tokensToBuy[0],
                    callData: iface.encodeFunctionData("dummyswapToken", [
                        mockWETH.address,
                        tokensToBuy[0],
                        appendDecimals(4),
                    ]),
                },
                {
                    token: tokensToBuy[1],
                    callData: iface.encodeFunctionData("dummyswapToken", [
                        mockWETH.address,
                        tokensToBuy[1],
                        appendDecimals(6),
                    ]),
                },
            ]
        })

        it("reverts if tokenOrders list is empty", async () => {
            await expect(
                factory.create(
                    0,
                    metadataUri,
                    mockWETH.address,
                    totalSellAmount.add(expectedFee),
                    dummyRouter.address,
                    [],
                ),
            ).to.be.revertedWith("BUY_ARG_MISSING")
        })

        //     it("reverts if user had no allowance for sellToken", async () => {
        //         await tokenToSellContract
        //             .connect(bob)
        //             .deposit({ value: ethers.utils.parseEther("10").toString() })

        //         await expect(
        //             factory
        //                 .connect(bob)
        //                 .create(
        //                     0,
        //                     metadataUri,
        //                     tokenToSell,
        //                     totalSellAmount.add(expectedFee),
        //                     responses[0].data.to,
        //                     tokensToBuy,
        //                     swapCallData,
        //                 ),
        //         ).to.be.revertedWith("FUNDS_TRANSFER_ERROR")
        //     })

        it.only("reverts if the user does not have enough funds", async () => {
            await mockWETH.withdraw(1)
            await expect(createNFTFromERC20(tokenOrders, totalSellAmount)).to.be.revertedWith("INSUFFICIENT_BALANCE")
        })

        it.only("reverts if the sell amount is less than total sum of token sales", async () => {
            await expect(createNFTFromERC20(tokenOrders, totalSellAmount.sub(1))).to.be.revertedWith("OVERSPENT_ERROR")
        })

        describe("creating from ERC20 tokens", async () => {
            it("creates the NFT", async () => {
                const initialWethBalance = await mockWETH.balanceOf(alice.address)

                await createNFTFromERC20(tokenOrders, totalSellAmount)

                const expectedAliceWethBalance = initialWethBalance.sub(totalSellAmount).sub(expectedFee)

                expect(await mockWETH.balanceOf(alice.address)).to.equal(expectedAliceWethBalance.toString())
                expect(await mockWETH.balanceOf(factory.feeTo())).to.equal(expectedFee.toString())

                const buyUNIAmount = appendDecimals(4)
                const buyKNCAmount = appendDecimals(6)

                expect(await mockUNI.balanceOf(factory.reserve())).to.equal(buyUNIAmount)
                expect(await mockKNC.balanceOf(factory.reserve())).to.equal(buyKNCAmount)

                // check if NFT was created
                const aliceTokens = await factory.tokensOf(alice.address)
                expect(aliceTokens.length).to.equal(1)

                // check number of assets in NFT token
                const result = await factory.tokenHoldings(aliceTokens[0])
                expect(result.length).to.equal(tokenOrders.length)
            })
        })

        //     describe("creating from ETH", async () => {
        //         it("reverts if insufficient funds sent in the transaction", async () => {
        //             await expect(
        //                 factory.create(
        //                     0,
        //                     metadataUri,
        //                     tokenToSell,
        //                     0,
        //                     responses[0].data.to,
        //                     tokensToBuy,
        //                     swapCallData,
        //                     { value: totalSellAmount },
        //                 ),
        //             ).to.be.revertedWith("INSUFFICIENT_FUNDS")
        //         })

        //         it("creates the NFT", async () => {
        //             const feeToInitialBalance = await tokenToSellContract.balanceOf(feeTo.address)

        //             await tokenToSellContract.approve(factory.address, ethers.utils.parseEther("100").toString())
        //             await factory.create(
        //                 0,
        //                 metadataUri,
        //                 tokenToSell,
        //                 totalSellAmount.add(expectedFee),
        //                 responses[0].data.to,
        //                 tokensToBuy,
        //                 swapCallData,
        //                 { value: totalSellAmount.add(expectedFee) },
        //             )

        //             const uni = new ethers.Contract(orders[0].buyToken, abi, alice)
        //             const link = new ethers.Contract(orders[1].buyToken, abi, alice)

        //             const expectedAliceWethBalance = initialWethBalance.sub(totalSellAmount).sub(expectedFee)

        //             expect(await tokenToSellContract.balanceOf(alice.address)).to.equal(
        //                 expectedAliceWethBalance.toString(),
        //             )

        //             expect(await tokenToSellContract.balanceOf(factory.feeTo())).to.equal(
        //                 expectedFee.toString(),
        //             )

        //             let buyUniAmount = ethers.BigNumber.from(responses[0].data.buyAmount)
        //             let buyLinkAmount = ethers.BigNumber.from(responses[1].data.buyAmount)

        //             expect(await uni.balanceOf(factory.reserve())).to.be.closeTo(buyUniAmount, buyUniAmount.div(100))
        //             expect(await link.balanceOf(factory.reserve())).to.be.closeTo(
        //                 buyLinkAmount,
        //                 buyLinkAmount.div(100),
        //             )

        //             const feeToFinalBalance = await tokenToSellContract.balanceOf(feeTo.address)
        //             expect(feeToFinalBalance.sub(feeToInitialBalance)).to.be.equal(expectedFee)

        //             // check if NFT was created
        //             let aliceTokens = await factory.tokensOf(alice.address)
        //             expect(aliceTokens.length).to.equal(1)

        //             // check that Bob's balance did not increase
        //             let bobTokens = await factory.tokensOf(bob.address)
        //             expect(bobTokens.length).to.equal(0)

        //             // check number of assets in NFT token
        //             let result = await factory.tokenHoldings(aliceTokens[0])
        //             expect(result.length).to.equal(tokensToBuy.length)
        //         })
        //     })
        // })

        // describe("#destroy", () => {
        //     beforeEach(async () => {
        //         await factory.create(
        //             0,
        //             metadataUri,
        //             tokenToSell,
        //             totalSellAmount.add(expectedFee),
        //             responses[0].data.to,
        //             tokensToBuy,
        //             swapCallData,
        //             { value: totalSellAmount.add(expectedFee) },
        //         )
        //     })

        //     it("reverts if token id is invalid", async () => {
        //         await expect(factory.destroy(ethers.utils.parseEther("999").toString())).to.be.revertedWith(
        //             "revert ERC721: owner query for nonexistent token",
        //         )
        //     })

        //     it("reverts if not owner", async () => {
        //         let aliceTokens = await factory.tokensOf(alice.address)
        //         await expect(factory.connect(bob).destroy(aliceTokens[0])).to.be.revertedWith(
        //             "revert NestedFactory: Only Owner",
        //         )
        //     })

        //     it("destroys NFT and send tokens to user", async () => {
        //         let aliceTokens = await factory.tokensOf(alice.address)
        //         factory.destroy(aliceTokens[0])
        //         aliceTokens = await factory.tokensOf(alice.address)
        //         expect(aliceTokens.length).to.equal(0)
        //     })
        // })

        // describe("#destroyForERC20", () => {
        //     beforeEach(async () => {
        //         console.log(expectedFee)
        //         console.log(totalSellAmount)
        //         console.log(totalSellAmount.add(expectedFee))
        //         await factory.create(
        //             0,
        //             metadataUri,
        //             tokenToSell,
        //             totalSellAmount.add(expectedFee),
        //             responses[0].data.to,
        //             tokensToBuy,
        //             swapCallData,
        //             { value: totalSellAmount.add(expectedFee) },
        //         )

        //         assets = await factory.tokensOf(alice.address)
        //         let holdings = []
        //         for (let i = 0; i < assets.length; i++) {
        //             holdings = await factory.tokenHoldings(assets[i])
        //         }
        //         // getting 0x quote for each of the tokens
        //         quotes = []
        //         for (let i = 0; i < holdings.length; i++) {
        //             let holding = holdings[i]
        //             let order = {
        //                 sellToken: holding.token,
        //                 buyToken: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", // WETH
        //                 sellAmount: holding.amount.toString(),
        //                 slippagePercentage: 0.05,
        //             }
        //             let quote = await axios.get(`https://api.0x.org/swap/v1/quote?${qs.stringify(order)}`)
        //             quotes.push(quote)
        //         }

        //         tokensToSell = []
        //         swapData = []

        //         for (let i = 0; i < quotes.length; i++) {
        //             tokensToSell.push(quotes[i].data.sellTokenAddress)
        //             swapData.push(quotes[i].data.data)
        //         }
        //     })

        //     it("reverts if token id is invalid", async () => {
        //         await expect(
        //             factory.destroyForERC20(
        //                 ethers.utils.parseEther("999").toString(),
        //                 "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", // or quotes[0].data.buyTokenAddress -> WETH
        //                 quotes[0].data.to,
        //                 tokensToSell,
        //                 swapData,
        //             ),
        //         ).to.be.revertedWith("revert ERC721: owner query for nonexistent token")
        //     })

        //     it("reverts if not owner", async () => {
        //         await expect(
        //             factory.connect(bob).destroyForERC20(
        //                 assets[0],
        //                 "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", // or quotes[0].data.buyTokenAddress -> WETH
        //                 quotes[0].data.to,
        //                 tokensToSell,
        //                 swapData,
        //             ),
        //         ).to.be.revertedWith("revert NestedFactory: Only Owner")
        //     })

        //     it("reverts if sell args missing", async () => {
        //         await expect(
        //             factory.destroyForERC20(
        //                 assets[0],
        //                 "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", // or quotes[0].data.buyTokenAddress -> WETH
        //                 quotes[0].data.to,
        //                 [],
        //                 swapData,
        //             ),
        //         ).to.be.revertedWith("MISSING_SELL_ARGS")
        //     })

        //     it("destroys NFT and send ERC20 to user", async () => {
        //         let aliceTokens = await factory.tokensOf(alice.address)
        //         factory.destroyForERC20(
        //             assets[0],
        //             "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", // or quotes[0].data.buyTokenAddress -> WETH
        //             quotes[0].data.to,
        //             tokensToSell,
        //             swapData,
        //         )
        //         aliceTokens = await factory.tokensOf(alice.address)
        //         expect(aliceTokens.length).to.equal(0)
        //     })
        // })

        // describe("#destroyForETH", () => {
        //     beforeEach(async () => {
        //         await factory.create(
        //             0,
        //             metadataUri,
        //             tokenToSell,
        //             totalSellAmount.add(expectedFee),
        //             responses[0].data.to,
        //             tokensToBuy,
        //             swapCallData,
        //             { value: totalSellAmount.add(expectedFee) },
        //         )

        //         assets = await factory.tokensOf(alice.address)
        //         let holdings = []
        //         for (let i = 0; i < assets.length; i++) {
        //             holdings = await factory.tokenHoldings(assets[i])
        //         }
        //         // getting 0x quote for each of the tokens
        //         quotes = []
        //         for (let i = 0; i < holdings.length; i++) {
        //             let order = {
        //                 sellToken: holdings[i].token,
        //                 buyToken: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", // WETH
        //                 sellAmount: holdings[i].amount.toString(),
        //                 slippagePercentage: 0.05,
        //             }
        //             let quote = await axios.get(`https://api.0x.org/swap/v1/quote?${qs.stringify(order)}`)
        //             quotes.push(quote)
        //         }

        //         tokensToSell = []
        //         swapData = []

        //         for (let i = 0; i < quotes.length; i++) {
        //             tokensToSell.push(quotes[i].data.sellTokenAddress)
        //             swapData.push(quotes[i].data.data)
        //         }
        //     })

        //     it("reverts if token id is invalid", async () => {
        //         await expect(
        //             factory.destroyForETH(
        //                 ethers.utils.parseEther("999").toString(),
        //                 quotes[0].data.to,
        //                 tokensToSell,
        //                 swapData,
        //             ),
        //         ).to.be.revertedWith("revert ERC721: owner query for nonexistent token")
        //     })

        //     it("reverts if not owner", async () => {
        //         await expect(
        //             factory
        //                 .connect(bob)
        //                 .destroyForETH(assets[0], quotes[0].data.to, tokensToSell, swapData),
        //         ).to.be.revertedWith("revert NestedFactory: Only Owner")
        //     })

        //     it("reverts if sell args missing", async () => {
        //         await expect(
        //             factory.destroyForETH(assets[0], quotes[0].data.to, [], swapData),
        //         ).to.be.revertedWith("MISSING_SELL_ARGS")
        //     })

        //     it("destroys NFT and send ETH to user", async () => {
        //         let aliceTokens = await factory.tokensOf(alice.address)
        //         factory.destroyForETH(assets[0], quotes[0].data.to, tokensToSell, swapData)
        //         aliceTokens = await factory.tokensOf(alice.address)
        //         expect(aliceTokens.length).to.equal(0)
        //         // TODO: also check user and reserve balance
        //     })
    })

    const createNFTFromERC20 = (
        tokenOrders: TokenOrder[],
        totalSellAmount: BigNumber,
        signer: SignerWithAddress = alice,
    ) =>
        factory
            .connect(signer)
            .create(0, metadataUri, mockWETH.address, totalSellAmount, dummyRouter.address, tokenOrders)

    const createNFTFromETH = () => {}

    interface TokenOrder {
        token: string
        callData: string
    }
})
