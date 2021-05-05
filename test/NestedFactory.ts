import { expect } from "chai"

import { ethers } from "hardhat"
import { Contract, ContractFactory } from "@ethersproject/contracts"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { Interface } from "@ethersproject/abi"
import { appendDecimals, getETHSpentOnGas } from "./helpers"
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
        const MockWETHFactory = await ethers.getContractFactory("WETH9")
        mockWETH = await MockWETHFactory.deploy()

        factory = await nestedFactory.deploy(feeToSetter.address, mockWETH.address)
        await factory.deployed()
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
        let buyTokenOrders: TokenOrder[] = []
        const expectedFee = totalSellAmount.div(100)

        beforeEach(async () => {
            const mockERC20Factory = await ethers.getContractFactory("MockERC20")
            mockUNI = await mockERC20Factory.deploy("Mocked UNI", "INU", appendDecimals(3000000))
            mockKNC = await mockERC20Factory.deploy("Mcoked KNC", "CNK", appendDecimals(3000000))

            mockUNI.transfer(dummyRouter.address, appendDecimals(1000))
            mockKNC.transfer(dummyRouter.address, appendDecimals(1000))

            tokensToBuy = [mockUNI.address, mockKNC.address]

            const abi = ["function dummyswapToken(address _inputToken, address _outputToken, uint256 _amount)"]
            const iface = new Interface(abi)

            buyTokenOrders = [
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

        describe("creating from ERC20 tokens", async () => {
            beforeEach(async () => {
                mockWETH.approve(factory.address, appendDecimals(10.1))
                await mockWETH.deposit({ value: appendDecimals(10.1) })
            })

            it("reverts if the sell amount is less than total sum of token sales", async () => {
                await expect(createNFTFromERC20(buyTokenOrders, totalSellAmount.sub(1))).to.be.revertedWith(
                    "OVERSPENT_ERROR",
                )
            })

            it("reverts if tokenOrders list is empty", async () => {
                await expect(createNFTFromERC20([], totalSellAmount.add(expectedFee))).to.be.revertedWith(
                    "BUY_ARG_MISSING",
                )
            })
            it("reverts if the user does not have enough funds", async () => {
                await mockWETH.withdraw(1)
                await expect(createNFTFromERC20(buyTokenOrders, totalSellAmount)).to.be.revertedWith(
                    "INSUFFICIENT_BALANCE",
                )
            })

            it("creates the NFT", async () => {
                const initialWethBalance = await mockWETH.balanceOf(alice.address)

                await createNFTFromERC20(buyTokenOrders, totalSellAmount)

                const expectedAliceWethBalance = initialWethBalance.sub(totalSellAmount).sub(expectedFee)

                expect(await mockWETH.balanceOf(alice.address)).to.equal(expectedAliceWethBalance)
                expect(await mockWETH.balanceOf(factory.feeTo())).to.equal(expectedFee)

                const buyUNIAmount = appendDecimals(4)
                const buyKNCAmount = appendDecimals(6)

                expect(await mockUNI.balanceOf(factory.reserve())).to.equal(buyUNIAmount)
                expect(await mockKNC.balanceOf(factory.reserve())).to.equal(buyKNCAmount)

                // check if NFT was created
                const aliceTokens = await factory.tokensOf(alice.address)
                expect(aliceTokens.length).to.equal(1)

                // check number of assets in NFT token
                const result = await factory.tokenHoldings(aliceTokens[0])
                expect(result.length).to.equal(buyTokenOrders.length)
            })
        })

        describe("creating from ETH", async () => {
            it("reverts if insufficient funds sent in the transaction", async () => {
                await expect(
                    createNFTFromETH(buyTokenOrders, totalSellAmount, totalSellAmount.sub(1)),
                ).to.be.revertedWith("INSUFFICIENT_AMOUNT_IN")
            })

            // TODO: figure out why we can't calculate gas spending for alice
            it("creates the NFT", async () => {
                const initialBobBalance = await bob.getBalance()
                const tx = await createNFTFromETH(
                    buyTokenOrders,
                    totalSellAmount,
                    totalSellAmount.add(expectedFee),
                    bob,
                )

                const expectedBobBalance = initialBobBalance
                    .sub(totalSellAmount)
                    .sub(expectedFee)
                    .sub(await getETHSpentOnGas(tx))

                expect(await bob.getBalance()).to.equal(expectedBobBalance)
                expect(await mockWETH.balanceOf(factory.feeTo())).to.equal(expectedFee.toString())

                // check if NFT was created
                let aliceTokens = await factory.tokensOf(bob.address)
                expect(aliceTokens.length).to.equal(1)
            })
        })

        describe("#destroy", () => {
            const totalSellAmount = appendDecimals(10)
            let tokensToBuy: string[] = []
            let sellTokenOrders: TokenOrder[] = []
            const expectedFee = totalSellAmount.div(100)
            let assets: string[] = []

            beforeEach(async () => {
                const mockERC20Factory = await ethers.getContractFactory("MockERC20")
                mockUNI = await mockERC20Factory.deploy("Mocked UNI", "INU", appendDecimals(3000000))
                mockKNC = await mockERC20Factory.deploy("Mcoked KNC", "CNK", appendDecimals(3000000))

                mockUNI.transfer(dummyRouter.address, appendDecimals(1000))
                mockKNC.transfer(dummyRouter.address, appendDecimals(1000))

                tokensToBuy = [mockUNI.address, mockKNC.address]

                const abi = ["function dummyswapToken(address _inputToken, address _outputToken, uint256 _amount)"]
                const iface = new Interface(abi)

                sellTokenOrders = [
                    {
                        token: tokensToBuy[0],
                        callData: iface.encodeFunctionData("dummyswapToken", [
                            tokensToBuy[0],
                            mockWETH.address,
                            appendDecimals(4),
                        ]),
                    },
                    {
                        token: tokensToBuy[1],
                        callData: iface.encodeFunctionData("dummyswapToken", [
                            tokensToBuy[1],
                            mockWETH.address,
                            appendDecimals(6),
                        ]),
                    },
                ]

                const buyTokenOrders = [
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

                await mockWETH.deposit({ value: appendDecimals(10.1) })
                await createNFTFromETH(buyTokenOrders, totalSellAmount, totalSellAmount.add(expectedFee))
                assets = await factory.tokensOf(alice.address)
            })

            it("reverts if token id is invalid", async () => {
                await expect(factory.destroy(ethers.utils.parseEther("999").toString())).to.be.revertedWith(
                    "revert ERC721: owner query for nonexistent token",
                )
            })

            it("reverts if not owner", async () => {
                let aliceTokens = await factory.tokensOf(alice.address)
                await expect(factory.connect(bob).destroy(aliceTokens[0])).to.be.revertedWith(
                    "revert NestedFactory: Only Owner",
                )
            })

            it("destroys NFT and send tokens to user", async () => {
                let aliceTokens = await factory.tokensOf(alice.address)
                factory.destroy(aliceTokens[0])
                aliceTokens = await factory.tokensOf(alice.address)
                expect(aliceTokens.length).to.equal(0)
            })

            describe("#destroyForERC20", () => {
                it("reverts if sell args missing", async () => {
                    await expect(
                        factory.destroyForERC20(assets[0], mockWETH.address, dummyRouter.address, []),
                    ).to.be.revertedWith("MISSING_SELL_ARGS")
                })

                it("destroys NFT and send ERC20 to user", async () => {
                    const aliceTokensBefore = await factory.tokensOf(alice.address)
                    expect(aliceTokensBefore.length).to.equal(1)
                    await factory.destroyForERC20(assets[0], mockWETH.address, dummyRouter.address, sellTokenOrders)
                    const aliceTokensAfter = await factory.tokensOf(alice.address)
                    expect(aliceTokensAfter.length).to.equal(0)
                })
            })

            describe("#destroyForETH", () => {
                it("destroys NFT and send ETH to user", async () => {
                    const balanceAliceBefore = await alice.getBalance()
                    const tx = await factory.destroyForETH(assets[0], dummyRouter.address, sellTokenOrders)
                    const txSpent = await getETHSpentOnGas(tx)
                    const aliceTokens = await factory.tokensOf(alice.address)
                    expect(aliceTokens.length).to.equal(0)
                    const expectedBalance = balanceAliceBefore
                        .add(totalSellAmount)
                        .sub(totalSellAmount.div(100))
                        .sub(txSpent)
                    expect(await alice.getBalance()).to.equal(expectedBalance)
                })
            })
        })
    })

    const createNFTFromERC20 = (
        tokenOrders: TokenOrder[],
        totalSellAmount: BigNumber,
        signer: SignerWithAddress = alice,
    ) =>
        factory
            .connect(signer)
            .create(0, metadataUri, mockWETH.address, totalSellAmount, dummyRouter.address, tokenOrders)

    const createNFTFromETH = (
        tokenOrders: TokenOrder[],
        totalSellAmount: BigNumber,
        ethValue: BigNumber,
        signer: SignerWithAddress = alice,
    ) =>
        factory
            .connect(signer)
            .create(
                0,
                metadataUri,
                "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
                totalSellAmount,
                dummyRouter.address,
                tokenOrders,
                {
                    value: ethValue,
                },
            )

    interface TokenOrder {
        token: string
        callData: string
    }
})
