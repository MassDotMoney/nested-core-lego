import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { appendDecimals } from "../helpers";
import { ethers } from "hardhat";
import { expect } from "chai";
import { NestedRecords, NestedRecords__factory } from "../../typechain";

describe("NestedRecords", () => {
    let NestedRecords: NestedRecords__factory, nestedRecords: NestedRecords;
    let alice: SignerWithAddress, bob: SignerWithAddress;

    before(async () => {
        const signers = await ethers.getSigners();
        alice = signers[0] as any;
        bob = signers[1] as any;
    });

    beforeEach(async () => {
        NestedRecords = await ethers.getContractFactory("NestedRecords");
        nestedRecords = await NestedRecords.deploy(15);
        nestedRecords.addFactory(alice.address);
    });

    it("reverts when setting invalid factory", async () => {
        await expect(nestedRecords.addFactory(ethers.constants.AddressZero)).to.be.revertedWith("OFH: INVALID_ADDRESS");
    });

    it("reverts when calling a factory only function when not a factory", async () => {
        await expect(nestedRecords.connect(bob).setReserve(0, bob.address)).to.be.revertedWith("OFH: FORBIDDEN");
    });

    it("reverts when setting a wrong reserve to a NFT", async () => {
        await expect(nestedRecords.store(0, bob.address, 20, ethers.constants.AddressZero)).to.be.revertedWith(
            "NRC: INVALID_RESERVE",
        );
        await nestedRecords.store(0, bob.address, 20, alice.address);
        await expect(nestedRecords.store(0, bob.address, 20, bob.address)).to.be.revertedWith("NRC: RESERVE_MISMATCH");
    });

    it("reverts when calling store with too many orders", async () => {
        const maxHoldingsCount = await nestedRecords.maxHoldingsCount();
        const signers = await ethers.getSigners();
        for (let i = 0; i < maxHoldingsCount.toNumber(); i++) {
            await nestedRecords.store(0, signers[i + 3].address, 20, alice.address);
        }
        await expect(nestedRecords.store(0, bob.address, 20, alice.address)).to.be.revertedWith("NRC: TOO_MANY_TOKENS");
    });

    describe("#setMaxHoldingsCount", () => {
        it("reverts when setting an incorrect number of max holdings", async () => {
            await expect(nestedRecords.setMaxHoldingsCount(0)).to.be.revertedWith("NRC: INVALID_MAX_HOLDINGS");
        });

        it("sets max holdings count", async () => {
            await nestedRecords.setMaxHoldingsCount(1);
            expect(await nestedRecords.maxHoldingsCount()).to.eq(1);
        });
    });
});
