const { expect } = require("chai")
const axios = require("axios").default
const qs = require("qs")
abi = require("./../mocks/ERC20.json")

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
        it("should set feeToSetter", async () => {
            await this.factory.connect(this.feeToSetter).setFeeToSetter(this.bob.address)
            expect(await this.factory.feeToSetter()).to.equal(this.bob.address)
        })

        it("should revert if not authorized", async () => {
            await expect(this.factory.connect(this.alice).setFeeToSetter(this.bob.address)).to.be.revertedWith(
                "NestedFactory: FORBIDDEN",
            )
        })
    })

    describe("#setFeeTo", () => {
        it("should set feeTo", async () => {
            await this.factory.connect(this.feeToSetter).setFeeTo(this.bob.address)
            expect(await this.factory.feeTo()).to.equal(this.bob.address)
        })

        it("should revert if not authorized", async () => {
            await expect(this.factory.connect(this.alice).setFeeTo(this.bob.address)).to.be.revertedWith(
                "NestedFactory: FORBIDDEN",
            )
        })
    })

    describe("#create", () => {
        before(async () => {
            this.tokenToSell = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"; // WETH

            console.log('first wrap some ETH to WETH');
            await this.factory.depositETH("0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",{value: ethers.utils.parseEther("10").toString()})

            this.orders = [{
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
        
            this.responses = [];
            const resp1 = await axios.get(`https://api.0x.org/swap/v1/quote?${qs.stringify(this.orders[0])}`);
            const resp2 = await axios.get(`https://api.0x.org/swap/v1/quote?${qs.stringify(this.orders[1])}`);

        
            this.responses.push(resp1)
            this.responses.push(resp2);
        
            this.maximumSellAmount = 0;
            this.tokensToBuy = [];
            this.swapCallData = [];
        
            this.maximumSellAmount = ethers.BigNumber.from(this.maximumSellAmount).add(ethers.BigNumber.from(this.responses[0].data.sellAmount));

            this.tokensToBuy.push(this.responses[0].data.buyTokenAddress);
            this.swapCallData.push(this.responses[0].data.data);
        
            this.maximumSellAmount = ethers.BigNumber.from(this.maximumSellAmount).add(ethers.BigNumber.from(this.responses[1].data.sellAmount));
            this.tokensToBuy.push(this.responses[1].data.buyTokenAddress);
            this.swapCallData.push(this.responses[1].data.data);
        })

        beforeEach(async () => {
        })

        it("revert if token to buy list is empty", async () => {
            await expect(this.factory.create(this.tokenToSell, this.maximumSellAmount, this.responses[0].data.to, [], this.swapCallData)).to.be.revertedWith(
                "BUY_ARG_MISSING",
            )
        })

        it("revert if no swapCall data for all token to buy", async () => {
            await expect(this.factory.create(this.tokenToSell, this.maximumSellAmount, this.responses[0].data.to, this.tokensToBuy, [])).to.be.revertedWith(
                "BUY_ARG_ERROR",
            )
        })

        it("revert if allowance was not set for sellToken", async () => {
            await expect(this.factory.create(this.tokenToSell, this.maximumSellAmount, this.responses[0].data.to, this.tokensToBuy, this.swapCallData)).to.be.revertedWith(
                "USER_FUND_ALLOWANCE_ERROR",
            )
        })

        it("should swap tokens", async () => {
            const tokenToSellContract = new ethers.Contract(this.tokenToSell, abi, this.alice)
            await tokenToSellContract.approve(this.factory.address, ethers.utils.parseEther("100"))
            await this.factory.create(this.tokenToSell, this.maximumSellAmount, this.responses[0].data.to, this.tokensToBuy, this.swapCallData)

            const uni = new ethers.Contract(this.orders[0].buyToken, abi, this.alice)
            const link = new ethers.Contract(this.orders[1].buyToken, abi, this.alice)
            // WETH balance of user should be 10 - 1 - 1 - 0.03 (for fees)
            expect(await tokenToSellContract.balanceOf(this.alice.address)).to.equal(ethers.utils.parseEther("7.97").toString())
            expect(await tokenToSellContract.balanceOf(this.factory.feeTo())).to.equal(ethers.utils.parseEther("0.03").toString())

            let buyUniAmount = ethers.BigNumber.from(this.responses[0].data.buyAmount);
            let buyUniPercent = buyUniAmount.mul(ethers.utils.parseEther("1").toString()).div(ethers.utils.parseEther("100").toString())
            let buyLinkAmount = ethers.BigNumber.from(this.responses[1].data.buyAmount);
            let buyLinkPercent = buyLinkAmount.mul(ethers.utils.parseEther("1").toString()).div(ethers.utils.parseEther("100").toString())
            // reserve balance for token bought should be greater than 0
            expect(await uni.balanceOf(this.factory.reserve())).to.within(buyUniAmount.sub(buyUniPercent).toString(),buyUniAmount.add(buyUniPercent).toString())
            expect(await link.balanceOf(this.factory.reserve())).to.within(buyLinkAmount.sub(buyLinkPercent).toString(),buyLinkAmount.add(buyLinkPercent).toString())

            let result = await this.factory.tokensOf(this.alice.address);
            expect(result.length).to.equal(1);

        })

        

        // describe 2 tokens
        // owned = true
        // test balance reserve +
        // test balance user -
        // test balance fees +
        // owned = false
        // test 0x
        // test balance reserve +
        // test balance fees +
        // push holding

        // test balance user between (initial - amount - 1%, initial - amount + 1%)
    })
})
