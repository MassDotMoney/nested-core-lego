const { BigNumber } = require("@ethersproject/bignumber")
const { expect } = require("chai")
const { ethers } = require("hardhat")
const { getETHSpentOnGas } = require("./helpers")

describe("Fee distribution", () => {
    before(async () => {
        this.PaymentSplitterFactory = await ethers.getContractFactory("PaymentSplitter")

        this.signers = await ethers.getSigners()
        // All transactions will be sent from Alice unless explicity specified
        this.alice = this.signers[0]
        this.bob = this.signers[1]
        this.wallet3 = this.signers[2]
        this.feeToSetter = this.signers[2]
        this.feeTo = this.signers[2]

        this.ERC20Mocks = await Promise.all([
            deployMockToken("Mock1", "MOCK1", this.alice),
            deployMockToken("Mock2", "MOCK2", this.alice),
            deployMockToken("Mock3", "MOCK3", this.alice),
        ])
    })

    beforeEach(async () => {
        this.PaymentSplitter = await this.PaymentSplitterFactory.deploy(
            [this.alice.address, this.bob.address],
            [5000, 3000],
            2000,
        )
    })

    describe("#sendFees", () => {
        it("sends fees in ETH without royalties", async () => {
            const amount = ethers.utils.parseEther("2")
            await this.PaymentSplitter.sendFees(ethers.constants.AddressZero, {
                value: amount.toString(),
            })
        })
    })

    describe("ETH fees", () => {
        beforeEach(async () => {
            const amount1 = ethers.utils.parseEther("3")
            await this.PaymentSplitter.sendFees(ethers.constants.AddressZero, {
                value: amount1.toString(),
            })

            const amount2 = ethers.utils.parseEther("5")
            await this.PaymentSplitter.sendFees(this.wallet3.address, {
                value: amount2.toString(),
            })
        })

        it("retrieves split ETH fees", async () => {
            const balanceBefore = await this.alice.getBalance()
            const tx = await this.PaymentSplitter.release(this.alice.address)
            const spentOnTx = await getETHSpentOnGas(tx)
            const balanceAfter = await this.alice.getBalance()
            // Why 4.375? Alice has 5000 shares, we had two payments of 3 (no royalties) and 5ETH (has royalties). 0.625*3+0.5*3=4.375
            expect(balanceAfter.sub(balanceBefore)).to.equal(ethers.utils.parseEther("4.375").sub(spentOnTx))
        })

        it("claims fees as NFT owner", async () => {
            const balanceBefore = await this.bob.getBalance()
            const tx = await this.PaymentSplitter.connect(this.wallet3).release(this.wallet3.address)
            const spentOnTx = await getETHSpentOnGas(tx)
            const balanceAfter = await this.wallet3.getBalance()
            expect(balanceAfter.sub(balanceBefore)).to.equal(ethers.utils.parseEther("1").sub(spentOnTx))
        })
    })

    describe("ERC20 tokens fees", () => {
        beforeEach(async () => {
            const amount1 = ethers.utils.parseEther("3")

            await this.ERC20Mocks[0].approve(this.PaymentSplitter.address, amount1)
            await this.PaymentSplitter.sendFeesToken(ethers.constants.AddressZero, amount1, this.ERC20Mocks[0].address)
        })

        it("retrieves split token fees", async () => {
            const token = this.ERC20Mocks[0]
            await this.PaymentSplitter.connect(this.bob).releaseToken(this.bob.address, token.address)
            const balanceBob = await token.balanceOf(this.bob.address)
            // Bob can claim 37.5% of the fees. 3 * 0.375
            expect(balanceBob).to.equal(ethers.utils.parseEther("1.125"))
        })

        it("claims fees as NFT owner", async () => {
            const token = this.ERC20Mocks[0]
            const amount = ethers.utils.parseEther("6")
            await token.approve(this.PaymentSplitter.address, amount)
            await this.PaymentSplitter.sendFeesToken(this.wallet3.address, amount, token.address)

            await this.PaymentSplitter.connect(this.wallet3).releaseToken(this.wallet3.address, token.address)
            const balanceWallet3 = await token.balanceOf(this.wallet3.address)
            // wallet3 can claim 20% of the fees. 6 * 0.2
            expect(balanceWallet3).to.equal(ethers.utils.parseEther("1.2"))
        })

        it("should revert because no payment is due", async () => {
            const token = this.ERC20Mocks[0]
            const release = () => this.PaymentSplitter.connect(this.bob).releaseToken(this.bob.address, token.address)
            await release()
            await expect(release()).to.be.revertedWith("PaymentSplitter: NO_PAYMENT_DUE")
        })
    })

    describe("Changing weights", () => {
        it("updates the weights for fees distribution", async () => {
            await this.PaymentSplitter.setRoyaltiesWeight(3000)
            const bobIndex = await this.PaymentSplitter.findShareholder(this.bob.address)
            await this.PaymentSplitter.updateShareholder(bobIndex, 8000)
            await this.PaymentSplitter.updateShareholder(0, 2000)
            await clearBalance(this.bob, this.ERC20Mocks[0])
            await clearBalance(this.wallet3, this.ERC20Mocks[0])

            const releaseBob = () =>
                this.PaymentSplitter.connect(this.bob).releaseToken(this.bob.address, this.ERC20Mocks[0].address)

            await sendFees("5", this.wallet3.address)
            await sendFees("1", ethers.constants.AddressZero)
            await sendFees("12", this.wallet3.address)

            await releaseBob()

            const bobBalance = await this.ERC20Mocks[0].balanceOf(this.bob.address)
            const toEther = n => ethers.utils.parseEther(n.toString())
            const totalWeights = await this.PaymentSplitter.totalWeights()
            expect(totalWeights).to.equal(13000)
            // calculate expected bob's balance by manually adding fees for each transaction above
            const expectedBalance = toEther(5)
                .mul(8000)
                .div(totalWeights)
                .add(toEther(1).mul(8000).div(10000))
                .add(toEther(12).mul(8000).div(totalWeights))
            expect(bobBalance).to.equal(expectedBalance.add(1)) // adding 1 because of a rounding difference between js and solidity
        })
    })

    const deployMockToken = async (name, symbol, owner) => {
        const TokenFactory = await ethers.getContractFactory("MockERC20")
        return TokenFactory.connect(owner).deploy(name, symbol, ethers.utils.parseEther("1000000"))
    }

    const sendFees = async (amountEther, royaltiesTarget) => {
        const token = this.ERC20Mocks[0]
        const amount = ethers.utils.parseEther(amountEther)
        await token.approve(this.PaymentSplitter.address, amount)
        await this.PaymentSplitter.sendFeesToken(royaltiesTarget, amount, token.address)
    }

    const clearBalance = async (account, token) => {
        const balance = await token.balanceOf(account.address)
        return token.connect(account).burn(balance)
    }
})
