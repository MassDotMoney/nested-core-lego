const { expect } = require("chai")

describe("NestedToken", () => {
    before(async () => {
        this.NestedToken = await ethers.getContractFactory("NestedToken")

        this.signers = await ethers.getSigners()
        // All transaction will be sent from the Alice unless explicity specified
        this.alice = this.signers[0]
        this.bob = this.signers[1]
    })

    beforeEach(async () => {
        this.token = await this.NestedToken.deploy()
        await this.token.deployed()
    })

    describe("#mint", () => {
        it("should create ERC-20 and mint tokens to owner account", async () => {
            expect(await this.token.balanceOf(this.alice.address)).to.equal(
                ethers.utils.parseEther("150000000").toString(),
            )
        })
    })

    describe("#transfer", () => {
        it("should transfer token to bob account", async () => {
            await this.token.transfer(this.bob.address, ethers.utils.parseEther("500").toString())
            expect(await this.token.balanceOf(this.bob.address)).to.equal(ethers.utils.parseEther("500").toString())
        })

        it("Should fail if sender doesn’t have enough tokens", async () => {
            const initialOwnerBalance = await this.token.balanceOf(this.alice.address)

            // Try to send 1000 tokens from bob to alice.
            await expect(
                this.token.connect(this.bob).transfer(this.alice.address, ethers.utils.parseEther("1000").toString()),
            ).to.be.revertedWith("revert ERC20: transfer amount exceeds balance")

            // alice balance shouldn't have changed.
            expect(await this.token.balanceOf(this.alice.address)).to.equal(initialOwnerBalance)
        })
    })
})
