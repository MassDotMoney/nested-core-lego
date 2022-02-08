import { LoadFixtureFunction } from "../types";
import { factoryAndOperatorsFixture, FactoryAndOperatorsFixture } from "../shared/fixtures";
import { createFixtureLoader, expect, provider } from "../shared/provider";
import { BigNumber, BigNumberish, BytesLike, Wallet } from "ethers";
import { appendDecimals, BIG_NUMBER_ZERO, getExpectedFees, toBytes32 } from "../helpers";
import { ethers, network } from "hardhat";
import { importOperatorsWithSigner } from "../../scripts/utils";

let loadFixture: LoadFixtureFunction;

type RawDataType = "address" | "bytes4" | "bytes" | "uint256";

interface OrderStruct {
    operator: BytesLike;
    token: string;
    callData: BytesLike;
}

interface BatchedInputOrderStruct {
    inputToken: string;
    amount: BigNumberish;
    orders: OrderStruct[];
    fromReserve: boolean;
}
interface BatchedOutputOrderStruct {
    outputToken: string;
    amounts: BigNumberish[];
    orders: OrderStruct[];
    toReserve: boolean;
}

function buildOrderStruct(operator: string, outToken: string, data: [RawDataType, any][]): OrderStruct {
    // struct Order {
    //     bytes32 operator;
    //     address token;
    //     bytes callData;
    // }
    const abiCoder = new ethers.utils.AbiCoder();
    const coded = abiCoder.encode([...data.map(x => x[0])], [...data.map(x => x[1])]);
    return {
        // specify which operator?
        operator: operator,
        // specify the token that this order will output
        token: outToken,
        // encode the given data
        callData: coded, // remove the leading 32 bytes (one address) and the leading 0x
        // callData,
    };
}

