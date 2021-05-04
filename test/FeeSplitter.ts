import { Contract } from "@ethersproject/contracts"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { expect } from "chai"
import { ethers } from "hardhat"

describe("Fee distribution", () => {
    let alice: SignerWithAddress,
        bob: SignerWithAddress,
        wallet3: SignerWithAddress,
        feeToSetter: SignerWithAddress,
        feeTo: SignerWithAddress
    let ERC20Mocks: Contract[]
    let feeSplitter: Contract

    before(async () => {
        const signers = await ethers.getSigners()
        // All transactions will be sent from Alice unless explicity specified
        alice = signers[0]
        bob = signers[1]
        wallet3 = signers[2]
        feeToSetter = signers[2]
        feeTo = signers[2]
    })

    beforeEach(async () => {
        const FeeSplitterFactory = await ethers.getContractFactory("FeeSplitter")

        ERC20Mocks = await Promise.all([
            deployMockToken("Mock1", "MOCK1", alice),
            deployMockToken("Mock2", "MOCK2", alice),
            deployMockToken("Mock3", "MOCK3", alice),
        ])

        feeSplitter = await FeeSplitterFactory.deploy([alice.address, bob.address], [5000, 3000], 2000)
    })

    describe("ERC20 tokens fees", () => {
        it("retrieves split token fees", async () => {
            const amount1 = ethers.utils.parseEther("3")
            const amount2 = ethers.utils.parseEther("5")

            await ERC20Mocks[0].approve(feeSplitter.address, amount1.add(amount2))
            await feeSplitter.sendFeesToken(ethers.constants.AddressZero, amount1, ERC20Mocks[0].address)
            await feeSplitter.sendFeesToken(wallet3.address, amount2, ERC20Mocks[0].address)

            const token = ERC20Mocks[0]
            await feeSplitter.connect(bob).releaseToken(bob.address, token.address)
            const balanceBob = await token.balanceOf(bob.address)
            const balanceAliceBefore = await token.balanceOf(alice.address)
            await feeSplitter.releaseToken(alice.address, token.address)
            const balanceAliceAfter = await token.balanceOf(alice.address)
            // Why 4.375? Alice has 5000 shares, we had two payments of 3 (no royalties) and 5 (has royalties). 0.625*3+0.5*5=4.375
            expect(balanceAliceAfter.sub(balanceAliceBefore)).to.equal(ethers.utils.parseEther("4.375"))
            // Bob can claim 37.5% of the fees. Same computation as aboove
            expect(balanceBob).to.equal(ethers.utils.parseEther("2.625"))
        })

        it("claims fees as NFT owner", async () => {
            const token = ERC20Mocks[0]
            const amount = ethers.utils.parseEther("6")
            await token.approve(feeSplitter.address, amount)
            await feeSplitter.sendFeesToken(wallet3.address, amount, token.address)

            await feeSplitter.connect(wallet3).releaseToken(wallet3.address, token.address)
            const balanceWallet3 = await token.balanceOf(wallet3.address)
            // wallet3 can claim 20% of the fees. 6 * 0.2
            expect(balanceWallet3).to.equal(ethers.utils.parseEther("1.2"))
        })

        it("should revert because no payment is due", async () => {
            const token = ERC20Mocks[0]
            const release = () => feeSplitter.connect(bob).releaseToken(bob.address, token.address)
            await expect(release()).to.be.revertedWith("FeeSplitter: NO_PAYMENT_DUE")
        })
    })

    describe("Changing weights", () => {
        it("updates the weights for fees distribution", async () => {
            await feeSplitter.setRoyaltiesWeight(3000)
            const bobIndex = await feeSplitter.findShareholder(bob.address)
            await feeSplitter.updateShareholder(bobIndex, 8000)
            await feeSplitter.updateShareholder(0, 2000)
            await clearBalance(bob, ERC20Mocks[0])
            await clearBalance(wallet3, ERC20Mocks[0])

            const releaseBob = () => feeSplitter.connect(bob).releaseToken(bob.address, ERC20Mocks[0].address)

            await sendFees("5", wallet3.address)
            await sendFees("1", ethers.constants.AddressZero)
            await sendFees("12", wallet3.address)

            await releaseBob()

            const bobBalance = await ERC20Mocks[0].balanceOf(bob.address)
            const toEther = (n: number) => ethers.utils.parseEther(n.toString())
            const totalWeights = await feeSplitter.totalWeights()
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

    const deployMockToken = async (name: string, symbol: string, owner: SignerWithAddress) => {
        const TokenFactory = await ethers.getContractFactory("MockERC20")
        return TokenFactory.connect(owner).deploy(name, symbol, ethers.utils.parseEther("1000000"))
    }

    const sendFees = async (amountEther: string, royaltiesTarget: string) => {
        const token = ERC20Mocks[0]
        const amount = ethers.utils.parseEther(amountEther)
        await token.approve(feeSplitter.address, amount)
        await feeSplitter.sendFeesToken(royaltiesTarget, amount, token.address)
    }

    const clearBalance = async (account: SignerWithAddress, token: Contract) => {
        const balance = await token.balanceOf(account.address)
        return token.connect(account).burn(balance)
    }
})
