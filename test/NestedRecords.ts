import { expect } from "chai"

import { ethers } from "hardhat"
import { Contract } from "@ethersproject/contracts"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"

describe("NestedRecords", () => {
    let nestedRecords: Contract
    let alice: SignerWithAddress, bob: SignerWithAddress

    before(async () => {
        const signers = await ethers.getSigners()
        alice = signers[0] as any
        bob = signers[1] as any
    })

    beforeEach(async () => {
        const nestedRecordsFactory = await ethers.getContractFactory("NestedRecords")
        nestedRecords = await nestedRecordsFactory.deploy()
        nestedRecords.setFactory(alice.address)
    })

    it("reverts when setting invalid factory", async () => {
        await expect(nestedRecords.setFactory(ethers.constants.AddressZero)).to.be.revertedWith(
            "NestedRecords: INVALID_ADDRESS",
        )
    })

    it("reverts when calling a factory only function when not a factory", async () => {
        await expect(nestedRecords.connect(bob).setReserve(0, bob.address)).to.be.revertedWith(
            "NestedRecords: FORBIDDEN",
        )
    })

    it("reverts when setting a wrong reserve to a NFT", async () => {
        await expect(nestedRecords.store(0, bob.address, 20, ethers.constants.AddressZero)).to.be.revertedWith(
            "NestedRecords: INVALID_RESERVE",
        )
        await nestedRecords.store(0, bob.address, 20, alice.address)
        await expect(nestedRecords.store(0, bob.address, 20, bob.address)).to.be.revertedWith(
            "NestedRecords: INVALID_RESERVE",
        )
    })

    it("reverts when calling store with too many orders", async () => {
        const MAX_HOLDING_COUNT = 15
        const signers = await ethers.getSigners()
        for (let i = 0; i < MAX_HOLDING_COUNT; i++) {
            await nestedRecords.store(0, signers[i+3].address, 20, alice.address)
        }
        await expect(nestedRecords.store(0, bob.address, 20, alice.address)).to.be.revertedWith(
            "NestedRecords: TOO_MANY_ORDERS",
        )
    })
})
