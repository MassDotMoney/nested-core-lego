const { expect } = require("chai")

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
        beforeEach(async () => {
            this.nestedToken1 = await this.NestedToken.deploy()
            await this.nestedToken1.deployed()

            this.nestedToken2 = await this.NestedToken.deploy()
            await this.nestedToken2.deployed()
        })

        it("revert if token list is empty", async () => {
            this.tokens = []
            this.amounts = [10, 0.1].map(e => ethers.BigNumber.from(ethers.utils.parseEther(e.toString())))
            this.owned = [true, true]

            await expect(this.factory.create(this.tokens, this.amounts, this.owned)).to.be.revertedWith(
                "TOKENS_ARG_ERROR",
            )
        })

        it("revert if tokens size is different than amounts size", async () => {
            this.tokens = [this.nestedToken1.address]
            this.amounts = [10, 0.1].map(e => ethers.BigNumber.from(ethers.utils.parseEther(e.toString())))
            this.owned = [true, true]
            await expect(this.factory.create(this.tokens, this.amounts, this.owned)).to.be.revertedWith(
                "AMOUNTS_ARG_ERROR",
            )
        })

        it("revert if tokens size is different than owned size", async () => {
            this.tokens = [this.nestedToken1.address]
            this.amounts = [10].map(e => ethers.BigNumber.from(ethers.utils.parseEther(e.toString())))
            this.owned = [true, true]
            await expect(this.factory.create(this.tokens, this.amounts, this.owned)).to.be.revertedWith(
                "OWNER_ARG_ERROR",
            )
        })

        it("should store the tokenId", async () => {
            this.tokens = [this.nestedToken1.address]
            this.amounts = [10].map(e => ethers.BigNumber.from(ethers.utils.parseEther(e.toString())))
            this.owned = [true]

            await expect(this.factory.create(this.tokens, this.amounts, this.owned)).to.be.revertedWith(
                "ERC20: transfer amount exceeds allowance",
            )
            expect(await this.factory.usersTokenIds[this.alice.address]).to.equal(2)
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
