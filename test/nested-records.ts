import { Contract, ContractFactory } from "@ethersproject/contracts";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { appendDecimals } from "./helpers";
import { ethers } from "hardhat";
import { expect } from "chai";

describe("NestedRecords", () => {
    let NestedRecords: ContractFactory, nestedRecords: Contract;
    let alice: SignerWithAddress, bob: SignerWithAddress;

    before(async () => {
        const signers = await ethers.getSigners();
        alice = signers[0] as any;
        bob = signers[1] as any;
    });

    beforeEach(async () => {
        NestedRecords = await ethers.getContractFactory("NestedRecords");
        nestedRecords = await NestedRecords.deploy(15);
        nestedRecords.setFactory(alice.address);
    });

    it("reverts when setting invalid factory", async () => {
        await expect(nestedRecords.setFactory(ethers.constants.AddressZero)).to.be.revertedWith(
            "NestedRecords: INVALID_ADDRESS",
        );
    });

    it("reverts when calling a factory only function when not a factory", async () => {
        await expect(nestedRecords.connect(bob).setReserve(0, bob.address)).to.be.revertedWith(
            "NestedRecords: FORBIDDEN",
        );
    });

    it("reverts when setting a wrong reserve to a NFT", async () => {
        await expect(nestedRecords.store(0, bob.address, 20, ethers.constants.AddressZero)).to.be.revertedWith(
            "NestedRecords: INVALID_RESERVE",
        );
        await nestedRecords.store(0, bob.address, 20, alice.address);
        await expect(nestedRecords.store(0, bob.address, 20, bob.address)).to.be.revertedWith(
            "NestedRecords: RESERVE_MISMATCH",
        );
    });

    it("reverts when calling store with too many orders", async () => {
        const maxHoldingsCount = await nestedRecords.maxHoldingsCount();
        const signers = await ethers.getSigners();
        for (let i = 0; i < maxHoldingsCount; i++) {
            await nestedRecords.store(0, signers[i + 3].address, 20, alice.address);
        }
        await expect(nestedRecords.store(0, bob.address, 20, alice.address)).to.be.revertedWith(
            "NestedRecords: TOO_MANY_ORDERS",
        );
    });

    it("updates a record", async () => {
        const weth = "0xc778417E063141139Fce010982780140Aa0cD5Ab";
        const tx = await nestedRecords.store(0, weth, appendDecimals(10), bob.address);
        await tx.wait();
        const tx0 = await nestedRecords.update(0, 0, weth, appendDecimals(5));
        await tx0.wait();
        const holding = await nestedRecords.getAssetHolding(0, weth);
        expect(holding.amount).to.equal(appendDecimals(5));
        const tx1 = await nestedRecords.update(0, 0, weth, appendDecimals(5));
        await tx1.wait();
        const tokens = await nestedRecords.getAssetTokens(0);
        expect(tokens.length).to.equal(0);
        const emptyHolding = await nestedRecords.getAssetHolding(0, weth);
        expect(emptyHolding.token).to.equal(ethers.constants.AddressZero);
    });

    describe("#setMaxHoldingsCount", () => {
        it("reverts when setting an incorrect number of max holdings", async () => {
            await expect(nestedRecords.setMaxHoldingsCount(0)).to.be.revertedWith(
                "NestedRecords: INVALID_MAX_HOLDINGS",
            );
        });

        it("sets max holdings count", async () => {
            await nestedRecords.setMaxHoldingsCount(1);
            expect(await nestedRecords.maxHoldingsCount()).to.eq(1);
        });
    });
});
