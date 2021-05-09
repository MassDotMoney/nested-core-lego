import { expect } from "chai"

import { ethers } from "hardhat"
import { Contract, ContractFactory } from "@ethersproject/contracts"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { Interface } from "@ethersproject/abi"
import { appendDecimals, getETHSpentOnGas } from "./helpers"
import { BigNumber } from "@ethersproject/bignumber"

describe("NestedFactory", () => {
    let nestedFactory: ContractFactory, factory: Contract
    let alice: SignerWithAddress,
        bob: SignerWithAddress,
        wallet3: SignerWithAddress,
        wallet4: SignerWithAddress,
        feeToSetter: SignerWithAddress,
        newReserve: SignerWithAddress
    let mockWETH: Contract, mockUNI: Contract, mockKNC: Contract, feeTo: Contract
    let nestedReserve: ContractFactory, reserve: Contract
    let nestedAsset: ContractFactory, asset: Contract
    let nestedRecords: ContractFactory, records: Contract
    let dummyRouter: Contract

    const metadataUri = "ipfs://bafybeiam5u4xc5527tv6ghlwamd6azfthmcuoa6uwnbbvqbtsyne4p7khq/metadata.json"

    before(async () => {
        nestedFactory = await ethers.getContractFactory("NestedFactory")
        nestedReserve = await ethers.getContractFactory("NestedReserve")
        nestedAsset = await ethers.getContractFactory("NestedAsset")
        nestedRecords = await ethers.getContractFactory("NestedRecords")

        const signers = await ethers.getSigners()
        // All transactions will be sent from Alice unless explicity specified
        alice = signers[0] as any
        bob = signers[1] as any
        feeToSetter = signers[2] as any
        wallet3 = signers[3] as any
        wallet4 = signers[4] as any
        feeTo = signers[5] as any
        newReserve = signers[6] as any

        const dummyRouterFactory = await ethers.getContractFactory("DummyRouter")
        dummyRouter = await dummyRouterFactory.deploy()
    })

    beforeEach(async () => {
        const MockWETHFactory = await ethers.getContractFactory("WETH9")
        mockWETH = await MockWETHFactory.deploy()

        const feeSplitterFactory = await ethers.getContractFactory("FeeSplitter")
        feeTo = await feeSplitterFactory.deploy([wallet3.address, wallet4.address], [1000, 1700], 300, mockWETH.address)

        asset = await nestedAsset.deploy()
        await asset.deployed()

        records = await nestedRecords.deploy()
        await records.deployed()

        factory = await nestedFactory.deploy(
            asset.address,
            records.address,
            feeToSetter.address,
            feeTo.address,
            mockWETH.address,
        )
        await factory.deployed()

        reserve = await nestedReserve.deploy(factory.address)
        await reserve.deployed()
        await factory.setReserve(reserve.address)

        await asset.setFactory(factory.address)
        await records.setFactory(factory.address)
    })

    describe("#initialization", () => {
        it("sets the state variables", async () => {
            expect(await factory.feeToSetter()).to.eq(feeToSetter.address)
            expect(await factory.feeTo()).to.eq(feeTo.address)
            expect(await factory.nestedAsset()).to.eq(asset.address)
            expect(await factory.weth()).to.eq(mockWETH.address)
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
            mockKNC = await mockERC20Factory.deploy("Mocked KNC", "CNK", appendDecimals(3000000))

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

                // check that fees were taken
                expect(await mockWETH.balanceOf(feeTo.address)).to.equal(expectedFee)
            })

            it("creates the NFT with an original token ID", async () => {
                await createNFTFromERC20(buyTokenOrders, totalSellAmount)
                const aliceTokens = await factory.tokensOf(alice.address)

                // bob buys WETH to purchase the NFT
                mockWETH.connect(bob).approve(factory.address, appendDecimals(10.1))
                await mockWETH.connect(bob).deposit({ value: appendDecimals(10.1) })

                await createNFTFromERC20(buyTokenOrders, totalSellAmount, bob, aliceTokens[0])

                // check if NFT was created
                const bobTokens = await factory.tokensOf(bob.address)
                expect(bobTokens.length).to.equal(1)

                // check that fees were taken (2 NFT bought = 2x expectedFee)
                expect(await mockWETH.balanceOf(feeTo.address)).to.equal(expectedFee.mul(2))

                // check that alice has been assigned royalties.
                // Should be 10% of the fee based on weights given to FeeSplitter
                expect(await feeTo.getAmountDue(alice.address, mockWETH.address)).to.equal(expectedFee.div(10))
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
                const aliceTokens = await factory.tokensOf(bob.address)
                expect(aliceTokens.length).to.equal(1)

                // check that fees were taken
                expect(await mockWETH.balanceOf(feeTo.address)).to.equal(expectedFee)
            })
        })
    })

    describe("#destroy", () => {
        const totalSellAmount = appendDecimals(10)
        let tokensToBuy: string[] = []
        let sellTokenOrders: TokenOrder[] = []
        let buyTokenOrders: TokenOrder[] = []
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
                "NestedFactory: NOT_TOKEN_OWNER",
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

            it("destroys a NFT with an original token ID", async () => {
                const aliceTokens = await factory.tokensOf(alice.address)

                // bob buys WETH to purchase the NFT
                mockWETH.connect(bob).approve(factory.address, appendDecimals(10.1))
                await mockWETH.connect(bob).deposit({ value: appendDecimals(10.1) })

                await createNFTFromERC20(buyTokenOrders, totalSellAmount, bob, aliceTokens[0])

                const [bobTokenId] = await factory.tokensOf(bob.address)
                await factory
                    .connect(bob)
                    .destroyForERC20(bobTokenId, mockWETH.address, dummyRouter.address, sellTokenOrders)

                // check that alice has been assigned royalties.
                // Should be twice 10% (createNFT + destroyNFT)
                expect(await feeTo.getAmountDue(alice.address, mockWETH.address)).to.equal(expectedFee.div(5))
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

        describe("#withdraw", () => {
            it("reverts if token index is invalid", async () => {
                // token address doesn't match
                await expect(factory.withdraw(assets[0], 1, mockUNI.address)).be.revertedWith("INVALID_TOKEN_INDEX")
                // index is out of bounds
                await expect(factory.withdraw(assets[0], 9, mockUNI.address)).be.revertedWith("INVALID_TOKEN_INDEX")
            })

            it("reverts if NFT has only one asset", async () => {
                await factory.withdraw(assets[0], 0, mockUNI.address)
                await expect(factory.withdraw(assets[0], 0, mockKNC.address)).be.revertedWith("ERR_EMPTY_NFT")
            })

            it("destroys without swapping tokens", async () => {
                await factory.destroy(assets[0])
                expect((await factory.tokensOf(alice.address)).length).to.equal(0)
                // fee should be 1% of 4UNI
                const fee = appendDecimals(4).div(100)
                const initialUNIBalance = appendDecimals(3000000).sub(appendDecimals(1000))
                expect(await mockUNI.balanceOf(feeTo.address)).to.equal(fee)
                expect(await mockUNI.balanceOf(alice.address)).to.equal(
                    initialUNIBalance.add(appendDecimals(4)).sub(fee),
                )
            })

            it("uses failsafe withdraw when swap fails", async () => {
                // corrupt swap call to make it fail
                const abi = ["function missing()"]
                const iface = new Interface(abi)
                sellTokenOrders[1].callData = iface.encodeFunctionData("missing")
                await factory.destroyForERC20(assets[0], mockWETH.address, dummyRouter.address, sellTokenOrders)
                const feeInKNC = appendDecimals(6).div(100)
                const initialKNCBalance = appendDecimals(3000000).sub(appendDecimals(1000))
                expect(await mockKNC.balanceOf(feeTo.address)).to.equal(feeInKNC)
                expect(await mockKNC.balanceOf(alice.address)).to.equal(
                    initialKNCBalance.add(appendDecimals(6).sub(feeInKNC)),
                )
                expect((await factory.tokensOf(alice.address)).length).to.equal(0)
            })
        })
    })

    describe("#setReserve", () => {
        it("sets the reserve", async () => {
            expect(await factory.reserve()).to.equal(reserve.address)
        })

        it("revers if the reserve is already set", async () => {
            await expect(factory.connect(alice).setReserve(newReserve.address)).to.be.revertedWith(
                "NestedFactory: FACTORY_IMMUTABLE",
            )
        })

        it("reverts if the address is invalid", async () => {
            await expect(factory.setReserve("0x0000000000000000000000000000000000000000")).to.be.revertedWith(
                "NestedFactory: INVALID_ADDRESS",
            )
        })
    })

    describe("#migrateAssets", () => {
        let assets: string[] = []

        beforeEach(async () => {
            const totalSellAmount = appendDecimals(10)
            const expectedFee = totalSellAmount.div(100)
            const mockERC20Factory = await ethers.getContractFactory("MockERC20")
            mockUNI = await mockERC20Factory.deploy("Mocked UNI", "INU", appendDecimals(3000000))
            mockKNC = await mockERC20Factory.deploy("Mcoked KNC", "CNK", appendDecimals(3000000))

            mockUNI.transfer(dummyRouter.address, appendDecimals(1000))
            mockKNC.transfer(dummyRouter.address, appendDecimals(1000))

            const tokensToBuy = [mockUNI.address, mockKNC.address]

            const abi = ["function dummyswapToken(address _inputToken, address _outputToken, uint256 _amount)"]
            const iface = new Interface(abi)

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
        it("registers a new reserve", async () => {
            await factory.registerReserve(bob.address)
            expect(await factory.knownReserves(bob.address)).to.be.true
        })

        it("should revert because reserve is not known", async () => {
            await expect(factory.migrateAssets(assets[0], bob.address)).to.be.revertedWith(
                "NestedFactory: NOT_A_RESERVE",
            )
        })

        it("migrates assets to new reserve", async () => {
            await factory.registerReserve(bob.address)
            await factory.migrateAssets(assets[0], bob.address)
            expect(await records.getAssetReserve(assets[0])).to.equal(bob.address)
            expect(await mockUNI.balanceOf(bob.address)).to.equal(appendDecimals(4))
            expect(await mockKNC.balanceOf(bob.address)).to.equal(appendDecimals(6))
        })
    })

    const createNFTFromERC20 = (
        tokenOrders: TokenOrder[],
        totalSellAmount: BigNumber,
        signer: SignerWithAddress = alice,
        originalTokenId: number = 0,
    ) =>
        factory
            .connect(signer)
            .create(originalTokenId, metadataUri, mockWETH.address, totalSellAmount, dummyRouter.address, tokenOrders)

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
