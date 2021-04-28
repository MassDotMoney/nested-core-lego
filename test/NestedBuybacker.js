const { Interface } = require("@ethersproject/abi")
const { expect } = require("chai")
const { ethers } = require("hardhat")

describe("NestedBuybacker", () => {
    before(async () => {
        this.signers = await ethers.getSigners()
        // All transactions will be sent from Alice unless explicity specified
        this.alice = this.signers[0]
        this.bob = this.signers[1]
        this.nestedReserve = this.signers[2]
        this.mockNST = await deployMockToken("NST", "NST", this.alice)
        this.mockUSDT = await deployMockToken("Fake USDT", "TDUS", this.alice)

        const DummyRouterFactory = await ethers.getContractFactory("DummyRouter")
        this.dummyRouter = await DummyRouterFactory.deploy(this.mockNST.address)
    })

    beforeEach(async () => {
        const NestedBuybackerFactory = await ethers.getContractFactory("NestedBuybacker")
        this.buyBacker = await NestedBuybackerFactory.deploy(this.mockNST.address, this.nestedReserve.address)
        // before each, empty the reserve NST balance
        await this.mockNST.connect(this.nestedReserve).burn(await this.mockNST.balanceOf(this.nestedReserve.address))
    })

    it("sends fees as ETH", async () => {
        await this.mockNST.transfer(this.dummyRouter.address, ethers.utils.parseEther("100000"))

        const abi = ["function dummyswapETH()"]
        const iface = new Interface(abi)
        const data = iface.encodeFunctionData("dummyswapETH")

        this.buyBacker.triggerForETH(data, this.dummyRouter.address, {
            value: ethers.utils.parseEther("10"),
        })
        // we bought 100 dummy tokens. Nested reserve should get 75% of that.
        expect(await this.mockNST.balanceOf(this.nestedReserve.address)).to.equal(ethers.utils.parseEther("75"))
    })

    it("sends fees as token", async () => {
        await this.mockNST.transfer(this.dummyRouter.address, ethers.utils.parseEther("100000"))

        const abi = ["function dummyswapToken(address inputToken, uint256 amount, address payable to)"]
        const iface = new Interface(abi)
        const data = iface.encodeFunctionData("dummyswapToken", [
            this.mockUSDT.address,
            ethers.utils.parseEther("200"),
            this.buyBacker.address,
        ])

        await this.mockUSDT.transfer(this.buyBacker.address, ethers.utils.parseEther("200"))
        await this.buyBacker.triggerForToken(data, this.dummyRouter.address, this.mockUSDT.address)
        // we bought 200 NST. Nested reserve should get 75% of that.
        expect(await this.mockNST.balanceOf(this.nestedReserve.address)).to.equal(ethers.utils.parseEther("150"))
    })

    const deployMockToken = async (name, symbol, owner) => {
        const TokenFactory = await ethers.getContractFactory("MockERC20")
        return TokenFactory.connect(owner).deploy(name, symbol, ethers.utils.parseEther("1000000"))
    }
})
