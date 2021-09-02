import { TestableOwnableOperatorFixture, testableOwnableOperatorFixture } from "../shared/fixtures";
import { ActorFixture } from "../shared/actors";
import { createFixtureLoader, expect, provider } from "../shared/provider";
import { Wallet } from "ethers";
import { LoadFixtureFunction } from "../types";
import { ethers } from "hardhat";

let loadFixture: LoadFixtureFunction;

describe("OwnableOperator", () => {
    let context: TestableOwnableOperatorFixture;
    const actors = new ActorFixture(provider.getWallets() as Wallet[], provider);

    before("loader", async () => {
        loadFixture = createFixtureLoader(provider.getWallets(), provider);
    });

    beforeEach("create fixture loader", async () => {
        context = await loadFixture(testableOwnableOperatorFixture);
    });

    it("deploys and has an address", async () => {
        expect(context.testableOwnableOperator.address).to.be.a.string;
    });

    it("has right owner set", async () => {
        expect(await context.testableOwnableOperator.owner()).to.be.equal(actors.ownableOperatorOwner().address);
    });

    describe("onlyOwner() modifier", () => {
        it("allow the owner", async () => {
            expect(await context.testableOwnableOperator.connect(actors.ownableOperatorOwner()).isOwner()).to.be.true;
        });

        it("revert if its not the owner", async () => {
            await expect(context.testableOwnableOperator.connect(actors.user1()).isOwner()).to.be.revertedWith(
                "OwnableOperator: caller is not the owner",
            );
        });
    });

    describe("transferOwnership()", () => {
        it("cant be invoked by an user", async () => {
            await expect(
                context.testableOwnableOperator.connect(actors.user1()).transferOwnership(actors.user1().address),
            ).to.be.revertedWith("OwnableOperator: caller is not the owner");
        });

        it("should change the owner to user", async () => {
            await context.testableOwnableOperator
                .connect(actors.ownableOperatorOwner())
                .transferOwnership(actors.user1().address);
            expect(await context.testableOwnableOperator.owner()).to.be.equal(actors.user1().address);
        });

        it("revert if its address zero", async () => {
            await expect(
                context.testableOwnableOperator
                    .connect(actors.ownableOperatorOwner())
                    .transferOwnership(ethers.constants.AddressZero),
            ).to.be.revertedWith("OwnableOperator: new owner is the zero address");
        });

        it("should emit event OwnershipTransferred", async () => {
            await expect(
                context.testableOwnableOperator
                    .connect(actors.ownableOperatorOwner())
                    .transferOwnership(actors.user1().address),
            )
                .to.emit(context.testableOwnableOperator, "OwnershipTransferred")
                .withArgs(actors.ownableOperatorOwner().address, actors.user1().address);
        });
    });

    describe("renounceOwnership()", () => {
        it("cant be invoked by an user", async () => {
            await expect(
                context.testableOwnableOperator.connect(actors.user1()).transferOwnership(actors.user1().address),
            ).to.be.revertedWith("OwnableOperator: caller is not the owner");
        });

        it("sets address to 0", async () => {
            await context.testableOwnableOperator.connect(actors.ownableOperatorOwner()).renounceOwnership();
            expect(await context.testableOwnableOperator.owner()).to.be.equal(ethers.constants.AddressZero);
        });

        it("should emit event OwnershipTransferred", async () => {
            await expect(context.testableOwnableOperator.connect(actors.ownableOperatorOwner()).renounceOwnership())
                .to.emit(context.testableOwnableOperator, "OwnershipTransferred")
                .withArgs(actors.ownableOperatorOwner().address, ethers.constants.AddressZero);
        });
    });
});