describe("NestedFactory", () => {
    let context: FactoryAndOperatorsFixture;
    const ETH = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
    const abiCoder = new ethers.utils.AbiCoder();

    // Selector of "function dummyswapToken(address,address,uint)" of the DummyRouter
    const dummyRouterSelector = "0x76ab33a6";

    before("loader", async () => {
        loadFixture = createFixtureLoader(provider.getWallets(), provider);
    });

    beforeEach("create fixture loader", async () => {
        context = await loadFixture(factoryAndOperatorsFixture);
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

        it("cant add already existent operator", async () => {
            await context.nestedFactory.connect(context.masterDeployer).addOperator(toBytes32("test"));
            await context.nestedFactory.connect(context.masterDeployer).addOperator(toBytes32("test1"));
            await expect(
                context.nestedFactory.connect(context.masterDeployer).addOperator(toBytes32("test")),
            ).to.be.revertedWith("NF: EXISTENT_OPERATOR");
            await expect(
                context.nestedFactory.connect(context.masterDeployer).addOperator(toBytes32("test1")),
            ).to.be.revertedWith("NF: EXISTENT_OPERATOR");
        });

        it("cant add empty operator name", async () => {
            await expect(
                context.nestedFactory.connect(context.masterDeployer).addOperator(toBytes32("")),
            ).to.be.revertedWith("NF: INVALID_OPERATOR_NAME");
        });

        it("add a new operator", async () => {
            // Add the operator named "test"
            await context.nestedFactory.connect(context.masterDeployer).addOperator(toBytes32("test"));

            // Get the operators from the factory
            const operators = await context.nestedFactory.resolverOperatorsRequired();

            // Must have 2 operators ("ZeroEx" from Fixture and "test")
            expect(operators.length).to.be.equal(3);
            expect(operators[0]).to.be.equal(context.zeroExOperatorNameBytes32);
            expect(operators[1]).to.be.equal(context.flatOperatorNameBytes32);
            expect(operators[2]).to.be.equal(toBytes32("test"));
        });
    });

    describe("removeOperator()", () => {
        it("cant be invoked by an user", async () => {
            await expect(
                context.nestedFactory.connect(context.user1).removeOperator(toBytes32("test")),
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });
        it("remove an operator", async () => {
            const testAddress = Wallet.createRandom().address;
            const operatorResolver = await context.operatorResolver.connect(context.masterDeployer);
            // Add the operator named "test"
            await importOperatorsWithSigner(
                operatorResolver,
                [
                    {
                        name: "test",
                        contract: testAddress,
                        signature: "function test()",
                    },
                ],
                context.nestedFactory,
                context.masterDeployer,
            );

            // Then remove the operator
            await importOperatorsWithSigner(
                operatorResolver,
                [
                    {
                        name: "test",
                        contract: ethers.constants.AddressZero,
                        signature: "function test()",
                    },
                ],
                null,
                context.masterDeployer,
            );
            await context.nestedFactory.connect(context.masterDeployer).rebuildCache();
            await context.nestedFactory.connect(context.masterDeployer).removeOperator(toBytes32("test"));

            // Get the operators from the factory
            let operators = await context.nestedFactory.resolverOperatorsRequired();

            // Must have 2 operators ("ZeroEx" from Fixture and "Flat")
            expect(operators.length).to.be.equal(2);
            expect(operators[0]).to.be.equal(context.zeroExOperatorNameBytes32);
            expect(operators[1]).to.be.equal(context.flatOperatorNameBytes32);

            let orders: OrderStruct[] = [
                buildOrderStruct(toBytes32("test"), context.mockUNI.address, [
                    ["address", context.mockDAI.address],
                    ["address", context.mockUNI.address],
                    [
                        "bytes",
                        ethers.utils.hexConcat([
                            dummyRouterSelector,
                            abiCoder.encode(
                                ["address", "address", "uint"],
                                [context.mockDAI.address, context.mockUNI.address, appendDecimals(5)],
                            ),
                        ]),
                    ],
                ]),
            ];

            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .create(0, [
                        { inputToken: context.mockDAI.address, amount: appendDecimals(5), orders, fromReserve: false },
                    ]),
            ).to.be.revertedWith("MOR: MISSING_OPERATOR: test");

            await context.nestedFactory
                .connect(context.masterDeployer)
                .removeOperator(context.zeroExOperatorNameBytes32);
            operators = await context.nestedFactory.resolverOperatorsRequired();
            expect(operators[0]).to.be.equal(context.flatOperatorNameBytes32);
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
            ).to.be.revertedWith("NF: INVALID_FEE_SPLITTER_ADDRESS");
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

    describe("create()", () => {
        it("reverts if Orders list is empty", async () => {
            let orders: OrderStruct[] = [];
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .create(0, [{ inputToken: context.mockDAI.address, amount: 0, orders, fromReserve: false }]),
            ).to.be.revertedWith("NF: INVALID_ORDERS");
        });

        it("reverts if bad calldatas", async () => {
            // All the amounts for this test
            const uniBought = appendDecimals(10);
            const expectedFee = getExpectedFees(uniBought);
            const totalToSpend = uniBought.add(expectedFee);

            // Orders to buy UNI but the sellToken param (ZeroExOperator) is removed
            const orders: OrderStruct[] = [
                buildOrderStruct(context.zeroExOperatorNameBytes32, context.mockUNI.address, [
                    ["address", context.mockUNI.address],
                    [
                        "bytes",
                        ethers.utils.hexConcat([
                            dummyRouterSelector,
                            abiCoder.encode(
                                ["address", "address", "uint"],
                                [context.mockDAI.address, context.mockUNI.address, uniBought],
                            ),
                        ]),
                    ],
                ]),
            ];

            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .create(0, [
                        { inputToken: context.mockDAI.address, amount: totalToSpend, orders, fromReserve: false },
                    ]),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });

        it("reverts if wrong output token in calldata", async () => {
            // All the amounts for this test
            const uniBought = appendDecimals(10);
            const expectedFee = getExpectedFees(uniBought);
            const totalToSpend = uniBought.add(expectedFee);

            // Orders to buy UNI but with the wrong output token
            const orders: OrderStruct[] = [
                buildOrderStruct(context.zeroExOperatorNameBytes32, context.mockUNI.address, [
                    ["address", context.mockDAI.address],
                    ["address", context.mockKNC.address],
                    [
                        "bytes",
                        ethers.utils.hexConcat([
                            dummyRouterSelector,
                            abiCoder.encode(
                                ["address", "address", "uint"],
                                [context.mockDAI.address, context.mockKNC.address, uniBought],
                            ),
                        ]),
                    ],
                ]),
            ];

            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .create(0, [
                        { inputToken: context.mockDAI.address, amount: totalToSpend, orders, fromReserve: false },
                    ]),
            ).to.be.revertedWith("OH: INVALID_OUTPUT_TOKEN");
        });

        it("reverts if the DAI amount is less than total sum of DAI sales", async () => {
            /*
             * All the amounts for this test :
             * - Buy 6 UNI and 4 KNC
             * - The user needs 10 DAI (+ fees) but will spend 5 DAI
             */
            const uniBought = appendDecimals(6);
            const kncBought = appendDecimals(4);
            const totalToSpend = appendDecimals(5);

            // Orders for UNI and KNC
            let orders: OrderStruct[] = getUniAndKncWithDaiOrders(uniBought, kncBought);

            // Revert because not enough funds to swap, the order amounts > totalToSpend
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .create(0, [
                        { inputToken: context.mockDAI.address, amount: totalToSpend, orders, fromReserve: false },
                    ]),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });

        it("reverts if not enough to pay fees", async () => {
            /*
             * All the amounts for this test :
             * - Buy 6 UNI and 4 KNC
             * - The user needs 10 DAI (+ fees) but will spend 10 DAI => without the fees
             */
            const uniBought = appendDecimals(6);
            const kncBought = appendDecimals(4);
            const totalToSpend = appendDecimals(10);

            // Orders for UNI and KNC
            let orders: OrderStruct[] = getUniAndKncWithDaiOrders(uniBought, kncBought);

            // Should revert with "assert" (no message)
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .create(0, [
                        { inputToken: context.mockDAI.address, amount: totalToSpend, orders, fromReserve: false },
                    ]),
            ).to.be.reverted;
        });

        it("reverts if the ETH amount is less than total sum of ETH sales", async () => {
            /*
             * All the amounts for this test :
             * - Buy 6 UNI and 4 KNC
             * - The user needs 10 ETH (+ fees) but will spend 5 ETH
             */
            const uniBought = appendDecimals(6);
            const kncBought = appendDecimals(4);
            const totalToSpend = appendDecimals(5);

            // Orders for UNI and KNC
            let orders: OrderStruct[] = getUniAndKncWithETHOrders(uniBought, kncBought);

            // Should revert with "assert" (no message)
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .create(0, [{ inputToken: ETH, amount: totalToSpend, orders, fromReserve: false }], {
                        value: totalToSpend,
                    }),
            ).to.be.reverted;
        });

        it("the ETH amount is more than total sum of ETH in orders", async () => {
            /*
             * All the amounts for this test :
             * - Buy 6 UNI and 4 KNC
             * - The user needs 10 ETH (+ fees), will specify 11 ETH, but will send 12 ETH (msg.value)
             */
            const uniBought = appendDecimals(6);
            const kncBought = appendDecimals(4);
            const totalToSpend = appendDecimals(11);

            // Orders for UNI and KNC
            let orders: OrderStruct[] = getUniAndKncWithETHOrders(uniBought, kncBought);

            // Should revert with "assert" (no message)
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .create(0, [{ inputToken: ETH, amount: totalToSpend, orders, fromReserve: false }], {
                        value: totalToSpend.add(appendDecimals(1)),
                    }),
            ).to.be.revertedWith("NF: WRONG_MSG_VALUE");
        });

        it("Creates NFT from DAI with KNI and UNI inside (ZeroExOperator) with right amounts", async () => {
            // All the amounts for this test
            const uniBought = appendDecimals(6);
            const kncBought = appendDecimals(4);
            const totalToBought = uniBought.add(kncBought);
            const expectedFee = getExpectedFees(totalToBought);
            const totalToSpend = totalToBought.add(expectedFee);

            // Orders for UNI and KNC
            let orders: OrderStruct[] = getUniAndKncWithDaiOrders(uniBought, kncBought);

            // User1 creates the portfolio/NFT and emit event NftCreated
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .create(0, [
                        { inputToken: context.mockDAI.address, amount: totalToSpend, orders, fromReserve: false },
                    ]),
            )
                .to.emit(context.nestedFactory, "NftCreated")
                .withArgs(1, 0);

            // User1 must be the owner of NFT n°1
            expect(await context.nestedAsset.ownerOf(1)).to.be.equal(context.user1.address);

            // 6 UNI and 4 KNC must be in the reserve
            expect(await context.mockUNI.balanceOf(context.nestedReserve.address)).to.be.equal(uniBought);
            expect(await context.mockKNC.balanceOf(context.nestedReserve.address)).to.be.equal(kncBought);

            /*
             * User1 must have the right DAI amount :
             * baseAmount - amount spent
             */
            expect(await context.mockDAI.balanceOf(context.user1.address)).to.be.equal(
                context.baseAmount.sub(totalToSpend),
            );

            // The FeeSplitter must receive the right fee amount
            expect(await context.mockDAI.balanceOf(context.feeSplitter.address)).to.be.equal(expectedFee);

            // Must store UNI and KNC in the records of the NFT
            expect(await context.nestedRecords.getAssetTokens(1).then(value => value.toString())).to.be.equal(
                [context.mockUNI.address, context.mockKNC.address].toString(),
            );

            // Must have the right amount in the holdings
            const holdingsUNIAmount = await context.nestedRecords.getAssetHolding(1, context.mockUNI.address);
            expect(holdingsUNIAmount).to.be.equal(uniBought);
            const holdingsKNCAmount = await context.nestedRecords.getAssetHolding(1, context.mockKNC.address);
            expect(holdingsKNCAmount).to.be.equal(kncBought);
        });

        it("Creates NFT from DAI with KNI and UNI inside (ZeroExOperator) with more than needed", async () => {
            /*
             * All the amounts for this test :
             * - Buy 6 UNI and 4 KNC
             * - The user needs 10 DAI (+ fees) but will spend 20 DAI (10 DAI in excess)
             */
            const uniBought = appendDecimals(6);
            const kncBought = appendDecimals(4);
            const totalToBought = uniBought.add(kncBought);
            const totalToSpend = appendDecimals(20);

            // Orders for UNI and KNC
            let orders: OrderStruct[] = getUniAndKncWithDaiOrders(uniBought, kncBought);

            // User1 creates the portfolio/NFT and emit event NftCreated
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .create(0, [
                        { inputToken: context.mockDAI.address, amount: totalToSpend, orders, fromReserve: false },
                    ]),
            )
                .to.emit(context.nestedFactory, "NftCreated")
                .withArgs(1, 0);

            // The user must receive the DAI in excess
            expect(await context.mockDAI.balanceOf(context.user1.address)).to.be.equal(
                // (1000 - 20) + (20 - 10 - 0.1)
                context.baseAmount.sub(totalToSpend).add(totalToSpend.sub(totalToBought).sub(totalToBought.div(100))),
            );

            const totalWeigths = await context.feeSplitter.totalWeights();
            const royaltiesWeight = await context.feeSplitter.royaltiesWeight();

            // Shareholders DAI received
            expect(
                await context.feeSplitter.getAmountDue(context.shareholder1.address, context.mockDAI.address),
            ).to.equal(totalToBought.div(100).mul(1000).div(totalWeigths.sub(royaltiesWeight)));
            expect(
                await context.feeSplitter.getAmountDue(context.shareholder2.address, context.mockDAI.address),
            ).to.equal(totalToBought.div(100).mul(1700).div(totalWeigths.sub(royaltiesWeight)));
        });

        it("Replicates NFT from DAI with KNI and UNI inside (ZeroExOperator) with more than needed", async () => {
            /*
             * All the amounts for this test :
             * - Buy 6 UNI and 4 KNC
             * - The user needs 10 DAI (+ fees) but will spend 20 DAI (10 DAI in excess)
             */
            const uniBought = appendDecimals(6);
            const kncBought = appendDecimals(4);
            const totalToBought = uniBought.add(kncBought);
            const totalToSpend = appendDecimals(20);

            // Orders for UNI and KNC
            let orders: OrderStruct[] = getUniAndKncWithDaiOrders(uniBought, kncBought);

            // User1 creates the portfolio/NFT and emit event NftCreated (not more than needed)
            await expect(
                context.nestedFactory.connect(context.user1).create(0, [
                    {
                        inputToken: context.mockDAI.address,
                        amount: appendDecimals(10).add(getExpectedFees(totalToBought)),
                        orders,
                        fromReserve: false,
                    },
                ]),
            )
                .to.emit(context.nestedFactory, "NftCreated")
                .withArgs(1, 0);

            // User1 replicates the portfolio/NFT and emit event NftCreated (with the same amounts)
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .create(1, [
                        { inputToken: context.mockDAI.address, amount: totalToSpend, orders, fromReserve: false },
                    ]),
            )
                .to.emit(context.nestedFactory, "NftCreated")
                .withArgs(2, 1);

            // The user must receive the DAI in excess
            expect(await context.mockDAI.balanceOf(context.user1.address)).to.be.equal(
                // (1000 - 20) + (20 - 10 - 0.1)
                context.baseAmount
                    .sub(appendDecimals(10).add(getExpectedFees(totalToBought)))
                    .sub(totalToSpend)
                    .add(totalToSpend.sub(totalToBought).sub(totalToBought.div(100))),
            );

            const totalWeigths = await context.feeSplitter.totalWeights();
            const royaltiesWeight = await context.feeSplitter.royaltiesWeight();

            expect(
                await context.feeSplitter.getAmountDue(context.shareholder1.address, context.mockDAI.address),
            ).to.equal(
                totalToBought
                    .div(100)
                    .mul(1000)
                    .div(totalWeigths.sub(royaltiesWeight))
                    .add(getExpectedFees(totalToBought).mul(1000).div(totalWeigths)),
            );

            expect(
                await context.feeSplitter.getAmountDue(context.shareholder2.address, context.mockDAI.address),
            ).to.equal(
                totalToBought
                    .div(100)
                    .mul(1700)
                    .div(totalWeigths.sub(royaltiesWeight))
                    .add(getExpectedFees(totalToBought).mul(1700).div(totalWeigths))
                    .add(1),
            );

            expect(await context.feeSplitter.getAmountDue(context.user1.address, context.mockDAI.address)).to.equal(
                getExpectedFees(totalToBought).mul(royaltiesWeight).div(totalWeigths),
            );
        });

        it("Creates NFT from ETH with KNI and UNI inside (ZeroExOperator) with right amounts", async () => {
            // All the amounts for this test
            const uniBought = appendDecimals(6);
            const kncBought = appendDecimals(4);
            const totalToBought = uniBought.add(kncBought);
            const expectedFee = getExpectedFees(totalToBought);
            const totalToSpend = totalToBought.add(expectedFee);

            const ethBalanceBefore = await context.user1.getBalance();

            // Orders for UNI and KNC
            let orders: OrderStruct[] = getUniAndKncWithETHOrders(uniBought, kncBought);

            // User1 creates the portfolio/NFT
            const tx = await context.nestedFactory
                .connect(context.user1)
                .create(0, [{ inputToken: ETH, amount: totalToSpend, orders, fromReserve: false }], {
                    value: totalToSpend,
                });

            // Get the transaction fees
            const gasPrice = tx.gasPrice;
            const txFees = await tx.wait().then(value => value.gasUsed.mul(gasPrice));

            // User1 must be the owner of NFT n°1
            expect(await context.nestedAsset.ownerOf(1)).to.be.equal(context.user1.address);

            // 6 UNI and 4 KNC must be in the reserve
            expect(await context.mockUNI.balanceOf(context.nestedReserve.address)).to.be.equal(uniBought);
            expect(await context.mockKNC.balanceOf(context.nestedReserve.address)).to.be.equal(kncBought);

            /*
             * User1 must have the right ETH amount :
             * baseAmount - amount spent - transation fees
             */
            expect(await context.user1.getBalance()).to.be.equal(ethBalanceBefore.sub(totalToSpend).sub(txFees));

            // The FeeSplitter must receive the right fee amount
            expect(await context.WETH.balanceOf(context.feeSplitter.address)).to.be.equal(expectedFee);
        });
    });

    describe("addTokens", () => {
        // Amount already in the portfolio
        let baseUniBought = appendDecimals(6);
        let baseKncBought = appendDecimals(4);
        let baseTotalToBought = baseUniBought.add(baseKncBought);
        let baseExpectedFee = getExpectedFees(baseTotalToBought);
        let baseTotalToSpend = baseTotalToBought.add(baseExpectedFee);

        beforeEach("Create NFT (id 1)", async () => {
            // create nft 1 with UNI and KNC from DAI (use the base amounts)
            let orders: OrderStruct[] = getUniAndKncWithDaiOrders(baseUniBought, baseKncBought);
            await context.nestedFactory
                .connect(context.user1)
                .create(0, [
                    { inputToken: context.mockDAI.address, amount: baseTotalToSpend, orders, fromReserve: false },
                ]);
        });

        it("reverts if Orders list is empty", async () => {
            let orders: OrderStruct[] = [];
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .processInputOrders(1, [
                        { inputToken: context.mockDAI.address, amount: 0, orders, fromReserve: false },
                    ]),
            ).to.be.revertedWith("NF: INVALID_ORDERS");
        });

        it("reverts if bad calldatas", async () => {
            // All the amounts for this test
            const uniBought = appendDecimals(10);
            const expectedFee = getExpectedFees(uniBought);
            const totalToSpend = uniBought.add(expectedFee);

            // Orders to buy UNI but the sellToken param (ZeroExOperator) is removed
            const orders: OrderStruct[] = [
                buildOrderStruct(context.zeroExOperatorNameBytes32, context.mockUNI.address, [
                    ["address", context.mockUNI.address],
                    [
                        "bytes",
                        ethers.utils.hexConcat([
                            dummyRouterSelector,
                            abiCoder.encode(
                                ["address", "address", "uint"],
                                [context.mockDAI.address, context.mockUNI.address, uniBought],
                            ),
                        ]),
                    ],
                ]),
            ];

            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .processInputOrders(1, [
                        { inputToken: context.mockDAI.address, amount: totalToSpend, orders, fromReserve: false },
                    ]),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });

        it("cant add tokens to nonexistent portfolio", async () => {
            // Amounts and Orders must be good
            const uniBought = appendDecimals(6);
            const kncBought = appendDecimals(4);
            const totalToBought = uniBought.add(kncBought);
            const expectedFee = getExpectedFees(totalToBought);
            const totalToSpend = totalToBought.add(expectedFee);
            let orders: OrderStruct[] = getUniAndKncWithDaiOrders(uniBought, kncBought);

            // NFT with id = 2 shouldn't exist
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .processInputOrders(2, [
                        { inputToken: context.mockDAI.address, amount: totalToSpend, orders, fromReserve: false },
                    ]),
            ).to.be.revertedWith("ERC721: owner query for nonexistent token");
        });

        it("cant add tokens to another user portfolio", async () => {
            // Amounts and Orders must be good
            const uniBought = appendDecimals(6);
            const kncBought = appendDecimals(4);
            const totalToBought = uniBought.add(kncBought);
            const expectedFee = getExpectedFees(totalToBought);
            const totalToSpend = totalToBought.add(expectedFee);
            let orders: OrderStruct[] = getUniAndKncWithDaiOrders(uniBought, kncBought);

            // Master Deployer is not the owner of NFT 1
            await expect(
                context.nestedFactory
                    .connect(context.masterDeployer)
                    .processInputOrders(1, [
                        { inputToken: context.mockDAI.address, amount: totalToSpend, orders, fromReserve: false },
                    ]),
            ).to.be.revertedWith("NF: CALLER_NOT_OWNER");
        });

        it("reverts if wrong output token in calldata", async () => {
            // All the amounts for this test
            const uniBought = appendDecimals(10);
            const expectedFee = getExpectedFees(uniBought);
            const totalToSpend = uniBought.add(expectedFee);

            // Orders to buy UNI but with the wrong output token
            const orders: OrderStruct[] = [
                buildOrderStruct(context.zeroExOperatorNameBytes32, context.mockUNI.address, [
                    ["address", context.mockDAI.address],
                    ["address", context.mockKNC.address],
                    [
                        "bytes",
                        ethers.utils.hexConcat([
                            dummyRouterSelector,
                            abiCoder.encode(
                                ["address", "address", "uint"],
                                [context.mockDAI.address, context.mockKNC.address, uniBought],
                            ),
                        ]),
                    ],
                ]),
            ];

            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .processInputOrders(1, [
                        { inputToken: context.mockDAI.address, amount: totalToSpend, orders, fromReserve: false },
                    ]),
            ).to.be.revertedWith("OH: INVALID_OUTPUT_TOKEN");
        });

        it("reverts if the DAI amount is less than total sum of DAI sales", async () => {
            /*
             * All the amounts for this test :
             * - Buy 6 UNI and 4 KNC
             * - The user needs 10 DAI (+ fees) but will spend 5 DAI
             */
            const uniBought = appendDecimals(6);
            const kncBought = appendDecimals(4);
            const totalToSpend = appendDecimals(5);

            // Orders for UNI and KNC
            let orders: OrderStruct[] = getUniAndKncWithDaiOrders(uniBought, kncBought);

            // Should revert with "assert" (no message)
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .processInputOrders(1, [
                        { inputToken: context.mockDAI.address, amount: totalToSpend, orders, fromReserve: false },
                    ]),
            ).to.be.reverted;
        });

        it("reverts if the ETH amount is less than total sum of ETH sales", async () => {
            /*
             * All the amounts for this test :
             * - Buy 6 UNI and 4 KNC
             * - The user needs 10 ETH (+ fees) but will spend 5 ETH
             */
            const uniBought = appendDecimals(6);
            const kncBought = appendDecimals(4);
            const totalToSpend = appendDecimals(5);

            // Orders for UNI and KNC
            let orders: OrderStruct[] = getUniAndKncWithETHOrders(uniBought, kncBought);

            // Should revert with "assert" (no message)
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .processInputOrders(
                        1,
                        [{ inputToken: context.mockDAI.address, amount: totalToSpend, orders, fromReserve: false }],
                        { value: totalToSpend },
                    ),
            ).to.be.reverted;
        });

        it("increase KNI and UNI amount from DAI (ZeroExOperator) with right amounts", async () => {
            // All the amounts for this test
            const uniBought = appendDecimals(6);
            const kncBought = appendDecimals(4);
            const totalToBought = uniBought.add(kncBought);
            const expectedFee = getExpectedFees(totalToBought);
            const totalToSpend = totalToBought.add(expectedFee);

            // Orders for UNI and KNC
            let orders: OrderStruct[] = getUniAndKncWithDaiOrders(uniBought, kncBought);

            // User1 creates the portfolio/NFT and emit event NftUpdated
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .processInputOrders(1, [
                        { inputToken: context.mockDAI.address, amount: totalToSpend, orders, fromReserve: false },
                    ]),
            )
                .to.emit(context.nestedFactory, "NftUpdated")
                .withArgs(1);

            // 6 UNI and 4 KNC must be in the reserve
            expect(await context.mockUNI.balanceOf(context.nestedReserve.address)).to.be.equal(
                uniBought.add(baseUniBought),
            );
            expect(await context.mockKNC.balanceOf(context.nestedReserve.address)).to.be.equal(
                kncBought.add(baseKncBought),
            );

            /*
             * User1 must have the right DAI amount :
             * baseAmount - amount spent for addTokens - amount spent for create
             */
            expect(await context.mockDAI.balanceOf(context.user1.address)).to.be.equal(
                context.baseAmount.sub(totalToSpend).sub(baseTotalToSpend),
            );

            // The FeeSplitter must receive the right fee amount (+ fee of create)
            expect(await context.mockDAI.balanceOf(context.feeSplitter.address)).to.be.equal(
                expectedFee.add(baseExpectedFee),
            );

            // Must store UNI and KNC in the records of the NFT
            expect(await context.nestedRecords.getAssetTokens(1).then(value => value.toString())).to.be.equal(
                [context.mockUNI.address, context.mockKNC.address].toString(),
            );

            // Must have the right amount in the holdings
            const holdingsUNIAmount = await context.nestedRecords.getAssetHolding(1, context.mockUNI.address);
            expect(holdingsUNIAmount).to.be.equal(uniBought.add(baseUniBought));
            const holdingsKNCAmount = await context.nestedRecords.getAssetHolding(1, context.mockKNC.address);
            expect(holdingsKNCAmount).to.be.equal(kncBought.add(baseKncBought));
        });

        it("increase KNI and UNI amount from DAI (ZeroExOperator) with more than needed", async () => {
            /*
             * All the amounts for this test :
             * - Buy 6 UNI and 4 KNC
             * - The user needs 10 DAI (+ fees) but will spend 20 DAI (10 DAI in excess)
             */
            const uniBought = appendDecimals(6);
            const kncBought = appendDecimals(4);
            const totalToBought = uniBought.add(kncBought);
            const totalToSpend = appendDecimals(20);

            // Orders for UNI and KNC
            let orders: OrderStruct[] = getUniAndKncWithDaiOrders(uniBought, kncBought);

            await context.nestedFactory
                .connect(context.user1)
                .processInputOrders(1, [
                    { inputToken: context.mockDAI.address, amount: totalToSpend, orders, fromReserve: false },
                ]);

            // The user must receive the DAI in excess
            expect(await context.mockDAI.balanceOf(context.user1.address)).to.be.equal(
                context.baseAmount
                    .sub(totalToSpend.add(baseTotalToSpend))
                    .add(totalToSpend.sub(totalToBought).sub(totalToBought.div(100))),
            );

            const totalWeigths = await context.feeSplitter.totalWeights();
            const royaltiesWeight = await context.feeSplitter.royaltiesWeight();

            // add/sub one bc of solidity rounding
            expect(
                await context.feeSplitter.getAmountDue(context.shareholder1.address, context.mockDAI.address),
            ).to.equal(baseExpectedFee.add(totalToBought.div(100)).mul(1000).div(totalWeigths.sub(royaltiesWeight)));
            expect(
                await context.feeSplitter.getAmountDue(context.shareholder2.address, context.mockDAI.address),
            ).to.equal(baseExpectedFee.add(totalToBought.div(100)).mul(1700).div(totalWeigths.sub(royaltiesWeight)));
        });

        it("add new token (DAI) from ETH", async () => {
            // All the amounts for this test
            const daiBought = appendDecimals(10);
            const expectedFee = getExpectedFees(daiBought);
            const totalToSpend = daiBought.add(expectedFee);

            let orders: OrderStruct[] = [
                buildOrderStruct(context.zeroExOperatorNameBytes32, context.mockDAI.address, [
                    ["address", context.WETH.address],
                    ["address", context.mockDAI.address],
                    [
                        "bytes",
                        ethers.utils.hexConcat([
                            dummyRouterSelector,
                            abiCoder.encode(
                                ["address", "address", "uint"],
                                [context.WETH.address, context.mockDAI.address, daiBought],
                            ),
                        ]),
                    ],
                ]),
            ];

            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .processInputOrders(1, [{ inputToken: ETH, amount: totalToSpend, orders, fromReserve: false }], {
                        value: totalToSpend,
                    }),
            )
                .to.emit(context.nestedFactory, "NftUpdated")
                .withArgs(1);

            // Must store DAI in the records of the NFT
            expect(await context.nestedRecords.getAssetTokens(1).then(value => value.toString())).to.be.equal(
                [context.mockUNI.address, context.mockKNC.address, context.mockDAI.address].toString(),
            );

            // Must have the right amount in the holdings
            const holdingsUNIAmount = await context.nestedRecords.getAssetHolding(1, context.mockUNI.address);
            expect(holdingsUNIAmount).to.be.equal(baseUniBought);
            const holdingsKNCAmount = await context.nestedRecords.getAssetHolding(1, context.mockKNC.address);
            expect(holdingsKNCAmount).to.be.equal(baseKncBought);
            const holdingsDAIAmount = await context.nestedRecords.getAssetHolding(1, context.mockDAI.address);
            expect(holdingsDAIAmount).to.be.equal(daiBought);
        });
    });

    describe("Multiswap", () => {
        // Amount already in the portfolio
        let baseUniBought = appendDecimals(6);
        let baseKncBought = appendDecimals(4);
        let baseTotalToBought = baseUniBought.add(baseKncBought);
        let baseExpectedFee = getExpectedFees(baseTotalToBought);
        let baseTotalToSpend = baseTotalToBought.add(baseExpectedFee);

        beforeEach("Create NFT (id 1)", async () => {
            // create nft 1 with UNI and KNC from DAI (use the base amounts)
            let orders: OrderStruct[] = getUniAndKncWithDaiOrders(baseUniBought, baseKncBought);
            await context.nestedFactory
                .connect(context.user1)
                .create(0, [
                    { inputToken: context.mockDAI.address, amount: baseTotalToSpend, orders, fromReserve: false },
                ]);
        });

        it("reverts if Orders list is empty", async () => {
            it("reverts if Orders list is empty", async () => {
                let orders: OrderStruct[] = [];
                let multiOrders: BatchedInputOrderStruct[] = [
                    { inputToken: context.mockUNI.address, amount: 0, orders: orders, fromReserve: true },
                ];
                await expect(
                    context.nestedFactory.connect(context.user1).processInputOrders(1, multiOrders),
                ).to.be.revertedWith("NF: INVALID_ORDERS");
            });
        });

        it("reverts if bad calldatas", async () => {
            // All the amounts for this test
            const uniBought = appendDecimals(4);
            const expectedFee = getExpectedFees(uniBought);
            const totalToSpend = uniBought.add(expectedFee);

            // Orders to swap UNI from the portfolio but the sellToken param (ZeroExOperator) is removed
            const orders: OrderStruct[] = [
                buildOrderStruct(context.zeroExOperatorNameBytes32, context.mockDAI.address, [
                    ["address", context.mockDAI.address],
                    [
                        "bytes",
                        ethers.utils.hexConcat([
                            dummyRouterSelector,
                            abiCoder.encode(
                                ["address", "address", "uint"],
                                [context.mockUNI.address, context.mockDAI.address, uniBought],
                            ),
                        ]),
                    ],
                ]),
            ];

            let multiOrders: BatchedInputOrderStruct[] = [
                { inputToken: context.mockUNI.address, amount: totalToSpend, orders: orders, fromReserve: true },
            ];

            await expect(
                context.nestedFactory.connect(context.user1).processInputOrders(1, multiOrders),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });

        it("swap UNI and KNC in portfolio for USDC and DAI (ZeroExOperator) with right amounts", async () => {
            // All the amounts for this test
            const usdcToBuy = appendDecimals(3);
            const daiToBuy = appendDecimals(2);
            const expectedFeeUni = getExpectedFees(usdcToBuy);
            const expectedFeeKnc = getExpectedFees(daiToBuy);
            const totalToSpendUsdc = usdcToBuy.add(expectedFeeUni);
            const totalToSpenDdai = daiToBuy.add(expectedFeeKnc);

            // Orders to buy USDC with UNI, and DAI with KNC
            let multiOrders: BatchedInputOrderStruct[] = [
                {
                    inputToken: context.mockUNI.address,
                    amount: totalToSpendUsdc,
                    orders: getTokenBWithTokenAOrders(usdcToBuy, context.mockUNI.address, context.mockUSDC.address),
                    fromReserve: true,
                },
                {
                    inputToken: context.mockKNC.address,
                    amount: totalToSpenDdai,
                    orders: getTokenBWithTokenAOrders(daiToBuy, context.mockKNC.address, context.mockDAI.address),
                    fromReserve: true,
                },
            ];

            // User1 updates the portfolio/NFT and emit event NftUpdated
            await expect(context.nestedFactory.connect(context.user1).processInputOrders(1, multiOrders))
                .to.emit(context.nestedFactory, "NftUpdated")
                .withArgs(1);

            // Must store UNI, KNC, DAI and USDC in the records of the NFT
            expect(await context.nestedRecords.getAssetTokens(1).then(value => value.toString())).to.be.equal(
                [
                    context.mockUNI.address,
                    context.mockKNC.address,
                    context.mockUSDC.address,
                    context.mockDAI.address,
                ].toString(),
            );

            // Must have the right amount in the holdings
            const holdingsUNIAmount = await context.nestedRecords.getAssetHolding(1, context.mockUNI.address);
            expect(holdingsUNIAmount).to.be.equal(baseUniBought.sub(totalToSpendUsdc));

            const holdingsKNCAmount = await context.nestedRecords.getAssetHolding(1, context.mockKNC.address);
            expect(holdingsKNCAmount).to.be.equal(baseKncBought.sub(totalToSpenDdai));

            const holdingsUSDCAmount = await context.nestedRecords.getAssetHolding(1, context.mockUSDC.address);
            expect(holdingsUSDCAmount).to.be.equal(usdcToBuy);

            const holdingsDAIAmount = await context.nestedRecords.getAssetHolding(1, context.mockDAI.address);
            expect(holdingsDAIAmount).to.be.equal(daiToBuy);
        });

        it("Input Orders and Output Orders (Add ETH and exchange everything else for USDC)", async () => {
            /*
             * Initial Portfolio:
             * - 4 KNC
             * - 6 UNI
             *
             * Scenario:
             * - Add 1 ETH from wallet (with FlatOperator)
             * - Add 1 USDC by swapping 1 ETH from wallet.
             * - Swap 4 KNC and 6 UNI from the wallet for 9 USDC (sub 1% fees)
             *   1 UNI underspent going back to the reserve!!
             * - Remove 1 USDC from portfolio (with FlatOperator)
             *
             * Final portfolio:
             * - 1 WETH
             * - 8.1 USDC
             * - 1 UNI
             */

            // All the amounts for this test
            const ethToAdd = appendDecimals(1);
            const ethToAddFees = getExpectedFees(ethToAdd);
            const ethToAddForUSDC = appendDecimals(1);
            const ethToAddForUSDCFees = getExpectedFees(ethToAddForUSDC);
            const kncToSwapForUSDC = appendDecimals(4);
            const kncToSwapForUSDCFees = getExpectedFees(kncToSwapForUSDC);
            const uniToSwapForUSDC = appendDecimals(5);
            const uniToSwapForUSDCFees = getExpectedFees(uniToSwapForUSDC);
            const usdcToRemove = appendDecimals(1);
            const usdcToRemoveFees = getExpectedFees(usdcToRemove);

            // Create Batched Input Orders
            let addEthOrders: OrderStruct[] = [
                {
                    operator: context.flatOperatorNameBytes32,
                    token: context.WETH.address,
                    callData: abiCoder.encode(["address", "uint256"], [context.WETH.address, ethToAdd]),
                },
            ];

            // The twist is to make two batched orders instead if one to check the multiple deposit
            let batchedInputOrders: BatchedInputOrderStruct[] = [
                {
                    inputToken: ETH,
                    amount: ethToAdd.add(ethToAddFees),
                    orders: addEthOrders,
                    fromReserve: false,
                },
                {
                    inputToken: ETH,
                    amount: ethToAddForUSDC.add(ethToAddForUSDCFees),
                    orders: getTokenBWithTokenAOrders(ethToAddForUSDC, context.WETH.address, context.mockUSDC.address),
                    fromReserve: false,
                },
            ];

            // Create Batched Output Orders
            let swapKncAndUniOrders: OrderStruct[] = getUsdcWithUniAndKncOrders(uniToSwapForUSDC, kncToSwapForUSDC);
            let removeUsdcOrders: OrderStruct[] = [
                {
                    operator: context.flatOperatorNameBytes32,
                    token: context.mockUSDC.address,
                    callData: abiCoder.encode(["address", "uint256"], [context.mockUSDC.address, usdcToRemove]),
                },
            ];

            let batchedOutputOrders: BatchedOutputOrderStruct[] = [
                {
                    outputToken: context.mockUSDC.address,
                    amounts: [uniToSwapForUSDC.add(appendDecimals(1)), kncToSwapForUSDC],
                    orders: swapKncAndUniOrders,
                    toReserve: true,
                },
                {
                    outputToken: context.mockUSDC.address,
                    amounts: [usdcToRemove],
                    orders: removeUsdcOrders,
                    toReserve: false,
                },
            ];

            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .processInputAndOutputOrders(1, batchedInputOrders, batchedOutputOrders, {
                        value: ethToAdd.add(ethToAddFees).add(ethToAddForUSDC).add(ethToAddForUSDCFees),
                    }),
            )
                .to.emit(context.nestedFactory, "NftUpdated")
                .withArgs(1);

            // Must have the right amount in the holdings
            const holdingsUNIAmount = await context.nestedRecords.getAssetHolding(1, context.mockUNI.address);
            expect(holdingsUNIAmount).to.be.equal(appendDecimals(1));

            const holdingsKNCAmount = await context.nestedRecords.getAssetHolding(1, context.mockKNC.address);
            expect(holdingsKNCAmount).to.be.equal(BIG_NUMBER_ZERO);

            const holdingsUSDCAmount = await context.nestedRecords.getAssetHolding(1, context.mockUSDC.address);
            expect(holdingsUSDCAmount).to.be.equal(
                ethToAddForUSDC
                    .add(kncToSwapForUSDC)
                    .add(uniToSwapForUSDC)
                    .sub(usdcToRemove)
                    .sub(kncToSwapForUSDCFees)
                    .sub(uniToSwapForUSDCFees),
            );

            const holdingsWETHAmount = await context.nestedRecords.getAssetHolding(1, context.WETH.address);
            expect(holdingsWETHAmount).to.be.equal(ethToAdd);
        });
    });

    describe("swapTokenForTokens", () => {
        // Amount already in the portfolio
        let baseUniBought = appendDecimals(6);
        let baseKncBought = appendDecimals(4);
        let baseTotalToBought = baseUniBought.add(baseKncBought);
        let baseExpectedFee = getExpectedFees(baseTotalToBought);
        let baseTotalToSpend = baseTotalToBought.add(baseExpectedFee);

        beforeEach("Create NFT (id 1)", async () => {
            // create nft 1 with UNI and KNC from DAI (use the base amounts)
            let orders: OrderStruct[] = getUniAndKncWithDaiOrders(baseUniBought, baseKncBought);
            await context.nestedFactory
                .connect(context.user1)
                .create(0, [
                    { inputToken: context.mockDAI.address, amount: baseTotalToSpend, orders, fromReserve: false },
                ]);
        });

        it("reverts if Orders list is empty", async () => {
            it("reverts if Orders list is empty", async () => {
                let orders: OrderStruct[] = [];
                await expect(
                    context.nestedFactory
                        .connect(context.user1)
                        .processInputOrders(1, [
                            { inputToken: context.mockUNI.address, amount: 0, orders, fromReserve: true },
                        ]),
                ).to.be.revertedWith("NF: INVALID_ORDERS");
            });
        });

        it("reverts if bad calldatas", async () => {
            // All the amounts for this test
            const uniBought = appendDecimals(4);
            const expectedFee = getExpectedFees(uniBought);
            const totalToSpend = uniBought.add(expectedFee);
            // Orders to swap UNI from the portfolio but the sellToken param (ZeroExOperator) is removed
            const orders: OrderStruct[] = [
                buildOrderStruct(context.zeroExOperatorNameBytes32, context.mockDAI.address, [
                    ["address", context.mockDAI.address],
                    [
                        "bytes",
                        ethers.utils.hexConcat([
                            dummyRouterSelector,
                            abiCoder.encode(
                                ["address", "address", "uint"],
                                [context.mockUNI.address, context.mockDAI.address, uniBought],
                            ),
                        ]),
                    ],
                ]),
            ];
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .processInputOrders(1, [
                        { inputToken: context.mockUNI.address, amount: totalToSpend, orders, fromReserve: true },
                    ]),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });

        it("cant swap token from nonexistent portfolio", async () => {
            // Amounts and Orders must be good
            const kncBought = appendDecimals(10);
            const totalToBought = kncBought;
            const expectedFee = totalToBought.div(100);
            const totalToSpend = totalToBought.add(expectedFee);
            let orders: OrderStruct[] = getTokenBWithTokenAOrders(
                kncBought,
                context.mockKNC.address,
                context.mockUSDC.address,
            );

            // NFT with id = 2 shouldn't exist
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .processInputOrders(2, [
                        { inputToken: context.mockDAI.address, amount: totalToSpend, orders, fromReserve: true },
                    ]),
            ).to.be.revertedWith("ERC721: owner query for nonexistent token");
        });

        it("cant swap token from another user portfolio", async () => {
            // Amounts and Orders must be good
            const kncBought = appendDecimals(10);
            const totalToBought = kncBought;
            const expectedFee = getExpectedFees(totalToBought);
            const totalToSpend = totalToBought.add(expectedFee);
            let orders: OrderStruct[] = getTokenBWithTokenAOrders(
                kncBought,
                context.mockKNC.address,
                context.mockUSDC.address,
            );

            // Master Deployer is not the owner of NFT 1
            await expect(
                context.nestedFactory
                    .connect(context.masterDeployer)
                    .processInputOrders(1, [
                        { inputToken: context.mockDAI.address, amount: totalToSpend, orders, fromReserve: true },
                    ]),
            ).to.be.revertedWith("NF: CALLER_NOT_OWNER");
        });

        it("reverts if the UNI amount in portfolio is less than total sum of UNI sales", async () => {
            /*
             * All the amounts for this test :
             * - Buy 5 USDC
             * - The user needs 5 UNI (+ fees) but only 3 UNI will be used
             */
            const usdcBought = appendDecimals(5);
            const totalToSpend = appendDecimals(3);

            // Orders for UNI and KNC
            let orders: OrderStruct[] = getTokenBWithTokenAOrders(
                usdcBought,
                context.mockUNI.address,
                context.mockUSDC.address,
            );

            // Should revert with "assert" (no message)
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .create(0, [
                        { inputToken: context.mockUNI.address, amount: totalToSpend, orders, fromReserve: false },
                    ]),
            ).to.be.reverted;
        });

        it("reverts if not enought UNI in the portfolio to get USDC", async () => {
            /*
             * All the amounts for this test :
             * - Buy 10 USDC
             * - The user needs 10 UNI (+ fees) but only 6 UNI in the portfolio
             */
            const usdcBought = appendDecimals(10);
            const totalToSpend = appendDecimals(10);

            // Orders for UNI and KNC
            let orders: OrderStruct[] = getTokenBWithTokenAOrders(
                usdcBought,
                context.mockUNI.address,
                context.mockUSDC.address,
            );

            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .processInputOrders(1, [
                        { inputToken: context.mockUNI.address, amount: totalToSpend, orders, fromReserve: true },
                    ]),
            ).to.be.revertedWith("NF: INSUFFICIENT_AMOUNT_IN");
        });

        it("increase UNI amount from KNC in portfolio (ZeroExOperator) with right amounts", async () => {
            // All the amounts for this test
            const uniBought = appendDecimals(3);
            const totalToBought = uniBought;
            const expectedFee = getExpectedFees(totalToBought);
            const totalToSpend = totalToBought.add(expectedFee);

            // Orders for UNI and KNC
            let orders: OrderStruct[] = getTokenBWithTokenAOrders(
                uniBought,
                context.mockKNC.address,
                context.mockUNI.address,
            );

            // User1 updates the portfolio/NFT and emit event NftUpdated
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .processInputOrders(1, [
                        { inputToken: context.mockKNC.address, amount: totalToSpend, orders, fromReserve: true },
                    ]),
            )
                .to.emit(context.nestedFactory, "NftUpdated")
                .withArgs(1);

            // 10 UNI must be in the reserve
            expect(await context.mockUNI.balanceOf(context.nestedReserve.address)).to.be.equal(
                uniBought.add(baseUniBought),
            );
            expect(await context.mockKNC.balanceOf(context.nestedReserve.address)).to.be.equal(
                baseKncBought.sub(totalToSpend),
            );

            // The FeeSplitter must receive the right fee amount (in KNC)
            expect(await context.mockKNC.balanceOf(context.feeSplitter.address)).to.be.equal(expectedFee);

            // Must store UNI and KNC in the records of the NFT
            expect(await context.nestedRecords.getAssetTokens(1).then(value => value.toString())).to.be.equal(
                [context.mockUNI.address, context.mockKNC.address].toString(),
            );

            // Must have the right amount in the holdings
            const holdingsUNIAmount = await context.nestedRecords.getAssetHolding(1, context.mockUNI.address);
            expect(holdingsUNIAmount).to.be.equal(uniBought.add(baseUniBought));
        });

        it("increase UNI amount from KNC in portfolio (ZeroExOperator) with more than needed", async () => {
            /*
             * All the amounts for this test :
             * - Buy 3 UNI with 3 KNC from the portfolio
             * - The user needs 3 KNC (+ fees) but will spend 4 KNC
             */
            const uniBought = appendDecimals(3);
            const totalToSpend = appendDecimals(4);

            // Orders for UNI and KNC
            let orders: OrderStruct[] = getTokenBWithTokenAOrders(
                uniBought,
                context.mockKNC.address,
                context.mockUNI.address,
            );

            // User1 updates the portfolio/NFT and emit event NftUpdated
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .processInputOrders(1, [
                        { inputToken: context.mockKNC.address, amount: totalToSpend, orders, fromReserve: true },
                    ]),
            )
                .to.emit(context.nestedFactory, "NftUpdated")
                .withArgs(1);

            // The user must receive the KNC in excess (inside the portfolio)
            expect(await context.mockKNC.balanceOf(context.nestedReserve.address)).to.be.equal(
                totalToSpend.sub(uniBought).sub(uniBought.div(100)),
            );

            const totalWeigths = await context.feeSplitter.totalWeights();
            const royaltiesWeight = await context.feeSplitter.royaltiesWeight();
            expect(
                await context.feeSplitter.getAmountDue(context.shareholder1.address, context.mockKNC.address),
            ).to.equal(uniBought.div(100).mul(1000).div(totalWeigths.sub(royaltiesWeight)));
            expect(
                await context.feeSplitter.getAmountDue(context.shareholder2.address, context.mockKNC.address),
            ).to.equal(uniBought.div(100).mul(1700).div(totalWeigths.sub(royaltiesWeight)));
        });

        it("swap UNI in portfolio for USDC (ZeroExOperator) with right amounts", async () => {
            // All the amounts for this test
            const usdcBought = appendDecimals(3);
            const expectedFee = getExpectedFees(usdcBought);
            const totalToSpend = usdcBought.add(expectedFee);

            // Orders to buy USDC with UNI
            let orders: OrderStruct[] = getTokenBWithTokenAOrders(
                usdcBought,
                context.mockUNI.address,
                context.mockUSDC.address,
            );

            // User1 updates the portfolio/NFT and emit event NftUpdated
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .processInputOrders(1, [
                        { inputToken: context.mockUNI.address, amount: totalToSpend, orders, fromReserve: true },
                    ]),
            )
                .to.emit(context.nestedFactory, "NftUpdated")
                .withArgs(1);

            // The FeeSplitter must receive the UNI in excess
            expect(await context.mockUNI.balanceOf(context.feeSplitter.address)).to.be.equal(expectedFee);

            // Must store UNI, KNC and USDC in the records of the NFT
            expect(await context.nestedRecords.getAssetTokens(1).then(value => value.toString())).to.be.equal(
                [context.mockUNI.address, context.mockKNC.address, context.mockUSDC.address].toString(),
            );

            // Must have the right amount in the holdings
            const holdingsUNIAmount = await context.nestedRecords.getAssetHolding(1, context.mockUNI.address);
            expect(holdingsUNIAmount).to.be.equal(baseUniBought.sub(totalToSpend));
            const holdingsKNCAmount = await context.nestedRecords.getAssetHolding(1, context.mockKNC.address);
            expect(holdingsKNCAmount).to.be.equal(baseKncBought);
            const holdingsUSDCAmount = await context.nestedRecords.getAssetHolding(1, context.mockUSDC.address);
            expect(holdingsUSDCAmount).to.be.equal(usdcBought);
        });
    });

    describe("sellTokensToNft", () => {
        // Amount already in the portfolio
        let baseUniBought = appendDecimals(6);
        let baseKncBought = appendDecimals(4);
        let baseTotalToBought = baseUniBought.add(baseKncBought);
        let baseExpectedFee = getExpectedFees(baseTotalToBought);
        let baseTotalToSpend = baseTotalToBought.add(baseExpectedFee);

        beforeEach("Create NFT (id 1)", async () => {
            // create nft 1 with UNI and KNC from DAI (use the base amounts)
            let orders: OrderStruct[] = getUniAndKncWithDaiOrders(baseUniBought, baseKncBought);
            await context.nestedFactory
                .connect(context.user1)
                .create(0, [
                    { inputToken: context.mockDAI.address, amount: baseTotalToSpend, orders, fromReserve: false },
                ]);
        });

        it("reverts if Orders list is empty", async () => {
            let orders: OrderStruct[] = [];
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .processOutputOrders(1, [
                        { outputToken: context.mockDAI.address, amounts: [], orders, toReserve: true },
                    ]),
            ).to.be.revertedWith("NF: INVALID_ORDERS");
        });

        it("reverts if bad calldatas", async () => {
            // 6 UNI in the portfolio, the user sell 3 UNI for 3 UDC
            const uniSold = appendDecimals(3);

            // Orders to swap UNI from the portfolio but the sellToken param (ZeroExOperator) is removed
            const orders: OrderStruct[] = [
                buildOrderStruct(context.zeroExOperatorNameBytes32, context.mockUNI.address, [
                    ["address", context.mockUNI.address],
                    [
                        "bytes",
                        ethers.utils.hexConcat([
                            dummyRouterSelector,
                            abiCoder.encode(
                                ["address", "address", "uint"],
                                [context.mockUNI.address, context.mockUSDC.address, uniSold],
                            ),
                        ]),
                    ],
                ]),
            ];

            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .processOutputOrders(1, [
                        { outputToken: context.mockUSDC.address, amounts: [uniSold], orders, toReserve: true },
                    ]),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });

        it("cant swap tokens from nonexistent portfolio", async () => {
            // 6 UNI and 4 KNC in the portfolio, the user sell 3 UNI and 3 KNC for 6 USCC
            const uniSold = appendDecimals(3);
            const kncSold = appendDecimals(3);

            let orders: OrderStruct[] = getUsdcWithUniAndKncOrders(uniSold, kncSold);

            // NFT with id = 2 shouldn't exist
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .processOutputOrders(2, [
                        { outputToken: context.mockUSDC.address, amounts: [uniSold, kncSold], orders, toReserve: true },
                    ]),
            ).to.be.revertedWith("ERC721: owner query for nonexistent token");
        });

        it("cant swap tokens from another user portfolio", async () => {
            // 6 UNI and 4 KNC in the portfolio, the user sell 3 UNI and 3 KNC for 6 USCC
            const uniSold = appendDecimals(3);
            const kncSold = appendDecimals(3);

            let orders: OrderStruct[] = getUsdcWithUniAndKncOrders(uniSold, kncSold);

            // Master Deployer is not the owner of NFT 1
            await expect(
                context.nestedFactory
                    .connect(context.masterDeployer)
                    .processOutputOrders(1, [
                        { outputToken: context.mockUSDC.address, amounts: [uniSold, kncSold], orders, toReserve: true },
                    ]),
            ).to.be.revertedWith("NF: CALLER_NOT_OWNER");
        });

        it("cant swap tokens if orders dont match sell amounts (array size)", async () => {
            // 6 UNI and 4 KNC in the portfolio, the user sell 3 UNI and 3 KNC for 6 USCC
            const uniSold = appendDecimals(3);
            const kncSold = appendDecimals(3);

            let orders: OrderStruct[] = getUsdcWithUniAndKncOrders(uniSold, kncSold);

            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .processOutputOrders(1, [
                        { outputToken: context.mockUSDC.address, amounts: [uniSold], orders, toReserve: true },
                    ]),
            ).to.be.revertedWith("NF: INPUTS_LENGTH_MUST_MATCH");
        });

        it("revert if spend more UNI than in reserve", async () => {
            // 6 UNI and 4 KNC in the portfolio, the user sell 7 UNI and 3 KNC for 6 USCC
            const uniSold = appendDecimals(7);
            const kncSold = appendDecimals(3);

            let orders: OrderStruct[] = getUsdcWithUniAndKncOrders(uniSold, kncSold);

            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .processOutputOrders(1, [
                        { outputToken: context.mockUSDC.address, amounts: [uniSold, kncSold], orders, toReserve: true },
                    ]),
            ).to.be.revertedWith("NF: INSUFFICIENT_AMOUNT_IN");
        });

        it("revert if try to sell more KNC than sell amount", async () => {
            // 6 UNI and 4 KNC in the portfolio, the user sell 3 UNI and 3 KNC for 6 USCC
            const uniSold = appendDecimals(3);
            const kncSold = appendDecimals(3);

            // The amount in the order is more than sell amount
            let orders: OrderStruct[] = getUsdcWithUniAndKncOrders(uniSold, kncSold.add(appendDecimals(1)));

            // Error in operator cant transfer more than in factory balance
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .processOutputOrders(1, [
                        { outputToken: context.mockUSDC.address, amounts: [uniSold, kncSold], orders, toReserve: true },
                    ]),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });

        it("reverts if wrong output token in calldata", async () => {
            // 6 UNI and 4 KNC in the portfolio, the user sell 3 UNI and 3 KNC for 6 USCC
            const uniSold = appendDecimals(3);
            const kncSold = appendDecimals(3);

            // The amount in the order is more than sell amount
            let orders: OrderStruct[] = getUsdcWithUniAndKncOrders(uniSold, kncSold);

            // Instead of USDC as output token, use DAI
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .processOutputOrders(1, [
                        { outputToken: context.mockDAI.address, amounts: [uniSold, kncSold], orders, toReserve: true },
                    ]),
            ).to.be.revertedWith("OH: INVALID_OUTPUT_TOKEN");
        });

        it("swap KNC and UNI for USDC (ZeroExOperator) with right amounts", async () => {
            // 6 UNI and 4 KNC in the portfolio, the user sell 3 UNI and 4 KNC for 7 USCC
            const uniSold = appendDecimals(3);
            const kncSold = appendDecimals(4);
            const usdcBought = kncSold.add(uniSold);
            const expectedUsdcFees = getExpectedFees(usdcBought);

            let orders: OrderStruct[] = getUsdcWithUniAndKncOrders(uniSold, kncSold);

            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .processOutputOrders(1, [
                        { outputToken: context.mockUSDC.address, amounts: [uniSold, kncSold], orders, toReserve: true },
                    ]),
            )
                .to.emit(context.nestedFactory, "NftUpdated")
                .withArgs(1);

            // 3 UNI must be in the reserve
            expect(await context.mockUNI.balanceOf(context.nestedReserve.address)).to.be.equal(
                baseUniBought.sub(uniSold),
            );
            // 0 KNC must be in the reserve
            expect(await context.mockKNC.balanceOf(context.nestedReserve.address)).to.be.equal(
                baseKncBought.sub(kncSold),
            );
            // 7 USDC - fees must be in the reserve
            expect(await context.mockUSDC.balanceOf(context.nestedReserve.address)).to.be.equal(
                usdcBought.sub(expectedUsdcFees),
            );

            // The FeeSplitter must receive the right fee amount (in USDC)
            expect(await context.mockUSDC.balanceOf(context.feeSplitter.address)).to.be.equal(expectedUsdcFees);

            // Must store UNI, and USDC in the records of the NFT
            expect(await context.nestedRecords.getAssetTokens(1).then(value => value.toString())).to.be.equal(
                [context.mockUNI.address, context.mockUSDC.address].toString(),
            );

            // Must have the right amount in the holdings
            const holdingsUNIAmount = await context.nestedRecords.getAssetHolding(1, context.mockUNI.address);
            expect(holdingsUNIAmount).to.be.equal(baseUniBought.sub(uniSold));

            // Must have the right amount in the holdings
            const holdingsUSDCAmount = await context.nestedRecords.getAssetHolding(1, context.mockUSDC.address);
            expect(holdingsUSDCAmount).to.be.equal(usdcBought.sub(expectedUsdcFees));
        });

        it("swap KNC and UNI for USDC (ZeroExOperator) with more than needed", async () => {
            // 6 UNI and 4 KNC in the portfolio, the user sell 3 UNI and 4 KNC for 7 USCC
            const uniSold = appendDecimals(3);
            const kncSold = appendDecimals(4);

            // The amount in the order is less than sell amount. Only 5 USDC will be bought
            const uniSoldOrder = uniSold.sub(appendDecimals(1));
            const kncSoldOrder = kncSold.sub(appendDecimals(1));
            const usdcBoughtOrder = uniSoldOrder.add(kncSoldOrder);
            let orders: OrderStruct[] = getUsdcWithUniAndKncOrders(uniSoldOrder, kncSoldOrder);
            const orderExpectedFee = getExpectedFees(uniSoldOrder.add(kncSoldOrder));

            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .processOutputOrders(1, [
                        { outputToken: context.mockUSDC.address, amounts: [uniSold, kncSold], orders, toReserve: true },
                    ]),
            )
                .to.emit(context.nestedFactory, "NftUpdated")
                .withArgs(1);

            // 4 UNI must be in the reserve (6 UNI - 3 UNI, but 1 UNI in excess back to the reserve)
            expect(await context.mockUNI.balanceOf(context.nestedReserve.address)).to.be.equal(
                baseUniBought.sub(uniSoldOrder),
            );
            // 1 KNC must be in the reserve (4 KNC - 4 KNC, but 1 KNC in excess back to the reserve)
            expect(await context.mockKNC.balanceOf(context.nestedReserve.address)).to.be.equal(
                baseKncBought.sub(kncSoldOrder),
            );
            // 5 USDC - fees must be in the reserve
            expect(await context.mockUSDC.balanceOf(context.nestedReserve.address)).to.be.equal(
                usdcBoughtOrder.sub(orderExpectedFee),
            );

            // The FeeSplitter must receive the right fee amount (in USDC)
            expect(await context.mockUSDC.balanceOf(context.feeSplitter.address)).to.be.equal(orderExpectedFee);

            // The user (portfolio) must receive excess UNI
            const holdingUNIAmount = await context.nestedRecords.getAssetHolding(1, context.mockUNI.address);
            expect(holdingUNIAmount).to.be.equal(baseUniBought.sub(uniSoldOrder));

            // The user (portfolio) must receive excess KNC
            const holdingKNCAmount = await context.nestedRecords.getAssetHolding(1, context.mockKNC.address);
            expect(holdingKNCAmount).to.be.equal(baseKncBought.sub(kncSoldOrder));

            const totalWeigths = await context.feeSplitter.totalWeights();
            const royaltiesWeight = await context.feeSplitter.royaltiesWeight();

            // Shareholders USDC received
            expect(
                await context.feeSplitter.getAmountDue(context.shareholder1.address, context.mockUSDC.address),
            ).to.equal(orderExpectedFee.mul(1000).div(totalWeigths.sub(royaltiesWeight)));
            expect(
                await context.feeSplitter.getAmountDue(context.shareholder2.address, context.mockUSDC.address),
            ).to.equal(orderExpectedFee.mul(1700).div(totalWeigths.sub(royaltiesWeight)));

            // Must store UNI, KNC, and USDC in the records of the NFT (KNC is not removed because of excess KNC)
            expect(await context.nestedRecords.getAssetTokens(1).then(value => value.toString())).to.be.equal(
                [context.mockUNI.address, context.mockKNC.address, context.mockUSDC.address].toString(),
            );
        });
    });

    // Tests are very similar to sellTokensToNft(), but some expectations can be different
    describe("sellTokensToWallet", () => {
        // Amount already in the portfolio
        let baseUniBought = appendDecimals(6);
        let baseKncBought = appendDecimals(4);
        let baseTotalToBought = baseUniBought.add(baseKncBought);
        let baseExpectedFee = getExpectedFees(baseTotalToBought);
        let baseTotalToSpend = baseTotalToBought.add(baseExpectedFee);

        beforeEach("Create NFT (id 1)", async () => {
            // create nft 1 with UNI and KNC from DAI (use the base amounts)
            let orders: OrderStruct[] = getUniAndKncWithDaiOrders(baseUniBought, baseKncBought);
            await context.nestedFactory
                .connect(context.user1)
                .create(0, [
                    { inputToken: context.mockDAI.address, amount: baseTotalToSpend, orders, fromReserve: false },
                ]);
        });

        it("reverts if Orders list is empty", async () => {
            let orders: OrderStruct[] = [];
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .processOutputOrders(1, [
                        { outputToken: context.mockDAI.address, amounts: [], orders, toReserve: false },
                    ]),
            ).to.be.revertedWith("NF: INVALID_ORDERS");
        });

        it("reverts if bad calldatas", async () => {
            // 6 UNI in the portfolio, the user sell 3 UNI for 3 UDC
            const uniSold = appendDecimals(3);

            // Orders to swap UNI from the portfolio but the sellToken param (ZeroExOperator) is removed
            const orders: OrderStruct[] = [
                buildOrderStruct(context.zeroExOperatorNameBytes32, context.mockUNI.address, [
                    ["address", context.mockUSDC.address],
                    [
                        "bytes",
                        ethers.utils.hexConcat([
                            dummyRouterSelector,
                            abiCoder.encode(
                                ["address", "address", "uint"],
                                [context.mockUNI.address, context.mockUSDC.address, uniSold],
                            ),
                        ]),
                    ],
                ]),
            ];

            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .processOutputOrders(1, [
                        { outputToken: context.mockUSDC.address, amounts: [uniSold], orders, toReserve: false },
                    ]),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });

        it("cant swap tokens from nonexistent portfolio", async () => {
            // 6 UNI and 4 KNC in the portfolio, the user sell 3 UNI and 3 KNC for 6 USCC
            const uniSold = appendDecimals(3);
            const kncSold = appendDecimals(3);

            let orders: OrderStruct[] = getUsdcWithUniAndKncOrders(uniSold, kncSold);

            // NFT with id = 2 shouldn't exist
            await expect(
                context.nestedFactory.connect(context.user1).processOutputOrders(2, [
                    {
                        outputToken: context.mockUSDC.address,
                        amounts: [uniSold, kncSold],
                        orders,
                        toReserve: false,
                    },
                ]),
            ).to.be.revertedWith("ERC721: owner query for nonexistent token");
        });

        it("cant swap tokens from another user portfolio", async () => {
            // 6 UNI and 4 KNC in the portfolio, the user sell 3 UNI and 3 KNC for 6 USCC
            const uniSold = appendDecimals(3);
            const kncSold = appendDecimals(3);

            let orders: OrderStruct[] = getUsdcWithUniAndKncOrders(uniSold, kncSold);

            // Master Deployer is not the owner of NFT 1
            await expect(
                context.nestedFactory.connect(context.masterDeployer).processOutputOrders(1, [
                    {
                        outputToken: context.mockUSDC.address,
                        amounts: [uniSold, kncSold],
                        orders,
                        toReserve: false,
                    },
                ]),
            ).to.be.revertedWith("NF: CALLER_NOT_OWNER");
        });

        it("cant swap tokens if orders dont match sell amounts (array size)", async () => {
            // 6 UNI and 4 KNC in the portfolio, the user sell 3 UNI and 3 KNC for 6 USCC
            const uniSold = appendDecimals(3);
            const kncSold = appendDecimals(3);

            let orders: OrderStruct[] = getUsdcWithUniAndKncOrders(uniSold, kncSold);

            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .processOutputOrders(1, [
                        { outputToken: context.mockUSDC.address, amounts: [uniSold], orders, toReserve: false },
                    ]),
            ).to.be.revertedWith("NF: INPUTS_LENGTH_MUST_MATCH");
        });

        it("revert if spend more UNI than in reserve", async () => {
            // 6 UNI and 4 KNC in the portfolio, the user sell 7 UNI and 3 KNC for 6 USCC
            const uniSold = appendDecimals(7);
            const kncSold = appendDecimals(3);

            let orders: OrderStruct[] = getUsdcWithUniAndKncOrders(uniSold, kncSold);

            await expect(
                context.nestedFactory.connect(context.user1).processOutputOrders(1, [
                    {
                        outputToken: context.mockUSDC.address,
                        amounts: [uniSold, kncSold],
                        orders,
                        toReserve: false,
                    },
                ]),
            ).to.be.revertedWith("NF: INSUFFICIENT_AMOUNT_IN");
        });

        it("revert if try to sell more KNC than sell amount", async () => {
            // 6 UNI and 4 KNC in the portfolio, the user sell 3 UNI and 3 KNC for 6 USCC
            const uniSold = appendDecimals(3);
            const kncSold = appendDecimals(3);

            // The amount in the order is more than sell amount
            let orders: OrderStruct[] = getUsdcWithUniAndKncOrders(uniSold, kncSold.add(appendDecimals(1)));

            // Error in operator cant transfer more than in factory balance
            await expect(
                context.nestedFactory.connect(context.user1).processOutputOrders(1, [
                    {
                        outputToken: context.mockUSDC.address,
                        amounts: [uniSold, kncSold],
                        orders,
                        toReserve: false,
                    },
                ]),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });

        it("reverts if wrong output token in calldata", async () => {
            // 6 UNI and 4 KNC in the portfolio, the user sell 3 UNI and 3 KNC for 6 USCC
            const uniSold = appendDecimals(3);
            const kncSold = appendDecimals(3);

            // The amount in the order is more than sell amount
            let orders: OrderStruct[] = getUsdcWithUniAndKncOrders(uniSold, kncSold);

            // Instead of USDC as output token, use DAI
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .processOutputOrders(1, [
                        { outputToken: context.mockDAI.address, amounts: [uniSold, kncSold], orders, toReserve: false },
                    ]),
            ).to.be.revertedWith("OH: INVALID_OUTPUT_TOKEN");
        });

        it("swap KNC and UNI for USDC (ZeroExOperator) with right amounts", async () => {
            // 6 UNI and 4 KNC in the portfolio, the user sell 3 UNI and 4 KNC for 7 USCC
            const uniSold = appendDecimals(3);
            const kncSold = appendDecimals(4);
            const usdcBought = kncSold.add(uniSold);
            const expectedUsdcFees = getExpectedFees(usdcBought);

            let orders: OrderStruct[] = getUsdcWithUniAndKncOrders(uniSold, kncSold);

            await expect(
                context.nestedFactory.connect(context.user1).processOutputOrders(1, [
                    {
                        outputToken: context.mockUSDC.address,
                        amounts: [uniSold, kncSold],
                        orders,
                        toReserve: false,
                    },
                ]),
            )
                .to.emit(context.nestedFactory, "NftUpdated")
                .withArgs(1);

            // 3 UNI must be in the reserve
            expect(await context.mockUNI.balanceOf(context.nestedReserve.address)).to.be.equal(
                baseUniBought.sub(uniSold),
            );
            // 0 KNC must be in the reserve
            expect(await context.mockKNC.balanceOf(context.nestedReserve.address)).to.be.equal(
                baseKncBought.sub(kncSold),
            );
            // 0 USDC - fees must be in the reserve
            expect(await context.mockUSDC.balanceOf(context.nestedReserve.address)).to.be.equal(BigNumber.from(0));

            // The FeeSplitter must receive the right fee amount (in USDC)
            expect(await context.mockUSDC.balanceOf(context.feeSplitter.address)).to.be.equal(expectedUsdcFees);

            // Only UNI in the records
            expect(await context.nestedRecords.getAssetTokens(1).then(value => value.toString())).to.be.equal(
                [context.mockUNI.address].toString(),
            );

            // Must have the right amount in the holdings
            const holdingsUNIAmount = await context.nestedRecords.getAssetHolding(1, context.mockUNI.address);
            expect(holdingsUNIAmount).to.be.equal(baseUniBought.sub(uniSold));

            expect(await context.mockUSDC.balanceOf(context.user1.address)).to.be.equal(
                context.baseAmount.add(usdcBought.sub(expectedUsdcFees)),
            );
        });

        it("swap KNC and UNI for USDC (ZeroExOperator) with more than needed", async () => {
            // 6 UNI and 4 KNC in the portfolio, the user sell 3 UNI and 4 KNC for 7 USCC
            const uniSold = appendDecimals(3);
            const kncSold = appendDecimals(4);

            // The amount in the order is less than sell amount. Only 5 USDC will be bought
            const uniSoldOrder = uniSold.sub(appendDecimals(1));
            const kncSoldOrder = kncSold.sub(appendDecimals(1));
            let orders: OrderStruct[] = getUsdcWithUniAndKncOrders(uniSoldOrder, kncSoldOrder);
            const orderExpectedFee = getExpectedFees(uniSoldOrder.add(kncSoldOrder));

            await expect(
                context.nestedFactory.connect(context.user1).processOutputOrders(1, [
                    {
                        outputToken: context.mockUSDC.address,
                        amounts: [uniSold, kncSold],
                        orders,
                        toReserve: false,
                    },
                ]),
            )
                .to.emit(context.nestedFactory, "NftUpdated")
                .withArgs(1);

            // 4 UNI must be in the reserve (6 UNI - 3 UNI, but 1 UNI in excess back to the reserve)
            expect(await context.mockUNI.balanceOf(context.nestedReserve.address)).to.be.equal(
                baseUniBought.sub(uniSoldOrder),
            );
            // 1 KNC must be in the reserve (4 KNC - 4 KNC, but 1 KNC in excess back to the reserve)
            expect(await context.mockKNC.balanceOf(context.nestedReserve.address)).to.be.equal(
                baseKncBought.sub(kncSoldOrder),
            );
            // 0 USDC must be in the reserve
            expect(await context.mockUSDC.balanceOf(context.nestedReserve.address)).to.be.equal(BigNumber.from(0));

            // The FeeSplitter must receive the right fee amount (in USDC)
            expect(await context.mockUSDC.balanceOf(context.feeSplitter.address)).to.be.equal(orderExpectedFee);

            // The user (portfolio) must receive excess UNI
            const holdingUNIAmount = await context.nestedRecords.getAssetHolding(1, context.mockUNI.address);
            expect(holdingUNIAmount).to.be.equal(baseUniBought.sub(uniSoldOrder));

            // The user (portfolio) must receive excess KNC
            const holdingKNCAmount = await context.nestedRecords.getAssetHolding(1, context.mockKNC.address);
            expect(holdingKNCAmount).to.be.equal(baseKncBought.sub(kncSoldOrder));

            const totalWeigths = await context.feeSplitter.totalWeights();
            const royaltiesWeight = await context.feeSplitter.royaltiesWeight();

            // Shareholders USDC received
            expect(
                await context.feeSplitter.getAmountDue(context.shareholder1.address, context.mockUSDC.address),
            ).to.equal(orderExpectedFee.mul(1000).div(totalWeigths.sub(royaltiesWeight)));
            expect(
                await context.feeSplitter.getAmountDue(context.shareholder2.address, context.mockUSDC.address),
            ).to.equal(orderExpectedFee.mul(1700).div(totalWeigths.sub(royaltiesWeight)));

            // Must store UNI, and KNC (because of excess KNC) in the records of the NFT
            expect(await context.nestedRecords.getAssetTokens(1).then(value => value.toString())).to.be.equal(
                [context.mockUNI.address, context.mockKNC.address].toString(),
            );
        });
    });

    describe("destroy()", () => {
        // Amount already in the portfolio
        let baseUniBought = appendDecimals(6);
        let baseKncBought = appendDecimals(4);
        let baseTotalToBought = baseUniBought.add(baseKncBought);
        let baseExpectedFee = getExpectedFees(baseTotalToBought);
        let baseTotalToSpend = baseTotalToBought.add(baseExpectedFee);

        beforeEach("Create NFT (id 1)", async () => {
            // create nft 1 with UNI and KNC from DAI (use the base amounts)
            let orders: OrderStruct[] = getUniAndKncWithDaiOrders(baseUniBought, baseKncBought);
            await context.nestedFactory
                .connect(context.user1)
                .create(0, [
                    { inputToken: context.mockDAI.address, amount: baseTotalToSpend, orders, fromReserve: false },
                ]);
        });

        it("reverts if Orders list is empty", async () => {
            let orders: OrderStruct[] = [];
            await expect(
                context.nestedFactory.connect(context.user1).destroy(1, context.mockDAI.address, orders),
            ).to.be.revertedWith("NF: INVALID_ORDERS");
        });

        it("doesnt revert if bad calldatas (safe destroy)", async () => {
            const uniSold = appendDecimals(6);
            const kncSold = appendDecimals(4);

            // The sellToken param (ZeroExOperator) is removed
            const orders: OrderStruct[] = [
                buildOrderStruct(context.zeroExOperatorNameBytes32, context.mockUNI.address, [
                    ["address", context.mockUNI.address],
                    [
                        "bytes",
                        ethers.utils.hexConcat([
                            dummyRouterSelector,
                            abiCoder.encode(
                                ["address", "address", "uint"],
                                [context.mockUNI.address, context.mockUSDC.address, uniSold],
                            ),
                        ]),
                    ],
                ]),
                buildOrderStruct(context.zeroExOperatorNameBytes32, context.mockKNC.address, [
                    ["address", context.mockUSDC.address],
                    [
                        "bytes",
                        ethers.utils.hexConcat([
                            dummyRouterSelector,
                            abiCoder.encode(
                                ["address", "address", "uint"],
                                [context.mockUNI.address, context.mockUSDC.address, kncSold],
                            ),
                        ]),
                    ],
                ]),
            ];

            await expect(context.nestedFactory.connect(context.user1).destroy(1, context.mockUSDC.address, orders)).to
                .not.be.reverted;
        });

        it("cant swap tokens from nonexistent portfolio", async () => {
            // 6 UNI and 4 KNC in the portfolio, sell everything for 10 USCC
            const uniSold = appendDecimals(6);
            const kncSold = appendDecimals(4);

            let orders: OrderStruct[] = getUsdcWithUniAndKncOrders(uniSold, kncSold);

            // NFT with id = 2 shouldn't exist
            await expect(
                context.nestedFactory.connect(context.user1).destroy(2, context.mockUSDC.address, orders),
            ).to.be.revertedWith("ERC721: owner query for nonexistent token");
        });

        it("cant swap tokens from another user portfolio", async () => {
            // 6 UNI and 4 KNC in the portfolio, sell everything for 10 USCC
            const uniSold = appendDecimals(6);
            const kncSold = appendDecimals(4);

            let orders: OrderStruct[] = getUsdcWithUniAndKncOrders(uniSold, kncSold);

            // Master Deployer is not the owner of NFT 1
            await expect(
                context.nestedFactory.connect(context.masterDeployer).destroy(1, context.mockUSDC.address, orders),
            ).to.be.revertedWith("NF: CALLER_NOT_OWNER");
        });

        it("revert if holdings and orders don't match", async () => {
            // 6 UNI and 4 KNC in the portfolio, try to sell only the UNI (KNC missing)
            const uniSold = appendDecimals(6);

            let orders: OrderStruct[] = [
                buildOrderStruct(context.zeroExOperatorNameBytes32, context.mockUNI.address, [
                    ["address", context.mockUNI.address],
                    ["address", context.mockUSDC.address],
                    [
                        "bytes",
                        ethers.utils.hexConcat([
                            dummyRouterSelector,
                            abiCoder.encode(
                                ["address", "address", "uint"],
                                [context.mockUNI.address, context.mockUSDC.address, uniSold],
                            ),
                        ]),
                    ],
                ]),
            ];

            await expect(
                context.nestedFactory.connect(context.user1).destroy(1, context.mockUSDC.address, orders),
            ).to.be.revertedWith("NF: INPUTS_LENGTH_MUST_MATCH");
        });

        it("doesnt revert if spend more UNI than in reserve and withdraw (safe destroy)", async () => {
            // 6 UNI and 4 KNC in the portfolio, sell 7 UNI
            const uniSold = appendDecimals(7);
            const kncSold = appendDecimals(4);

            let orders: OrderStruct[] = getUsdcWithUniAndKncOrders(uniSold, kncSold);

            await context.nestedFactory.connect(context.user1).destroy(1, context.mockUSDC.address, orders);

            expect(await context.mockUSDC.balanceOf(context.feeSplitter.address)).to.be.equal(getExpectedFees(kncSold));

            expect(await context.mockUNI.balanceOf(context.feeSplitter.address)).to.be.equal(
                getExpectedFees(baseUniBought),
            );

            // Uni tokens in the portfolio (- fees) are in the user wallet
            expect(await context.mockUNI.balanceOf(context.user1.address)).to.be.equal(
                context.baseAmount.add(baseUniBought.sub(getExpectedFees(baseUniBought))),
            );

            // USDC bought with KNC in the portfolio (- fees) are in the user wallet
            expect(await context.mockUSDC.balanceOf(context.user1.address)).to.be.equal(
                context.baseAmount.add(baseKncBought.sub(getExpectedFees(baseKncBought))), // Sub 1 (rounding)
            );

            // No holdings for NFT 1
            expect(await context.nestedRecords.getAssetTokens(1).then(value => value.toString())).to.be.equal(
                [].toString(),
            );

            // The NFT is burned
            await expect(context.nestedAsset.ownerOf(1)).to.be.revertedWith(
                "ERC721: owner query for nonexistent token",
            );
        });

        it("delete nft for USDC with right amounts", async () => {
            // 6 UNI and 4 KNC in the portfolio, sell everything for 10 USDC
            const uniSold = appendDecimals(6);
            const kncSold = appendDecimals(4);
            const usdcBought = uniSold.add(kncSold);

            let orders: OrderStruct[] = getUsdcWithUniAndKncOrders(uniSold, kncSold);

            await context.nestedFactory.connect(context.user1).destroy(1, context.mockUSDC.address, orders);

            expect(await context.mockUSDC.balanceOf(context.feeSplitter.address)).to.be.equal(
                getExpectedFees(usdcBought),
            );

            // No holdings for NFT 1
            expect(await context.nestedRecords.getAssetTokens(1).then(value => value.toString())).to.be.equal(
                [].toString(),
            );

            // The NFT is burned
            await expect(context.nestedAsset.ownerOf(1)).to.be.revertedWith(
                "ERC721: owner query for nonexistent token",
            );
        });

        it("delete nft for ETH with right amounts", async () => {
            // 6 UNI and 4 KNC in the portfolio, sell everything for 10 WETH
            const uniSold = appendDecimals(6);
            const kncSold = appendDecimals(4);
            const wethBought = uniSold.add(kncSold);

            let orders: OrderStruct[] = getWethWithUniAndKncOrders(uniSold, kncSold);

            await context.nestedFactory.connect(context.user1).destroy(1, context.WETH.address, orders);

            expect(await context.WETH.balanceOf(context.feeSplitter.address)).to.be.equal(getExpectedFees(wethBought));

            // No holdings for NFT 1
            expect(await context.nestedRecords.getAssetTokens(1).then(value => value.toString())).to.be.equal(
                [].toString(),
            );

            // The NFT is burned
            await expect(context.nestedAsset.ownerOf(1)).to.be.revertedWith(
                "ERC721: owner query for nonexistent token",
            );
        });

        it("delete nft for USDC with UNI leftovers", async () => {
            // 6 UNI and 4 KNC in the portfolio, sell everything for 10 USDC
            const kncSold = appendDecimals(4);
            const uniSoldOrder = appendDecimals(4);
            const usdcBought = uniSoldOrder.add(kncSold);

            let orders: OrderStruct[] = getUsdcWithUniAndKncOrders(uniSoldOrder, kncSold);

            await context.nestedFactory.connect(context.user1).destroy(1, context.mockUSDC.address, orders);

            expect(await context.mockUSDC.balanceOf(context.feeSplitter.address)).to.be.equal(
                getExpectedFees(usdcBought),
            );

            // No holdings for NFT 1
            expect(await context.nestedRecords.getAssetTokens(1).then(value => value.toString())).to.be.equal(
                [].toString(),
            );

            // The NFT is burned
            await expect(context.nestedAsset.ownerOf(1)).to.be.revertedWith(
                "ERC721: owner query for nonexistent token",
            );
        });
    });

    describe("withdraw()", () => {
        // Amount already in the portfolio
        let baseUniBought = appendDecimals(6);
        let baseKncBought = appendDecimals(4);
        let baseTotalToBought = baseUniBought.add(baseKncBought);
        let baseExpectedFee = getExpectedFees(baseTotalToBought);
        let baseTotalToSpend = baseTotalToBought.add(baseExpectedFee);

        beforeEach("Create NFT (id 1)", async () => {
            // create nft 1 with UNI and KNC from DAI (use the base amounts)
            let orders: OrderStruct[] = getUniAndKncWithDaiOrders(baseUniBought, baseKncBought);
            await context.nestedFactory
                .connect(context.user1)
                .create(0, [
                    { inputToken: context.mockDAI.address, amount: baseTotalToSpend, orders, fromReserve: true },
                ]);
        });

        it("cant withdraw from another user portfolio", async () => {
            await expect(context.nestedFactory.connect(context.masterDeployer).withdraw(1, 1)).to.be.revertedWith(
                "NF: CALLER_NOT_OWNER",
            );
        });

        it("cant withdraw from nonexistent portfolio", async () => {
            await expect(context.nestedFactory.connect(context.user1).withdraw(2, 1)).to.be.revertedWith(
                "ERC721: owner query for nonexistent token",
            );
        });

        it("cant withdraw if wrong token index", async () => {
            // KNC => Index 1
            await expect(context.nestedFactory.connect(context.user1).withdraw(1, 2)).to.be.revertedWith(
                "NF: INVALID_TOKEN_INDEX",
            );
        });

        it("remove token from holdings", async () => {
            await expect(context.nestedFactory.connect(context.user1).withdraw(1, 1))
                .to.emit(context.nestedFactory, "NftUpdated")
                .withArgs(1);

            // Must remove KNC from holdings
            expect(await context.nestedRecords.getAssetTokens(1).then(value => value.toString())).to.be.equal(
                [context.mockUNI.address].toString(),
            );

            // User and fee splitter receive funds
            expect(await context.mockKNC.balanceOf(context.feeSplitter.address)).to.be.equal(
                getExpectedFees(baseKncBought),
            );
            expect(await context.mockKNC.balanceOf(context.user1.address)).to.be.equal(
                context.baseAmount.add(baseKncBought.sub(getExpectedFees(baseKncBought))),
            );
        });

        it("cant withdraw the last token", async () => {
            // Withdraw KNC first
            await context.nestedFactory.connect(context.user1).withdraw(1, 1);

            // Should not me able to withdraw UNI (the last token)
            await expect(context.nestedFactory.connect(context.user1).withdraw(1, 0)).to.be.revertedWith(
                "NF: UNALLOWED_EMPTY_PORTFOLIO",
            );
        });
    });

    describe("updateLockTimestamp()", () => {
        // Amount already in the portfolio
        let baseUniBought = appendDecimals(6);
        let baseKncBought = appendDecimals(4);
        let baseTotalToBought = baseUniBought.add(baseKncBought);
        let baseExpectedFee = getExpectedFees(baseTotalToBought);
        let baseTotalToSpend = baseTotalToBought.add(baseExpectedFee);

        beforeEach("Create NFT (id 1)", async () => {
            // create nft 1 with UNI and KNC from DAI (use the base amounts)
            let orders: OrderStruct[] = getUniAndKncWithDaiOrders(baseUniBought, baseKncBought);
            await context.nestedFactory
                .connect(context.user1)
                .create(0, [
                    { inputToken: context.mockDAI.address, amount: baseTotalToSpend, orders, fromReserve: true },
                ]);
        });

        it("cant increase if another user portfolio", async () => {
            await expect(
                context.nestedFactory.connect(context.masterDeployer).updateLockTimestamp(1, Date.now()),
            ).to.be.revertedWith("NF: CALLER_NOT_OWNER");
        });

        it("cant increase nonexistent portfolio", async () => {
            await expect(
                context.nestedFactory.connect(context.user1).updateLockTimestamp(2, Date.now()),
            ).to.be.revertedWith("ERC721: owner query for nonexistent token");
        });

        it("cant decrease timestamp", async () => {
            await context.nestedFactory.connect(context.user1).updateLockTimestamp(1, Date.now());
            await expect(
                context.nestedFactory.connect(context.user1).updateLockTimestamp(1, Date.now() - 1000),
            ).to.be.revertedWith("NRC: LOCK_PERIOD_CANT_DECREASE");
        });

        /*
         * We are testing with the "withdraw" function, but it's the same for
         * all the functions implementing the "isUnlocked" modifier.
         */
        it("cant withdraw if locked", async () => {
            await expect(context.nestedFactory.connect(context.user1).updateLockTimestamp(1, Date.now() + 1000))
                .to.emit(context.nestedRecords, "LockTimestampIncreased")
                .withArgs(1, Date.now() + 1000);

            await expect(context.nestedFactory.connect(context.user1).withdraw(1, 0)).to.be.revertedWith(
                "NF: LOCKED_NFT",
            );
        });

        it("can withdraw after the waiting period", async () => {
            const timestampNow = Date.now();
            await expect(context.nestedFactory.connect(context.user1).updateLockTimestamp(1, timestampNow + 1000))
                .to.emit(context.nestedRecords, "LockTimestampIncreased")
                .withArgs(1, timestampNow + 1000);

            await network.provider.send("evm_increaseTime", [Date.now()]);
            await network.provider.send("evm_mine");

            await expect(context.nestedFactory.connect(context.user1).withdraw(1, 0)).to.not.be.reverted;
        });
    });

    describe("unlockTokens()", () => {
        it("return tokens to owner", async () => {
            const oldBalance = await context.mockDAI
                .connect(context.masterDeployer)
                .balanceOf(context.masterDeployer.address);
            // User send 1 DAI to the Factory
            await context.mockDAI
                .connect(context.user1)
                .transfer(context.nestedFactory.address, ethers.utils.parseEther("1"));
            await context.nestedFactory.connect(context.masterDeployer).unlockTokens(context.mockDAI.address);

            expect(await context.mockDAI.balanceOf(context.masterDeployer.address)).to.be.equal(
                ethers.utils.parseEther("1").add(oldBalance),
            );
        });

        it("reverts if not factory owner", async () => {
            // User send 1 DAI to the Factory
            await context.mockDAI
                .connect(context.user1)
                .transfer(context.nestedFactory.address, ethers.utils.parseEther("1"));
            await expect(
                context.nestedFactory.connect(context.user1).unlockTokens(context.mockDAI.address),
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });
    });

    // Create the Orders to buy KNC and UNI with DAI
    function getUniAndKncWithDaiOrders(uniBought: BigNumber, kncBought: BigNumber) {
        return [
            buildOrderStruct(context.zeroExOperatorNameBytes32, context.mockUNI.address, [
                ["address", context.mockDAI.address],
                ["address", context.mockUNI.address],
                [
                    "bytes",
                    ethers.utils.hexConcat([
                        dummyRouterSelector,
                        abiCoder.encode(
                            ["address", "address", "uint"],
                            [context.mockDAI.address, context.mockUNI.address, uniBought],
                        ),
                    ]),
                ],
            ]),
            buildOrderStruct(context.zeroExOperatorNameBytes32, context.mockKNC.address, [
                ["address", context.mockDAI.address],
                ["address", context.mockKNC.address],
                [
                    "bytes",
                    ethers.utils.hexConcat([
                        dummyRouterSelector,
                        abiCoder.encode(
                            ["address", "address", "uint"],
                            [context.mockDAI.address, context.mockKNC.address, kncBought],
                        ),
                    ]),
                ],
            ]),
        ];
    }

    // Create the Orders to buy KNC and UNI with ETH
    function getUniAndKncWithETHOrders(uniBought: BigNumber, kncBought: BigNumber) {
        return [
            buildOrderStruct(context.zeroExOperatorNameBytes32, context.mockUNI.address, [
                ["address", context.WETH.address],
                ["address", context.mockUNI.address],
                [
                    "bytes",
                    ethers.utils.hexConcat([
                        dummyRouterSelector,
                        abiCoder.encode(
                            ["address", "address", "uint"],
                            [context.WETH.address, context.mockUNI.address, uniBought],
                        ),
                    ]),
                ],
            ]),
            buildOrderStruct(context.zeroExOperatorNameBytes32, context.mockKNC.address, [
                ["address", context.WETH.address],
                ["address", context.mockKNC.address],
                [
                    "bytes",
                    ethers.utils.hexConcat([
                        dummyRouterSelector,
                        abiCoder.encode(
                            ["address", "address", "uint"],
                            [context.WETH.address, context.mockKNC.address, kncBought],
                        ),
                    ]),
                ],
            ]),
        ];
    }

    // Generic function to create a 1:1 Order
    function getTokenBWithTokenAOrders(amount: BigNumber, tokenA: string, tokenB: string) {
        return [
            buildOrderStruct(context.zeroExOperatorNameBytes32, tokenB, [
                ["address", tokenA],
                ["address", tokenB],
                [
                    "bytes",
                    ethers.utils.hexConcat([
                        dummyRouterSelector,
                        abiCoder.encode(["address", "address", "uint"], [tokenA, tokenB, amount]),
                    ]),
                ],
            ]),
        ];
    }

    // Create the Orders to get USDC with UNI and KNC
    function getUsdcWithUniAndKncOrders(uniSold: BigNumber, kncSold: BigNumber) {
        return [
            buildOrderStruct(context.zeroExOperatorNameBytes32, context.mockUNI.address, [
                ["address", context.mockUNI.address],
                ["address", context.mockUSDC.address],
                [
                    "bytes",
                    ethers.utils.hexConcat([
                        dummyRouterSelector,
                        abiCoder.encode(
                            ["address", "address", "uint"],
                            [context.mockUNI.address, context.mockUSDC.address, uniSold],
                        ),
                    ]),
                ],
            ]),
            buildOrderStruct(context.zeroExOperatorNameBytes32, context.mockKNC.address, [
                ["address", context.mockKNC.address],
                ["address", context.mockUSDC.address],
                [
                    "bytes",
                    ethers.utils.hexConcat([
                        dummyRouterSelector,
                        abiCoder.encode(
                            ["address", "address", "uint"],
                            [context.mockKNC.address, context.mockUSDC.address, kncSold],
                        ),
                    ]),
                ],
            ]),
        ];
    }

    // Create the Orders to get Eth with UNI and KNC
    function getWethWithUniAndKncOrders(uniSold: BigNumber, kncSold: BigNumber) {
        return [
            buildOrderStruct(context.zeroExOperatorNameBytes32, context.mockUNI.address, [
                ["address", context.mockUNI.address],
                ["address", context.WETH.address],
                [
                    "bytes",
                    ethers.utils.hexConcat([
                        dummyRouterSelector,
                        abiCoder.encode(
                            ["address", "address", "uint"],
                            [context.mockUNI.address, context.WETH.address, uniSold],
                        ),
                    ]),
                ],
            ]),
            buildOrderStruct(context.zeroExOperatorNameBytes32, context.mockKNC.address, [
                ["address", context.mockKNC.address],
                ["address", context.WETH.address],
                [
                    "bytes",
                    ethers.utils.hexConcat([
                        dummyRouterSelector,
                        abiCoder.encode(
                            ["address", "address", "uint"],
                            [context.mockKNC.address, context.WETH.address, kncSold],
                        ),
                    ]),
                ],
            ]),
        ];
    }
});
