import { LoadFixtureFunction } from "../types";
import { factoryAndOperatorsFixture, FactoryAndOperatorsFixture } from "../shared/fixtures";
import { createFixtureLoader, describeWithoutFork, expect, provider } from "../shared/provider";
import { BigNumber } from "ethers";
import { appendDecimals, getExpectedFees, toBytes32 } from "../helpers";
import { ethers } from "hardhat";
import { FlatOperator__factory, OperatorScripts, OwnerProxy, UpdateFees } from "../../typechain";
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
    let operatorScripts: OperatorScripts;
    let scriptAddOperatorCalldata: string;
    let scriptRemoveOperatorCalldata: string;
    let scriptDeployAddOperatorsCalldata: string;
    let flatOperatorFactory: FlatOperator__factory;

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

        // Set OwnerProxy as proxy admin
        const transparentUpgradeableProxyFactory = await ethers.getContractFactory("TransparentUpgradeableProxy");
        const transparentUpgradeableProxy = await transparentUpgradeableProxyFactory.attach(
            context.nestedFactory.address,
        );
        await transparentUpgradeableProxy.connect(context.proxyAdmin).changeAdmin(ownerProxy.address);

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
        const operatorScriptsFactory = await ethers.getContractFactory("OperatorScripts");
        operatorScripts = await operatorScriptsFactory
            .connect(context.masterDeployer)
            .deploy(context.nestedFactory.address, context.operatorResolver.address);
        await operatorScripts.deployed();

        // Create "addOperator" calldata (to call OwnerProxy)
        // We are adding the FlatOperator a second time
        scriptAddOperatorCalldata = await operatorScripts.interface.encodeFunctionData("addOperator", [
            {
                implementation: context.flatOperator.address,
                selector: context.flatOperator.interface.getSighash("transfer(address,uint)"),
            },
            toBytes32("flatTest"),
        ]);

        // Create "removeOperator" calldata (to call OwnerProxy)
        // We are removing the flatTest operator
        scriptRemoveOperatorCalldata = await operatorScripts.interface.encodeFunctionData("removeOperator", [
            toBytes32("flatTest"),
        ]);

        // Create "deployAddOperators" calldata (to call OwnerProxy)
        // We are deploying/adding the FlatOperator a second time
        flatOperatorFactory = await ethers.getContractFactory("FlatOperator");
        scriptDeployAddOperatorsCalldata = await operatorScripts.interface.encodeFunctionData("deployAddOperators", [
            flatOperatorFactory.bytecode,
            [
                {
                    name: toBytes32("flatTest"),
                    selector: context.flatOperator.interface.getSighash("transfer(address,uint)"),
                },
            ],
        ]);
    });

    describe("Common", () => {
        it("Can't update fees if not owner", async () => {
            await expect(
                ownerProxy.connect(context.user1).execute(scriptUpdateFees.address, scriptUpdateFeesCalldata),
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Can't update fees if empty target", async () => {
            await expect(
                ownerProxy
                    .connect(context.masterDeployer)
                    .execute(ethers.constants.AddressZero, scriptUpdateFeesCalldata),
            ).to.be.revertedWith("OP: INVALID_TARGET");
        });
    });

    describe("Update fees", () => {
        it("Can't update fees if entry fees are zero", async () => {
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

        it("Can't update fees if exit fees are zero", async () => {
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

        it("Can't update fees by calling script", async () => {
            await expect(
                scriptUpdateFees.connect(context.masterDeployer).updateFees(context.nestedFactory.address, 30, 80),
            ).to.be.reverted;
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
        it("Can't add operator if operator address is zero", async () => {
            let wrongScriptCalldata = await operatorScripts.interface.encodeFunctionData("addOperator", [
                {
                    implementation: ethers.constants.AddressZero,
                    selector: context.flatOperator.interface.getSighash("transfer(address,uint)"),
                },
                toBytes32("flatTest"),
            ]);

            await expect(
                ownerProxy.connect(context.masterDeployer).execute(operatorScripts.address, wrongScriptCalldata),
            ).to.be.revertedWith("AO-SCRIPT: INVALID_IMPL_ADDRESS");
        });

        it("Can add operator and call operator", async () => {
            await ownerProxy
                .connect(context.masterDeployer)
                .execute(operatorScripts.address, scriptAddOperatorCalldata);

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

    describe("remove operator", () => {
        beforeEach("Add flatTest operator to be removed", async () => {
            await ownerProxy
                .connect(context.masterDeployer)
                .execute(operatorScripts.address, scriptAddOperatorCalldata);
        });

        it("Can remove operator and can't call operator", async () => {
            await ownerProxy
                .connect(context.masterDeployer)
                .execute(operatorScripts.address, scriptRemoveOperatorCalldata);

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
            ).to.be.revertedWith("MOR: MISSING_OPERATOR: flatTest");
        });
    });

    describe("Deploy and add operator", () => {
        it("Can't add operator if bytecode is zero", async () => {
            let wrongScriptCalldata = await operatorScripts.interface.encodeFunctionData("deployAddOperators", [
                [],
                [
                    {
                        name: toBytes32("flatTest"),
                        selector: context.flatOperator.interface.getSighash("transfer(address,uint)"),
                    },
                ],
            ]);

            await expect(
                ownerProxy.connect(context.masterDeployer).execute(operatorScripts.address, wrongScriptCalldata),
            ).to.be.revertedWith("DAO-SCRIPT: BYTECODE_ZERO");
        });

        it("Can't add operator if bad bytecode", async () => {
            const failedDeployFactory = await ethers.getContractFactory("FailedDeploy");
            let wrongScriptCalldata = await operatorScripts.interface.encodeFunctionData("deployAddOperators", [
                failedDeployFactory.bytecode,
                [
                    {
                        name: toBytes32("flatTest"),
                        selector: context.flatOperator.interface.getSighash("transfer(address,uint)"),
                    },
                ],
            ]);

            await expect(
                ownerProxy.connect(context.masterDeployer).execute(operatorScripts.address, wrongScriptCalldata),
            ).to.be.revertedWith("DAO-SCRIPT: FAILED_DEPLOY");
        });

        it("Can add operator and call operator", async () => {
            await ownerProxy
                .connect(context.masterDeployer)
                .execute(operatorScripts.address, scriptDeployAddOperatorsCalldata);

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
