import { LoadFixtureFunction } from "../types";
import { factoryAndOperatorsFixture, FactoryAndOperatorsFixture } from "../shared/fixtures";
import { createFixtureLoader, describeWithoutFork, expect, provider } from "../shared/provider";
import { BigNumber, Wallet } from "ethers";
import { appendDecimals, BIG_NUMBER_ZERO, getExpectedFees, toBytes32 } from "../helpers";
import { ethers, network } from "hardhat";
import { AddOperator, OwnerProxy, UpdateFees } from "../../typechain";
import * as utils from "../../scripts/utils";

let loadFixture: LoadFixtureFunction;

interface Order {
    operator: string;
    token: string;
    callData: string | [];
}

describeWithoutFork("OwnerProxy", () => {
    let context: FactoryAndOperatorsFixture;
    let ownerProxy: OwnerProxy;
    let scriptUpdateFees: UpdateFees;
    let scriptUpdateFeesCalldata: string;
    let scriptAddOperator: AddOperator;
    let scriptAddOperatorCalldata: string;

    before("loader", async () => {
        loadFixture = createFixtureLoader(provider.getWallets(), provider);
    });

    beforeEach("create fixture loader", async () => {
        context = await loadFixture(factoryAndOperatorsFixture);

        const ownerProxyFactory = await ethers.getContractFactory("OwnerProxy");
        ownerProxy = await ownerProxyFactory.connect(context.masterDeployer).deploy();
        await ownerProxy.deployed();

        // Transfer NestedFactory/OperatorResolver ownership to the OwnerProxy
        await context.nestedFactory.connect(context.masterDeployer).transferOwnership(ownerProxy.address);
        await context.operatorResolver.connect(context.masterDeployer).transferOwnership(ownerProxy.address);

        // Deploy UpdateFees script
        const scriptUpdateFeesFactory = await ethers.getContractFactory("UpdateFees");
        scriptUpdateFees = await scriptUpdateFeesFactory.connect(context.masterDeployer).deploy();
        await scriptUpdateFees.deployed();

        // Create "updateFees" calldata (to call OwnerProxy)
        scriptUpdateFeesCalldata = await scriptUpdateFees.interface.encodeFunctionData("updateFees", [
            context.nestedFactory.address,
            30,
            80,
        ]);

        // Deploy AddOperator Script
        const scriptAddOperatorFactory = await ethers.getContractFactory("AddOperator");
        scriptAddOperator = await scriptAddOperatorFactory.connect(context.masterDeployer).deploy();
        await scriptAddOperator.deployed();

        // Create "addOperator" calldata (to call OwnerProxy)
        // We are adding the FlatOperator a second time
        scriptAddOperatorCalldata = await scriptAddOperator.interface.encodeFunctionData("addOperator", [
            context.nestedFactory.address,
            {
                implementation: context.flatOperator.address,
                selector: context.flatOperator.interface.getSighash("transfer(address,uint)"),
            },
            toBytes32("flatTest"),
        ]);
    });

    describe("Common", () => {
        it("Cant update fees if not owner", async () => {
            await expect(
                ownerProxy.connect(context.user1).execute(scriptUpdateFees.address, scriptUpdateFeesCalldata),
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Cant update fees if empty target", async () => {
            await expect(
                ownerProxy
                    .connect(context.masterDeployer)
                    .execute(ethers.constants.AddressZero, scriptUpdateFeesCalldata),
            ).to.be.revertedWith("OP: INVALID_TARGET");
        });
    });

    describe("Update fees", () => {
        it("Cant update fees if wrong entry fees is zero", async () => {
            // set fees to zero is not allowed
            let wrongScriptCalldata = await scriptUpdateFees.interface.encodeFunctionData("updateFees", [
                context.nestedFactory.address,
                0,
                80,
            ]);

            await expect(
                ownerProxy.connect(context.masterDeployer).execute(scriptUpdateFees.address, wrongScriptCalldata),
            ).to.be.revertedWith("NF: ZERO_FEES");
        });

        it("Cant update fees if wrong exit fees is zero", async () => {
            // set fees to zero is not allowed
            let wrongScriptCalldata = await scriptUpdateFees.interface.encodeFunctionData("updateFees", [
                context.nestedFactory.address,
                30,
                0,
            ]);

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
            await ownerProxy
                .connect(context.masterDeployer)
                .execute(scriptUpdateFees.address, scriptUpdateFeesCalldata);

            expect(await context.nestedFactory.entryFees()).to.be.equal(BigNumber.from(30));
            expect(await context.nestedFactory.exitFees()).to.be.equal(BigNumber.from(80));
        });
    });

    describe("Add operator", () => {
        it("Can add operator and call operator", async () => {
            await ownerProxy
                .connect(context.masterDeployer)
                .execute(scriptAddOperator.address, scriptAddOperatorCalldata);

            // The user add 10 UNI to the portfolio
            const uniBought = appendDecimals(10);
            const totalToBought = uniBought;
            const expectedFee = getExpectedFees(totalToBought);
            const totalToSpend = totalToBought.add(expectedFee);

            // Add 10 UNI with new FlatOperator
            let orders: Order[] = [
                {
                    operator: toBytes32("flatTest"),
                    token: context.mockUNI.address,
                    callData: utils.abiCoder.encode(["address", "uint256"], [context.mockUNI.address, totalToBought]),
                },
            ];

            // User1 creates the portfolio/NFT and emit event NftCreated
            await expect(
                context.nestedFactory.connect(context.user1).create(0, [
                    {
                        inputToken: context.mockUNI.address,
                        amount: totalToSpend,
                        orders,
                        fromReserve: false,
                    },
                ]),
            )
                .to.emit(context.nestedFactory, "NftCreated")
                .withArgs(1, 0);
        });
    });
});
