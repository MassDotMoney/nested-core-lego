import { Interface } from "@ethersproject/abi"
import { Contract } from "@ethersproject/contracts"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { expect } from "chai"
import { ethers } from "hardhat"
import { appendDecimals } from "./helpers"

describe("NestedBuybacker", () => {
    let alice: SignerWithAddress, bob: SignerWithAddress, nestedReserve: SignerWithAddress
    let mockNST: Contract, mockUSDT: Contract, mockWETH: Contract
    let dummyRouter: Contract, buyBacker: Contract, feeSplitter: Contract

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
        const wethFactory = await ethers.getContractFactory("WETH9")
        mockWETH = await wethFactory.deploy()

        const feeSplitterFactory = await ethers.getContractFactory("FeeSplitter")
        feeSplitter = await feeSplitterFactory.deploy([bob.address], [30], 20, mockWETH.address)

        const NestedBuybackerFactory = await ethers.getContractFactory("NestedBuybacker")
        buyBacker = await NestedBuybackerFactory.deploy(
            mockNST.address,
            nestedReserve.address,
            feeSplitter.address,
            250,
        )

        await feeSplitter.setShareholders([bob.address, buyBacker.address], [30, 50])

        // before each, empty the reserve NST balance
        await mockNST.connect(nestedReserve).burn(await mockNST.balanceOf(nestedReserve.address))

        const DummyRouterFactory = await ethers.getContractFactory("DummyRouter")
        dummyRouter = await DummyRouterFactory.deploy()
    })

    it("sends fees as token", async () => {
        await mockNST.transfer(dummyRouter.address, ethers.utils.parseEther("100000"))

        const abi = ["function dummyswapToken(address _inputToken, address _outputToken, uint256 _amount)"]
        const iface = new Interface(abi)
        const dataUSDT = iface.encodeFunctionData("dummyswapToken", [
            mockUSDT.address,
            mockNST.address,
            ethers.utils.parseEther("200"),
        ])

        const dataWETH = iface.encodeFunctionData("dummyswapToken", [
            mockWETH.address,
            mockNST.address,
            ethers.utils.parseEther("10"),
        ])

        // send 16WETH to the fee splitter so that buybacker gets 10WETH (62.5%)
        await mockWETH.deposit({ value: appendDecimals(16) })
        await mockWETH.approve(feeSplitter.address, appendDecimals(16))
        await feeSplitter.sendFeesToken(ethers.constants.AddressZero, appendDecimals(16), mockWETH.address)
        // also try sending token directly to buybacker (instead of using FeeSplitter)
        await mockUSDT.transfer(buyBacker.address, ethers.utils.parseEther("200"))

        await buyBacker.triggerForToken(dataUSDT, dummyRouter.address, mockUSDT.address)

        // we bought 200 NST. Nested reserve should get 75% of that.
        expect(await mockNST.balanceOf(nestedReserve.address)).to.equal(appendDecimals(150))

        await buyBacker.triggerForToken(dataWETH, dummyRouter.address, mockWETH.address)

        // we bought 10 WETH. Nested reserve should get 75% of that.
        expect(await mockNST.balanceOf(nestedReserve.address)).to.equal(
            appendDecimals(150).add(ethers.utils.parseEther("7.5")),
        )

        expect(await mockWETH.balanceOf(buyBacker.address)).to.equal(ethers.constants.Zero)
        expect(await mockNST.balanceOf(buyBacker.address)).to.equal(ethers.constants.Zero)
        expect(await mockUSDT.balanceOf(buyBacker.address)).to.equal(ethers.constants.Zero)
    })

    const deployMockToken = async (name: string, symbol: string, owner: SignerWithAddress) => {
        const TokenFactory = await ethers.getContractFactory("MockERC20")
        return TokenFactory.connect(owner).deploy(name, symbol, ethers.utils.parseEther("1000000"))
    }
})
