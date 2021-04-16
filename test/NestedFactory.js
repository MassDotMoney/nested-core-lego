const { expect } = require("chai")
const axios = require("axios").default
const qs = require("qs")
const abi = require("./../mocks/ERC20.json")
const weth = require("./../mocks/WETH.json")

describe("NestedFactory", () => {
    before(async () => {
        this.NestedFactory = await ethers.getContractFactory("NestedFactory")

        this.signers = await ethers.getSigners()
        // All transactions will be sent from Alice unless explicity specified
        this.alice = this.signers[0]
        this.bob = this.signers[1]
        this.feeToSetter = this.signers[2]
        this.feeTo = this.signers[2]
    })

    beforeEach(async () => {
        this.factory = await this.NestedFactory.deploy(this.feeToSetter.address)
        await this.factory.deployed()
    })

    describe("#initialization", () => {
        it("deploys a reserve contract", async () => {
            this.NestedReserve = await ethers.getContractFactory("NestedReserve")
            this.myReserve = await this.NestedReserve.deploy()
            await this.myReserve.deployed()
        })
    })

    describe("#setFeeToSetter", () => {
        it("set feeToSetter state variable", async () => {
            await this.factory.connect(this.feeToSetter).setFeeToSetter(this.bob.address)
            expect(await this.factory.feeToSetter()).to.equal(this.bob.address)
        })

        it("reverts if unauthorized", async () => {
            await expect(this.factory.connect(this.alice).setFeeToSetter(this.bob.address)).to.be.revertedWith(
                "NestedFactory: FORBIDDEN",
            )
        })

        it("reverts if the address is invalid", async () => {
            await expect(
                this.factory.connect(this.alice).setFeeToSetter("0x0000000000000000000000000000000000000000"),
            ).to.be.revertedWith("NestedFactory: INVALID_ADDRESS")
        })
    })

    describe("#setFeeTo", () => {
        it("sets feeTo state variable", async () => {
            await this.factory.connect(this.feeToSetter).setFeeTo(this.bob.address)
            expect(await this.factory.feeTo()).to.equal(this.bob.address)
        })

        it("reverts if unauthorized", async () => {
            await expect(this.factory.connect(this.alice).setFeeTo(this.bob.address)).to.be.revertedWith(
                "NestedFactory: FORBIDDEN",
            )
        })

        it("reverts if the address is invalid", async () => {
            await expect(
                this.factory.connect(this.alice).setFeeTo("0x0000000000000000000000000000000000000000"),
            ).to.be.revertedWith("NestedFactory: INVALID_ADDRESS")
        })
    })

    describe("#create", () => {
        before(async () => {
            this.tokenToSell = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2" // WETH
            this.tokenToSellContract = new ethers.Contract(this.tokenToSell, weth, this.alice)

            this.orders = [
                {
                    sellToken: this.tokenToSell,
                    buyToken: "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984", // Uni
                    sellAmount: ethers.utils.parseEther("1").toString(),
                    slippagePercentage: 0.3,
                },
                {
                    sellToken: this.tokenToSell,
                    buyToken: "0xdd974d5c2e2928dea5f71b9825b8b646686bd200", // KNC
                    sellAmount: ethers.utils.parseEther("2").toString(),
                    slippagePercentage: 0.3,
                },
            ]

            this.responses = []
            // TODO mock external call
            const resp1 = await axios.get(`https://api.0x.org/swap/v1/quote?${qs.stringify(this.orders[0])}`)
            const resp2 = await axios.get(`https://api.0x.org/swap/v1/quote?${qs.stringify(this.orders[1])}`)

            this.responses.push(resp1)
            this.responses.push(resp2)

            this.maximumSellAmount = 0
            this.tokensToBuy = []
            this.swapCallData = []

            this.maximumSellAmount = ethers.BigNumber.from(this.maximumSellAmount).add(
                ethers.BigNumber.from(this.responses[0].data.sellAmount),
            )

            this.tokensToBuy.push(this.responses[0].data.buyTokenAddress)
            this.swapCallData.push(this.responses[0].data.data)

            this.maximumSellAmount = ethers.BigNumber.from(this.maximumSellAmount).add(
                ethers.BigNumber.from(this.responses[1].data.sellAmount),
            )
            this.tokensToBuy.push(this.responses[1].data.buyTokenAddress)
            this.swapCallData.push(this.responses[1].data.data)
        })

        it("reverts if tokenToBuy list is empty", async () => {
            await expect(
                this.factory.create(
                    this.tokenToSell,
                    this.maximumSellAmount,
                    this.responses[0].data.to,
                    [],
                    this.swapCallData,
                ),
            ).to.be.revertedWith("BUY_ARG_MISSING")
        })

        it("reverts if no swapCall data for all token to buy", async () => {
            await expect(
                this.factory.create(
                    this.tokenToSell,
                    this.maximumSellAmount,
                    this.responses[0].data.to,
                    this.tokensToBuy,
                    [],
                ),
            ).to.be.revertedWith("BUY_ARG_ERROR")
        })

        it("reverts if allowance was not set for sellToken", async () => {
            await expect(
                this.factory.create(
                    this.tokenToSell,
                    this.maximumSellAmount,
                    this.responses[0].data.to,
                    this.tokensToBuy,
                    this.swapCallData,
                ),
            ).to.be.revertedWith("ALLOWANCE_ERROR")
        })

        it("reverts if the user does not have enough funds", async () => {
            await this.tokenToSellContract.approve(this.factory.address, ethers.utils.parseEther("100").toString())
            await expect(
                this.factory.create(
                    this.tokenToSell,
                    this.maximumSellAmount,
                    this.responses[0].data.to,
                    this.tokensToBuy,
                    this.swapCallData,
                ),
            ).to.be.revertedWith("INSUFFICIENT_FUNDS")
        })

        it("creates the NFT with ERC2O provided", async () => {
            this.initialWethBalance = ethers.utils.parseEther("10")
            await this.tokenToSellContract.deposit({ value: this.initialWethBalance.toString() })

            await this.tokenToSellContract.approve(this.factory.address, ethers.utils.parseEther("100").toString())
            await this.factory.create(
                this.tokenToSell,
                this.maximumSellAmount,
                this.responses[0].data.to,
                this.tokensToBuy,
                this.swapCallData,
            )

            const uni = new ethers.Contract(this.orders[0].buyToken, abi, this.alice)
            const link = new ethers.Contract(this.orders[1].buyToken, abi, this.alice)

            const expectedFee = this.maximumSellAmount.div(100)
            const expectedAliceWethBalance = this.initialWethBalance.sub(this.maximumSellAmount).sub(expectedFee)

            expect(await this.tokenToSellContract.balanceOf(this.alice.address)).to.equal(
                expectedAliceWethBalance.toString(),
            )
            expect(await this.tokenToSellContract.balanceOf(this.factory.feeTo())).to.equal(expectedFee.toString())

            let buyUniAmount = ethers.BigNumber.from(this.responses[0].data.buyAmount)
            let buyLinkAmount = ethers.BigNumber.from(this.responses[1].data.buyAmount)

            expect(await uni.balanceOf(this.factory.reserve())).to.be.closeTo(buyUniAmount, buyUniAmount.div(100))
            expect(await link.balanceOf(this.factory.reserve())).to.be.closeTo(buyLinkAmount, buyLinkAmount.div(100))

            // check if NFT was created
            let aliceTokens = await this.factory.tokensOf(this.alice.address)
            expect(aliceTokens.length).to.equal(1)

            // check that Bob's balance did not increase
            let bobTokens = await this.factory.tokensOf(this.bob.address)
            expect(bobTokens.length).to.equal(0)

            // check number of assets in NFT token
            let result = await this.factory.tokenHoldings(aliceTokens[0])
            expect(result.length).to.equal(this.tokensToBuy.length)
        })
    })

    describe("#createFromETH", () => {
        before(async () => {
            this.tokenToSell = "ETH"
            this.orders = [
                {
                    sellToken: this.tokenToSell,
                    buyToken: "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984", // Uni
                    sellAmount: ethers.utils.parseEther("1").toString(),
                    slippagePercentage: 0.3,
                },
                {
                    sellToken: this.tokenToSell,
                    buyToken: "0x6b175474e89094c44da98b954eedeac495271d0f", // DAI
                    sellAmount: ethers.utils.parseEther("2").toString(),
                    slippagePercentage: 0.3,
                },
            ]

            this.responses = []
            // TODO mock external call
            const resp1 = await axios.get(`https://api.0x.org/swap/v1/quote?${qs.stringify(this.orders[0])}`)
            const resp2 = await axios.get(`https://api.0x.org/swap/v1/quote?${qs.stringify(this.orders[1])}`)

            this.responses.push(resp1)
            this.responses.push(resp2)

            this.sellAmounts = []
            this.tokensToBuy = []
            this.swapCallData = []

            this.sellAmounts.push(ethers.BigNumber.from(this.responses[0].data.sellAmount))
            this.tokensToBuy.push(this.responses[0].data.buyTokenAddress)
            this.swapCallData.push(this.responses[0].data.data)

            this.sellAmounts.push(ethers.BigNumber.from(this.responses[1].data.sellAmount))
            this.tokensToBuy.push(this.responses[1].data.buyTokenAddress)
            this.swapCallData.push(this.responses[1].data.data)

            this.totalSellAmount = ethers.BigNumber.from(this.sellAmounts[0]).add(
                ethers.BigNumber.from(this.sellAmounts[1]),
            )

            this.expectedFee = this.totalSellAmount.div(100)
        })

        it("reverts if token to buy list is empty", async () => {
            await expect(
                this.factory.createFromETH(this.sellAmounts, this.responses[0].data.to, [], this.swapCallData),
            ).to.be.revertedWith("BUY_ARG_MISSING")
        })

        it("reverts if no swapCall data for all token to buy", async () => {
            await expect(
                this.factory.createFromETH(this.sellAmounts, this.responses[0].data.to, this.tokensToBuy, []),
            ).to.be.revertedWith("BUY_ARG_ERROR")
        })

        it("reverts if no sellAmount for each token to buy", async () => {
            await expect(
                this.factory.createFromETH([], this.responses[0].data.to, this.tokensToBuy, this.swapCallData),
            ).to.be.revertedWith("SELL_AMOUNT_ERROR")
        })

        it("reverts if insufficient funds sent in the transaction", async () => {
            await expect(
                this.factory.createFromETH(
                    this.sellAmounts,
                    this.responses[0].data.to,
                    this.tokensToBuy,
                    this.swapCallData,
                    { value: this.sellAmounts[0] },
                ),
            ).to.be.revertedWith("INSUFFICIENT_FUNDS")
        })

        it("creates the NFT with ETH provided", async () => {
            const feeToInitialBalance = await this.feeTo.getBalance()

            await this.factory.createFromETH(
                this.sellAmounts,
                this.responses[0].data.to,
                this.tokensToBuy,
                this.swapCallData,
                { value: this.totalSellAmount.add(this.expectedFee) },
            )

            const uni = new ethers.Contract(this.orders[0].buyToken, abi, this.alice)
            const link = new ethers.Contract(this.orders[1].buyToken, abi, this.alice)

            const buyAmount1 = ethers.BigNumber.from(this.responses[0].data.buyAmount)
            const buyAmount2 = ethers.BigNumber.from(this.responses[1].data.buyAmount)

            const feeToFinalBalance = await this.feeTo.getBalance()
            expect(feeToFinalBalance.sub(feeToInitialBalance)).to.be.equal(this.expectedFee)

            // reserve balance for token bought should be within 1% of buy amount
            expect(await uni.balanceOf(this.factory.reserve())).to.be.closeTo(buyAmount1, buyAmount1.div(100))
            expect(await link.balanceOf(this.factory.reserve())).to.be.closeTo(buyAmount2, buyAmount2.div(100))

            // check if NFT was created
            const aliceTokens = await this.factory.tokensOf(this.alice.address)
            expect(aliceTokens.length).to.equal(1)

            // check that Bob's balance did not increase
            const bobTokens = await this.factory.tokensOf(this.bob.address)
            expect(bobTokens.length).to.equal(0)

            // check number of assets in NFT token
            const result = await this.factory.tokenHoldings(aliceTokens[0])
            expect(result.length).to.equal(this.tokensToBuy.length)
        })
    })

    describe("#destroy", () => {
        beforeEach(async () => {
            await this.factory.createFromETH(
                this.sellAmounts,
                this.responses[0].data.to,
                this.tokensToBuy,
                this.swapCallData,
                { value: this.totalSellAmount.add(this.expectedFee) },
            )
        })

        it("reverts if token id is invalid", async () => {
            await expect(this.factory.destroy(ethers.utils.parseEther("999").toString())).to.be.revertedWith(
                "revert ERC721: owner query for nonexistent token",
            )
        })

        it("reverts if not owner", async () => {
            let aliceTokens = await this.factory.tokensOf(this.alice.address)
            await expect(this.factory.connect(this.bob).destroy(aliceTokens[0])).to.be.revertedWith(
                "revert NestedFactory: Only Owner",
            )
        })

        it("destroys NFT and send tokens to user", async () => {
            let aliceTokens = await this.factory.tokensOf(this.alice.address)
            this.factory.destroy(aliceTokens[0])
            aliceTokens = await this.factory.tokensOf(this.alice.address)
            expect(aliceTokens.length).to.equal(0)
        })
    })

    describe("#destroyForERC20", () => {
        beforeEach(async () => {
            await this.factory.createFromETH(
                this.sellAmounts,
                this.responses[0].data.to,
                this.tokensToBuy,
                this.swapCallData,
                { value: this.totalSellAmount.add(this.expectedFee) },
            )

            this.assets = await this.factory.tokensOf(this.alice.address)
            let holdings = []
            for (let i = 0; i < this.assets.length; i++) {
                holdings = await this.factory.tokenHoldings(this.assets[i])
            }
            // getting 0x quote for each of the tokens
            this.quotes = []
            for (let i = 0; i < holdings.length; i++) {
                let holding = holdings[i]
                let order = {
                    sellToken: holding.token,
                    buyToken: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", // WETH
                    sellAmount: holding.amount.toString(),
                    slippagePercentage: 0.05,
                }
                let quote = await axios.get(`https://api.0x.org/swap/v1/quote?${qs.stringify(order)}`)
                this.quotes.push(quote)
            }

            this.tokensToSell = []
            this.swapData = []

            for (let i = 0; i < this.quotes.length; i++) {
                this.tokensToSell.push(this.quotes[i].data.sellTokenAddress)
                this.swapData.push(this.quotes[i].data.data)
            }
        })

        it("reverts if token id is invalid", async () => {
            await expect(
                this.factory.destroyForERC20(
                    ethers.utils.parseEther("999").toString(),
                    "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", // or quotes[0].data.buyTokenAddress -> WETH
                    this.quotes[0].data.to,
                    this.tokensToSell,
                    this.swapData,
                ),
            ).to.be.revertedWith("revert ERC721: owner query for nonexistent token")
        })

        it("reverts if not owner", async () => {
            await expect(
                this.factory.connect(this.bob).destroyForERC20(
                    this.assets[0],
                    "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", // or quotes[0].data.buyTokenAddress -> WETH
                    this.quotes[0].data.to,
                    this.tokensToSell,
                    this.swapData,
                ),
            ).to.be.revertedWith("revert NestedFactory: Only Owner")
        })

        it("destroys NFT and send ERC20 to user", async () => {
            let aliceTokens = await this.factory.tokensOf(this.alice.address)
            this.factory.destroyForERC20(
                this.assets[0],
                "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", // or quotes[0].data.buyTokenAddress -> WETH
                this.quotes[0].data.to,
                this.tokensToSell,
                this.swapData,
            )
            aliceTokens = await this.factory.tokensOf(this.alice.address)
            expect(aliceTokens.length).to.equal(0)
        })
    })
})
