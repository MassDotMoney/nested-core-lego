import { LoadFixtureFunction } from "../types";
import { factoryAndZeroExFixture, FactoryAndZeroExFixture } from "../shared/fixtures";
import { ActorFixture } from "../shared/actors";
import { createFixtureLoader, expect, provider } from "../shared/provider";
import { Wallet } from "ethers";
import { toBytes32 } from "../helpers";
import { ethers } from "hardhat";

let loadFixture: LoadFixtureFunction;

describe("NestedFactory", () => {
    let context: FactoryAndZeroExFixture;
    const actors = new ActorFixture(provider.getWallets() as Wallet[], provider);

    before("loader", async () => {
        loadFixture = createFixtureLoader(provider.getWallets(), provider);
    });

    beforeEach("create fixture loader", async () => {
        context = await loadFixture(factoryAndZeroExFixture);
    });

    it("deploys and has an address", async () => {
        expect(context.nestedFactory.address).to.be.a.string;
    });

    describe("constructor()", () => {
        it("sets the state variables", async () => {
            expect(await context.nestedFactory.feeSplitter()).to.eq(context.feeSplitter.address);
            expect(await context.nestedFactory.nestedAsset()).to.eq(context.nestedAsset.address);
            expect(await context.nestedFactory.nestedRecords()).to.eq(context.nestedRecords.address);
            expect(await context.nestedFactory.weth()).to.eq(context.WETH.address);
            expect(await context.nestedFactory.resolver()).to.eq(context.operatorResolver.address);
        });
    });

    describe("addOperator()", () => {
        it("cant be invoked by an user", async () => {
            await expect(
                context.nestedFactory.connect(context.user1).addOperator(toBytes32("test")),
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });
        it("add a new operator", async () => {
            // Add the operator named "test"
            await context.nestedFactory.connect(context.masterDeployer).addOperator(toBytes32("test"));

            // Get the operators from the factory
            const operators = await context.nestedFactory.resolverAddressesRequired();

            // Must have 2 operators ("ZeroEx" from Fixture and "test")
            expect(operators.length).to.be.equal(2);
            expect(operators[0]).to.be.equal(toBytes32("ZeroEx"));
            expect(operators[1]).to.be.equal(toBytes32("test"));
        });
    });

    describe("updateSmartChef()", () => {
        const newSmartChef = Wallet.createRandom().address;
        it("cant be invoked by an user", async () => {
            await expect(context.nestedFactory.connect(context.user1).updateSmartChef(newSmartChef)).to.be.revertedWith(
                "Ownable: caller is not the owner",
            );
        });

        it("cant set zero address", async () => {
            await expect(
                context.nestedFactory.connect(context.masterDeployer).updateSmartChef(ethers.constants.AddressZero),
            ).to.be.revertedWith("NestedFactory::updateSmartChef: Invalid smartchef address");
        });

        it("set value", async () => {
            await context.nestedFactory.connect(context.masterDeployer).updateSmartChef(newSmartChef);
            expect(await context.nestedFactory.smartChef()).to.be.equal(newSmartChef);
        });

        it("emit SmartChefUpdated event", async () => {
            await expect(context.nestedFactory.connect(context.masterDeployer).updateSmartChef(newSmartChef))
                .to.emit(context.nestedFactory, "SmartChefUpdated")
                .withArgs(newSmartChef);
        });
    });

    describe("setReserve()", () => {
        const newReserve = Wallet.createRandom().address;
        it("cant be invoked by an user", async () => {
            await expect(context.nestedFactory.connect(context.user1).setReserve(newReserve)).to.be.revertedWith(
                "Ownable: caller is not the owner",
            );
        });

        it("cant set address (immutable)", async () => {
            await context.nestedFactory.connect(context.masterDeployer).setReserve(context.nestedReserve.address);
            await expect(
                context.nestedFactory.connect(context.masterDeployer).setReserve(newReserve),
            ).to.be.revertedWith("NestedFactory::setReserve: Reserve is immutable");
        });

        it("set value", async () => {
            await context.nestedFactory.connect(context.masterDeployer).setReserve(context.nestedReserve.address);
            expect(await context.nestedFactory.reserve()).to.be.equal(context.nestedReserve.address);
        });

        it("emit ReserveUpdated event", async () => {
            await expect(context.nestedFactory.connect(context.masterDeployer).setReserve(newReserve))
                .to.emit(context.nestedFactory, "ReserveUpdated")
                .withArgs(newReserve);
        });
    });

    describe("setFeeSplitter()", () => {
        const newFeeSplitter = Wallet.createRandom().address;
        it("cant be invoked by an user", async () => {
            await expect(
                context.nestedFactory.connect(context.user1).setFeeSplitter(newFeeSplitter),
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("cant set zero address", async () => {
            await expect(
                context.nestedFactory.connect(context.masterDeployer).setFeeSplitter(ethers.constants.AddressZero),
            ).to.be.revertedWith("NestedFactory::setFeeSplitter: Invalid feeSplitter address");
        });

        it("set value", async () => {
            await context.nestedFactory.connect(context.masterDeployer).setFeeSplitter(newFeeSplitter);
            expect(await context.nestedFactory.feeSplitter()).to.be.equal(newFeeSplitter);
        });

        it("emit FeeSplitterUpdated event", async () => {
            await expect(context.nestedFactory.connect(context.masterDeployer).setFeeSplitter(newFeeSplitter))
                .to.emit(context.nestedFactory, "FeeSplitterUpdated")
                .withArgs(newFeeSplitter);
        });
    });

    describe("updateVipDiscount()", () => {
        it("cant be invoked by an user", async () => {
            await expect(context.nestedFactory.connect(context.user1).updateVipDiscount(0, 0)).to.be.revertedWith(
                "Ownable: caller is not the owner",
            );
        });

        it("cant set vipDiscount greater than 999", async () => {
            await expect(
                context.nestedFactory.connect(context.masterDeployer).updateVipDiscount(1001, 0),
            ).to.be.revertedWith("NestedFactory::updateVipDiscount: Discount too high");
        });

        it("set values", async () => {
            await context.nestedFactory.connect(context.masterDeployer).updateVipDiscount(200, 100);
            expect(await context.nestedFactory.vipDiscount()).to.be.equal(200);
            expect(await context.nestedFactory.vipMinAmount()).to.be.equal(100);
        });

        it("emit VipDiscountUpdated event", async () => {
            await expect(context.nestedFactory.connect(context.masterDeployer).updateVipDiscount(200, 100))
                .to.emit(context.nestedFactory, "VipDiscountUpdated")
                .withArgs(200, 100);
        });
    });
});
