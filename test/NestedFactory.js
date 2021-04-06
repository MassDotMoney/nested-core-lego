const { expect } = require("chai")
const axios = require("axios").default
const qs = require("qs")
const abi = require("./../mocks/ERC20.json")
const weth = require("./../mocks/WETH.json")

describe("NestedFactory", () => {
    before(async () => {
        this.NestedFactory = await ethers.getContractFactory("NestedFactory")
        this.NestedToken = await hre.ethers.getContractFactory("NestedToken")

        this.signers = await ethers.getSigners()
        // All transaction will be sent from Alice unless explicity specified
        this.alice = this.signers[0]
        this.bob = this.signers[1]
        this.feeToSetter = this.signers[2]
    })

    beforeEach(async () => {
        this.factory = await this.NestedFactory.deploy(this.feeToSetter.address)
        await this.factory.deployed()
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
    })

    describe("#create", () => {
        before(async () => {
            this.tokenToSell = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2" // WETH
            this.tokenToSellContract = new ethers.Contract(this.tokenToSell, weth, this.alice)

            await this.tokenToSellContract.deposit({ value: ethers.utils.parseEther("10").toString() })

            this.orders = [
                {
                    sellToken: this.tokenToSell,
                    buyToken: "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984", // Uni
                    sellAmount: ethers.utils.parseEther("1").toString(),
                },
                {
                    sellToken: this.tokenToSell,
                    buyToken: "0xdd974d5c2e2928dea5f71b9825b8b646686bd200", // KNC
                    sellAmount: ethers.utils.parseEther("1").toString(),
                },
            ]

            this.responses = []
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

        beforeEach(async () => {})

        it("reverts if token to buy list is empty", async () => {
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
            ).to.be.revertedWith("USER_FUND_ALLOWANCE_ERROR")
        })

        it("creates the NFT with ERC2O provided", async () => {
            await this.tokenToSellContract.approve(this.factory.address, ethers.utils.parseEther("100"))
            await this.factory.create(
                this.tokenToSell,
                this.maximumSellAmount,
                this.responses[0].data.to,
                this.tokensToBuy,
                this.swapCallData,
            )

            const uni = new ethers.Contract(this.orders[0].buyToken, abi, this.alice)
            const link = new ethers.Contract(this.orders[1].buyToken, abi, this.alice)
            // WETH balance of user should be 10 - 1 - 1 - 0.03 (for fees)
            expect(await this.tokenToSellContract.balanceOf(this.alice.address)).to.equal(
                ethers.utils.parseEther("7.97").toString(),
            )
            expect(await this.tokenToSellContract.balanceOf(this.factory.feeTo())).to.equal(
                ethers.utils.parseEther("0.03").toString(),
            )

            let buyUniAmount = ethers.BigNumber.from(this.responses[0].data.buyAmount)
            let buyUniPercent = buyUniAmount
                .mul(ethers.utils.parseEther("1").toString())
                .div(ethers.utils.parseEther("100").toString())
            let buyLinkAmount = ethers.BigNumber.from(this.responses[1].data.buyAmount)
            let buyLinkPercent = buyLinkAmount
                .mul(ethers.utils.parseEther("1").toString())
                .div(ethers.utils.parseEther("100").toString())
            // reserve balance for token bought should be within 1% of buy amount
            expect(await uni.balanceOf(this.factory.reserve())).to.within(
                buyUniAmount.sub(buyUniPercent).toString(),
                buyUniAmount.add(buyUniPercent).toString(),
            )
            expect(await link.balanceOf(this.factory.reserve())).to.within(
                buyLinkAmount.sub(buyLinkPercent).toString(),
                buyLinkAmount.add(buyLinkPercent).toString(),
            )
            // check if NFT was created
            let NFTs = await this.factory.tokensOf(this.alice.address)
            expect(NFTs.length).to.equal(1)

            // check number of assets in NFT token
            let result = await this.factory.tokenHoldings(NFTs[0])
            expect(result.length).to.equal(this.tokensToBuy.length)
        })
        //TO DO : Add refund ERC20
    })

    describe("#createFromETH", () => {
        before(async () => {
            this.tokenToSell = "ETH"

            this.orders = [
                {
                    sellToken: this.tokenToSell,
                    buyToken: "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984", // Uni
                    sellAmount: ethers.utils.parseEther("1").toString(),
                },
                {
                    sellToken: this.tokenToSell,
                    buyToken: "0x6b175474e89094c44da98b954eedeac495271d0f", // DAI
                    sellAmount: ethers.utils.parseEther("1").toString(),
                },
            ]

            this.responses = []
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
            ).to.be.revertedWith("INSUFFICIENT_FUNDS_RECEIVED")
        })

        it("creates the NFT with ETH provided", async () => {
            await this.factory.createFromETH(
                this.sellAmounts,
                this.responses[0].data.to,
                this.tokensToBuy,
                this.swapCallData,
                { value: this.totalSellAmount },
            )

            const uni = new ethers.Contract(this.orders[0].buyToken, abi, this.alice)
            const link = new ethers.Contract(this.orders[1].buyToken, abi, this.alice)

            let buyUniAmount = ethers.BigNumber.from(this.responses[0].data.buyAmount)
            let buyUniSlippage = buyUniAmount
                .mul(ethers.utils.parseEther("1").toString())
                .div(ethers.utils.parseEther("100").toString())

            let buyLinkAmount = ethers.BigNumber.from(this.responses[1].data.buyAmount)
            let buyLinkSlippage = buyLinkAmount
                .mul(ethers.utils.parseEther("1").toString())
                .div(ethers.utils.parseEther("100").toString())

            // reserve balance for token bought should be within 1% of buy amount
            expect(await uni.balanceOf(this.factory.reserve())).to.within(
                buyUniAmount.sub(buyUniSlippage).toString(),
                buyUniAmount.add(buyUniSlippage).toString(),
            )
            expect(await link.balanceOf(this.factory.reserve())).to.within(
                buyLinkAmount.sub(buyLinkSlippage).toString(),
                buyLinkAmount.add(buyLinkSlippage).toString(),
            )

            // check if NFT was created
            let NFTs = await this.factory.tokensOf(this.alice.address)
            expect(NFTs.length).to.equal(1)

            // check number of assets in NFT token
            let result = await this.factory.tokenHoldings(NFTs[0])
            expect(result.length).to.equal(this.tokensToBuy.length)
        })
        //TO DO : Add refund ETH
    })
})
