const { expect } = require("chai")

describe("Fee distribution", () => {
    before(async () => {
        this.PaymentSplitterFactory = await ethers.getContractFactory("PaymentSplitter")

        this.signers = await ethers.getSigners()
        // All transactions will be sent from Alice unless explicity specified
        this.alice = this.signers[0]
        this.bob = this.signers[1]
        this.feeToSetter = this.signers[2]
        this.feeTo = this.signers[2]
    })

    beforeEach(async () => {
        this.PaymentSplitter = await this.PaymentSplitterFactory.deploy(
            [this.alice.address, this.bob.address],
            [5000, 3000],
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

    describe("#release", () => {
        beforeEach(async () => {
            const amount1 = ethers.utils.parseEther("3")
            await this.PaymentSplitter.sendFees(ethers.constants.AddressZero, {
                value: amount1.toString(),
            })

            const amount2 = ethers.utils.parseEther("5")
            await this.PaymentSplitter.sendFees(this.bob.address, {
                value: amount2.toString(),
            })
        })

        it("retrieves splitted fees", async () => {
            const balanceBefore = await this.alice.getBalance()
            const tx = await this.PaymentSplitter.release(this.alice.address)
            const spentOnTx = await getTxGasSpent(tx)
            const balanceAfter = await this.alice.getBalance()
            expect(balanceAfter.sub(balanceBefore)).to.equal(ethers.utils.parseEther("4.375").sub(spentOnTx))
        })

        it("claims fees as NFT owner", async () => {
            const balanceBefore = await this.bob.getBalance()
            const tx = await this.PaymentSplitter.connect(this.bob).claim()
            const spentOnTx = await getTxGasSpent(tx)
            const balanceAfter = await this.bob.getBalance()
            expect(balanceAfter.sub(balanceBefore)).to.equal(ethers.utils.parseEther("1").sub(spentOnTx))
        })
    })

    const getTxGasSpent = async tx => {
        const receipt = await tx.wait()
        return receipt.gasUsed.mul(tx.gasPrice)
    }
})
