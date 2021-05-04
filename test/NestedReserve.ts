import { expect } from "chai"

import { ethers } from "hardhat"
import { Contract, ContractFactory } from "@ethersproject/contracts"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { appendDecimals } from "./helpers"

describe("NestedReserve", () => {
    let nestedReserve: ContractFactory, reserve: Contract
    let mockERC20: ContractFactory, mockUNI: Contract
    let factory: SignerWithAddress, alice: SignerWithAddress

    const amountToTransfer = appendDecimals(10)
    before(async () => {
        nestedReserve = await ethers.getContractFactory("NestedReserve")
        mockERC20 = await ethers.getContractFactory("MockERC20")

        const signers = await ethers.getSigners()
        factory = signers[0] as any
        alice = signers[1] as any
    })

    beforeEach(async () => {
        reserve = await nestedReserve.deploy()
        await reserve.deployed()

        mockUNI = await mockERC20.deploy("Mocked UNI", "INU", 0)
        await mockUNI.mint(reserve.address, amountToTransfer)
    })

    describe("Initialization", async () => {
        it("sets the factory", async () => {
            expect(await reserve.factory()).to.eq(factory.address)
        })
    })

    describe("#transfer", async () => {
        it("transfer the funds", async () => {
            await reserve.transfer(alice.address, mockUNI.address, amountToTransfer)
            expect(await mockUNI.balanceOf(alice.address)).to.eq(amountToTransfer)
        })

        it("reverts if insufficient funds", async () => {
            await expect(reserve.transfer(alice.address, mockUNI.address, amountToTransfer.add(1))).to.be.revertedWith(
                "transfer amount exceeds balance",
            )
        })

        it("reverts if the recipient if unauthorized", async () => {
            await expect(
                reserve.connect(alice).transfer(alice.address, mockUNI.address, amountToTransfer),
            ).to.be.revertedWith("NestedReserve: UNAUTHORIZED")
        })

        it("reverts if the token is invalid", async () => {
            await expect(
                reserve.transfer(alice.address, "0x0000000000000000000000000000000000000000", amountToTransfer),
            ).to.be.revertedWith("NestedReserve: INVALID_ADDRESS")
        })

        it("reverts if the recipient is invalid", async () => {
            await expect(
                reserve.transfer("0x0000000000000000000000000000000000000000", mockUNI.address, amountToTransfer),
            ).to.be.revertedWith("NestedReserve: INVALID_ADDRESS")
        })
    })

    describe("#withdraw", async () => {
        it("transfer the funds", async () => {
            await reserve.withdraw(mockUNI.address, amountToTransfer)
            expect(await mockUNI.balanceOf(factory.address)).to.eq(amountToTransfer)
        })

        it("reverts if insufficient funds", async () => {
            await expect(reserve.withdraw(mockUNI.address, amountToTransfer.add(1))).to.be.revertedWith(
                "transfer amount exceeds balance",
            )
        })

        it("reverts if the recipient if unauthorized", async () => {
            await expect(reserve.connect(alice).withdraw(mockUNI.address, amountToTransfer)).to.be.revertedWith(
                "NestedReserve: UNAUTHORIZED",
            )
        })

        it("reverts if the token is invalid", async () => {
            await expect(
                reserve.withdraw("0x0000000000000000000000000000000000000000", amountToTransfer),
            ).to.be.revertedWith("NestedReserve: INVALID_ADDRESS")
        })
    })
})
