import { LoadFixtureFunction } from "../types";
import { factoryAndOperatorsFixture, FactoryAndOperatorsFixture } from "../shared/fixtures";
import { createFixtureLoader, describeWithoutFork, expect, provider } from "../shared/provider";
import { BigNumber, Wallet } from "ethers";
import { appendDecimals, BIG_NUMBER_ZERO, getExpectedFees, toBytes32 } from "../helpers";
import { ethers, network } from "hardhat";
import { OwnerProxy, UpdateFees } from "../../typechain";

let loadFixture: LoadFixtureFunction;

describeWithoutFork("OwnerProxy", () => {
    let context: FactoryAndOperatorsFixture;
    let scriptUpdateFees : UpdateFees;
    let ownerProxy : OwnerProxy;
    let scriptCalldata : string;

    before("loader", async () => {
        loadFixture = createFixtureLoader(provider.getWallets(), provider);
    });

    beforeEach("create fixture loader", async () => {
        context = await loadFixture(factoryAndOperatorsFixture);

        const ownerProxyFactory = await ethers.getContractFactory("OwnerProxy");
        ownerProxy = await ownerProxyFactory.connect(context.masterDeployer).deploy();
        await ownerProxy.deployed();
        
        // Transfer NestedFactory ownership to the OwnerProxy
        await context.nestedFactory.connect(context.masterDeployer).transferOwnership(ownerProxy.address);

        // Deploy UpdateFees script
        const scriptUpdateFeesFactory = await ethers.getContractFactory("UpdateFees");
        scriptUpdateFees = await scriptUpdateFeesFactory.connect(context.masterDeployer).deploy();
        await scriptUpdateFees.deployed();

        // Create "updateFees" calldata (to call OwnerProxy)
        scriptCalldata = await scriptUpdateFees.interface.encodeFunctionData("updateFees", [context.nestedFactory.address, 30, 80]);
    });

    describe("Update fees", () => {
        it("Cant update fees if not owner", async () => {
            await expect(
                ownerProxy.connect(context.user1).execute(scriptUpdateFees.address, scriptCalldata),
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Cant update fees if empty target", async () => {
            await expect(
                ownerProxy.connect(context.masterDeployer).execute(ethers.constants.AddressZero, scriptCalldata),
            ).to.be.revertedWith("OP: INVALID_TARGET");
        });

        it("Cant update fees if wrong entry fees is zero", async () => {
            // set fees to zero is not allowed
            let wrongScriptCalldata = await scriptUpdateFees.interface.encodeFunctionData("updateFees", [context.nestedFactory.address, 0, 80]);

            await expect(
                ownerProxy.connect(context.masterDeployer).execute(scriptUpdateFees.address, wrongScriptCalldata),
            ).to.be.revertedWith("NF: ZERO_FEES");      
        });

        it("Cant update fees if wrong exit fees is zero", async () => {
            // set fees to zero is not allowed
            let wrongScriptCalldata = await scriptUpdateFees.interface.encodeFunctionData("updateFees", [context.nestedFactory.address, 30, 0]);

            await expect(
                ownerProxy.connect(context.masterDeployer).execute(scriptUpdateFees.address, wrongScriptCalldata),
            ).to.be.revertedWith("NF: ZERO_FEES");      
        });

        it("Cant update fees by calling script", async () => {
            await expect(
                scriptUpdateFees.connect(context.masterDeployer).updateFees(context.nestedFactory.address, 30, 80),
            ).to.be.revertedWith("OPD: NOT_OWNER");      
        });

        it("can update fees", async () => {
            await ownerProxy.connect(context.masterDeployer).execute(scriptUpdateFees.address, scriptCalldata);

            expect(await context.nestedFactory.entryFees()).to.be.equal(BigNumber.from(30));  
            expect(await context.nestedFactory.exitFees()).to.be.equal(BigNumber.from(80));  
        });
    });

});