import { LoadFixtureFunction } from "../types";
import { factoryAndOperatorsFixture, FactoryAndOperatorsFixture } from "../shared/fixtures";
import { createFixtureLoader, describeWithoutFork, expect, provider } from "../shared/provider";
import { BigNumber, Wallet } from "ethers";
import { appendDecimals, BIG_NUMBER_ZERO, getExpectedFees, toBytes32 } from "../helpers";
import { ethers, network } from "hardhat";
import { AddOperator, DeployAddOperators, FlatOperator__factory, OwnerProxy, RemoveOperator, UpdateFees } from "../../typechain";
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
    let scriptRemoveOperator: RemoveOperator;
    let scriptRemoveOperatorCalldata: string;
    let scriptDeployAddOperators: DeployAddOperators;
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

        // Deploy RemoveOperator Script
        const scriptRemoveOperatorFactory = await ethers.getContractFactory("RemoveOperator");
        scriptRemoveOperator = await scriptRemoveOperatorFactory.connect(context.masterDeployer).deploy();
        await scriptRemoveOperator.deployed();

        // Create "removeOperator" calldata (to call OwnerProxy)
        // We are removing the flatTest operator
        scriptRemoveOperatorCalldata = await scriptRemoveOperator.interface.encodeFunctionData("removeOperator", [
            context.nestedFactory.address,
            toBytes32("flatTest")
        ]);

        // Deploy DeployAddOperators Script
        const scriptDeployAddOperatorsFactory = await ethers.getContractFactory("DeployAddOperators");
        scriptDeployAddOperators = await scriptDeployAddOperatorsFactory.connect(context.masterDeployer).deploy();
        await scriptDeployAddOperators.deployed();

        
        // Create "deployAddOperators" calldata (to call OwnerProxy)
        // We are deploying/adding the FlatOperator a second time
        flatOperatorFactory = await ethers.getContractFactory("FlatOperator");
        scriptDeployAddOperatorsCalldata = await scriptDeployAddOperators.interface.encodeFunctionData("deployAddOperators", [
            context.nestedFactory.address,
            flatOperatorFactory.bytecode,
            [
                {
                    name: toBytes32("flatTest"),
                    selector: context.flatOperator.interface.getSighash("transfer(address,uint)"),
                }
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
        it("Can't add operator if nested factory address is zero", async () => {
            let wrongScriptCalldata = await scriptAddOperator.interface.encodeFunctionData("addOperator", [
                ethers.constants.AddressZero,
                {
                    implementation: context.flatOperator.address,
                    selector: context.flatOperator.interface.getSighash("transfer(address,uint)"),
                },
                toBytes32("flatTest"),
            ]);

            await expect(
                ownerProxy.connect(context.masterDeployer).execute(scriptAddOperator.address, wrongScriptCalldata),
            ).to.be.revertedWith("AO-SCRIPT: INVALID_FACTORY_ADDRESS");
        });

        it("Can't add operator if operator address is zero", async () => {
            let wrongScriptCalldata = await scriptAddOperator.interface.encodeFunctionData("addOperator", [
                context.nestedFactory.address,
                {
                    implementation: ethers.constants.AddressZero,
                    selector: context.flatOperator.interface.getSighash("transfer(address,uint)"),
                },
                toBytes32("flatTest"),
            ]);

            await expect(
                ownerProxy.connect(context.masterDeployer).execute(scriptAddOperator.address, wrongScriptCalldata),
            ).to.be.revertedWith("AO-SCRIPT: INVALID_IMPL_ADDRESS");
        });

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

    describe("remove operator", () => {
        beforeEach("Add flatTest operator to be removed", async () => {
            await ownerProxy
                .connect(context.masterDeployer)
                .execute(scriptAddOperator.address, scriptAddOperatorCalldata);
        });
        
        it("Can't remove operator if nested factory address is zero", async () => {
            let wrongScriptCalldata = await scriptRemoveOperator.interface.encodeFunctionData("removeOperator", [
                ethers.constants.AddressZero,
                toBytes32("flatTest"),
            ]);

            await expect(
                ownerProxy.connect(context.masterDeployer).execute(scriptRemoveOperator.address, wrongScriptCalldata),
            ).to.be.revertedWith("RO-SCRIPT: INVALID_FACTORY_ADDRESS");
        });

        it("Can remove operator and can't call operator", async () => {
            await ownerProxy
                .connect(context.masterDeployer)
                .execute(scriptRemoveOperator.address, scriptRemoveOperatorCalldata);

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
                .to.be.revertedWith("MOR: MISSING_OPERATOR: flatTest");
        });
    });

    describe("Deploy and add operator", () => {
        it("Can't add operator if nested factory address is zero", async () => {
            let wrongScriptCalldata = await scriptDeployAddOperators.interface.encodeFunctionData("deployAddOperators", [
                ethers.constants.AddressZero,
                flatOperatorFactory.bytecode,
                [
                    {
                        name: toBytes32("flatTest"),
                        selector: context.flatOperator.interface.getSighash("transfer(address,uint)"),
                    }
                ],
            ]);

            await expect(
                ownerProxy.connect(context.masterDeployer).execute(scriptDeployAddOperators.address, wrongScriptCalldata),
            ).to.be.revertedWith("DAO-SCRIPT: INVALID_ADDRESS");
        });

        it("Can't add operator if bytecode is zero", async () => {
            let wrongScriptCalldata = await scriptDeployAddOperators.interface.encodeFunctionData("deployAddOperators", [
                context.nestedFactory.address,
                [],
                [
                    {
                        name: toBytes32("flatTest"),
                        selector: context.flatOperator.interface.getSighash("transfer(address,uint)"),
                    }
                ],
            ]);

            await expect(
                ownerProxy.connect(context.masterDeployer).execute(scriptDeployAddOperators.address, wrongScriptCalldata),
            ).to.be.revertedWith("DAO-SCRIPT: BYTECODE_ZERO");
        });

        it("Can't add operator if bad bytecode", async () => {
            const failedDeployFactory = await ethers.getContractFactory("FailedDeploy");
            let wrongScriptCalldata = await scriptDeployAddOperators.interface.encodeFunctionData("deployAddOperators", [
                context.nestedFactory.address,
                failedDeployFactory.bytecode,
                [
                    {
                        name: toBytes32("flatTest"),
                        selector: context.flatOperator.interface.getSighash("transfer(address,uint)"),
                    }
                ],
            ]);

            await expect(
                ownerProxy.connect(context.masterDeployer).execute(scriptDeployAddOperators.address, wrongScriptCalldata),
            ).to.be.revertedWith("DAO-SCRIPT: FAILED_DEPLOY");
        });

        it("Can add operator and call operator", async () => {
            await ownerProxy
                .connect(context.masterDeployer)
                .execute(scriptDeployAddOperators.address, scriptDeployAddOperatorsCalldata);

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
