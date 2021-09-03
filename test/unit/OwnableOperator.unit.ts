import {
    ownableOperatorFixture,
    OwnableOperatorFixture,
    TestableOwnableOperatorCallerFixture,
    testableOwnableOperatorCallerFixture,
} from "../shared/fixtures";
import { ActorFixture } from "../shared/actors";
import { createFixtureLoader, expect, provider } from "../shared/provider";
import { Wallet } from "ethers";
import { LoadFixtureFunction } from "../types";
import { ethers } from "hardhat";

let loadFixture: LoadFixtureFunction;

const actors = new ActorFixture(provider.getWallets() as Wallet[], provider);

describe("OwnableOperator", () => {
    let context: OwnableOperatorFixture;

    before("loader", async () => {
        loadFixture = createFixtureLoader(provider.getWallets(), provider);
    });

    beforeEach("create fixture loader", async () => {
        context = await loadFixture(ownableOperatorFixture);
    });

    it("deploys and has an address", async () => {
        expect(context.ownableOperator.address).to.be.a.string;
    });

    it("has right owner set", async () => {
        expect(await context.ownableOperator.owner()).to.be.equal(actors.ownableOperatorOwner().address);
    });

    describe("onlyOwner() modifier", () => {
        it("allow the owner", async () => {
            expect(await context.ownableOperator.connect(actors.ownableOperatorOwner()).requireIsOwner()).to.be.true;
        });

        it("revert if its not the owner", async () => {
            await expect(context.ownableOperator.connect(actors.user1()).requireIsOwner()).to.be.revertedWith(
                "Ownable: caller is not the owner",
            );
        });
    });

    describe("transferOwnership()", () => {
        it("cant be invoked by an user", async () => {
            await expect(
                context.ownableOperator.connect(actors.user1()).transferOwnership(actors.user1().address),
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("should change the owner to user", async () => {
            await context.ownableOperator
                .connect(actors.ownableOperatorOwner())
                .transferOwnership(actors.user1().address);
            expect(await context.ownableOperator.owner()).to.be.equal(actors.user1().address);
        });

        it("revert if its address zero", async () => {
            await expect(
                context.ownableOperator
                    .connect(actors.ownableOperatorOwner())
                    .transferOwnership(ethers.constants.AddressZero),
            ).to.be.revertedWith("Ownable: new owner is the zero address");
        });

        it("should emit event OwnershipTransferred", async () => {
            await expect(
                context.ownableOperator
                    .connect(actors.ownableOperatorOwner())
                    .transferOwnership(actors.user1().address),
            )
                .to.emit(context.ownableOperator, "OwnershipTransferred")
                .withArgs(actors.ownableOperatorOwner().address, actors.user1().address);
        });
    });

    describe("renounceOwnership()", () => {
        it("cant be invoked by an user", async () => {
            await expect(
                context.ownableOperator.connect(actors.user1()).transferOwnership(actors.user1().address),
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("sets address to 0", async () => {
            await context.ownableOperator.connect(actors.ownableOperatorOwner()).renounceOwnership();
            expect(await context.ownableOperator.owner()).to.be.equal(ethers.constants.AddressZero);
        });

        it("should emit event OwnershipTransferred", async () => {
            await expect(context.ownableOperator.connect(actors.ownableOperatorOwner()).renounceOwnership())
                .to.emit(context.ownableOperator, "OwnershipTransferred")
                .withArgs(actors.ownableOperatorOwner().address, ethers.constants.AddressZero);
        });
    });
});

describe("OwnableOperator (delegatecall)", () => {
    let context: TestableOwnableOperatorCallerFixture;

    before("loader", async () => {
        loadFixture = createFixtureLoader(provider.getWallets(), provider);
    });

    beforeEach("create fixture loader", async () => {
        context = await loadFixture(testableOwnableOperatorCallerFixture);
    });

    it("deploy and has an address", async () => {
        expect(context.testableOwnableOperatorCaller.address).to.be.a.string;
        expect(context.testableOwnedOperator.address).to.be.a.string;
    });

    it("cant be invoked by an user", async () => {
        await expect(context.testableOwnableOperatorCaller.connect(actors.user1()).test()).to.be.revertedWith(
            "TestableOwnableOperatorCaller::renounceOwnership: Error",
        );
    });

    it("allow the owner", async () => {
        let tx = await context.testableOwnableOperatorCaller.connect(actors.ownableOperatorOwner()).test();
        expect(tx.value == null).to.be.false;
    });
});
