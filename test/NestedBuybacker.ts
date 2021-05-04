import { Interface } from "@ethersproject/abi"
import { Contract } from "@ethersproject/contracts"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { expect } from "chai"
import { ethers } from "hardhat"
import { appendDecimals } from "./helpers"

describe("NestedBuybacker", () => {
    let alice: SignerWithAddress, bob: SignerWithAddress, nestedReserve: SignerWithAddress
    let mockNST: Contract, mockUSDT: Contract
    let dummyRouter: Contract, buyBacker: Contract

    before(async () => {
        const signers = await ethers.getSigners()
        // All transactions will be sent from Alice unless explicity specified
        alice = signers[0]
        bob = signers[1]
        nestedReserve = signers[2]
        mockNST = await deployMockToken("NST", "NST", alice)
        mockUSDT = await deployMockToken("Fake USDT", "TDUS", alice)
    })

    beforeEach(async () => {
        const NestedBuybackerFactory = await ethers.getContractFactory("NestedBuybacker")
        buyBacker = await NestedBuybackerFactory.deploy(mockNST.address, nestedReserve.address, 250)
        // before each, empty the reserve NST balance
        await mockNST.connect(nestedReserve).burn(await mockNST.balanceOf(nestedReserve.address))

        const DummyRouterFactory = await ethers.getContractFactory("DummyRouter")
        dummyRouter = await DummyRouterFactory.deploy()
    })

    it("sends fees as ETH", async () => {
        await mockNST.transfer(dummyRouter.address, ethers.utils.parseEther("100000"))

        const abi = ["function dummyswapETH(address token)"]
        const iface = new Interface(abi)
        const data = iface.encodeFunctionData("dummyswapETH", [mockNST.address])

        buyBacker.triggerForETH(data, dummyRouter.address, {
            value: ethers.utils.parseEther("10"),
        })
        // we bought 100 dummy tokens. Nested reserve should get 75% of that.
        expect(await mockNST.balanceOf(nestedReserve.address)).to.equal(ethers.utils.parseEther("75"))
    })

    it("sends fees as token", async () => {
        await mockNST.transfer(dummyRouter.address, ethers.utils.parseEther("100000"))

        const abi = ["function dummyswapToken(address _inputToken, address _outputToken, uint256 _amount)"]
        const iface = new Interface(abi)
        const data = iface.encodeFunctionData("dummyswapToken", [
            mockUSDT.address,
            mockNST.address,
            ethers.utils.parseEther("200"),
        ])

        await mockUSDT.transfer(buyBacker.address, ethers.utils.parseEther("200"))
        await buyBacker.triggerForToken(data, dummyRouter.address, mockUSDT.address)
        // we bought 200 NST. Nested reserve should get 75% of that.
        expect(await mockNST.balanceOf(nestedReserve.address)).to.equal(ethers.utils.parseEther("150"))
    })

    const deployMockToken = async (name: string, symbol: string, owner: SignerWithAddress) => {
        const TokenFactory = await ethers.getContractFactory("MockERC20")
        return TokenFactory.connect(owner).deploy(name, symbol, ethers.utils.parseEther("1000000"))
    }
})
