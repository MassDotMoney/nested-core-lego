import { LoadFixtureFunction } from "../types";
import { factoryAndOperatorsFixture, FactoryAndOperatorsFixture } from "../shared/fixtures";
import { createFixtureLoader, expect, provider } from "../shared/provider";
import { ethers, network } from "hardhat";
import { Wallet } from "ethers";

let loadFixture: LoadFixtureFunction;

describe("OwnableFactoryHandler", () => {
    let context: FactoryAndOperatorsFixture;
    const otherFactory = Wallet.createRandom();

    before("loader", async () => {
        loadFixture = createFixtureLoader(provider.getWallets(), provider);
    });

    beforeEach("create fixture loader", async () => {
        context = await loadFixture(factoryAndOperatorsFixture);
    });

    describe("addFactory()", () => {
        it("sets the new factory", async () => {
            await expect(context.nestedAsset.connect(context.masterDeployer).addFactory(otherFactory.address))
                .to.emit(context.nestedAsset, "FactoryAdded")
                .withArgs(otherFactory.address);
            expect(await context.nestedAsset.supportedFactories(otherFactory.address)).to.equal(true);
        });

        it("reverts if unauthorized", async () => {
            await expect(
                context.nestedAsset.connect(context.user1).addFactory(otherFactory.address),
            ).to.be.revertedWith("Ownable: caller is not the owner");
            expect(await context.nestedAsset.supportedFactories(otherFactory.address)).to.equal(false);
        });

        it("reverts if the address is invalid", async () => {
            await expect(
                context.nestedAsset.connect(context.masterDeployer).addFactory(ethers.constants.AddressZero),
            ).to.be.revertedWith("OFH: INVALID_ADDRESS");
            expect(await context.nestedAsset.supportedFactories(otherFactory.address)).to.equal(false);
        });
    });

    describe("removeFactory()", () => {
        it("remove a factory", async () => {
            await context.nestedAsset.connect(context.masterDeployer).addFactory(otherFactory.address);
            expect(await context.nestedAsset.supportedFactories(otherFactory.address)).to.equal(true);
            await expect(context.nestedAsset.connect(context.masterDeployer).removeFactory(otherFactory.address))
                .to.emit(context.nestedAsset, "FactoryRemoved")
                .withArgs(otherFactory.address);
            expect(await context.nestedAsset.supportedFactories(otherFactory.address)).to.equal(false);
        });

        it("reverts if unauthorized", async () => {
            await context.nestedAsset.connect(context.masterDeployer).addFactory(otherFactory.address);
            await expect(
                context.nestedAsset.connect(context.user1).removeFactory(otherFactory.address),
            ).to.be.revertedWith("Ownable: caller is not the owner");
            expect(await context.nestedAsset.supportedFactories(otherFactory.address)).to.equal(true);
        });

        it("reverts if already not supported", async () => {
            await expect(
                context.nestedAsset.connect(context.masterDeployer).removeFactory(otherFactory.address),
            ).to.be.revertedWith("OFH: NOT_SUPPORTED");

            await expect(
                context.nestedAsset.connect(context.masterDeployer).removeFactory(ethers.constants.AddressZero),
            ).to.be.revertedWith("OFH: NOT_SUPPORTED");
        });
    });
});
