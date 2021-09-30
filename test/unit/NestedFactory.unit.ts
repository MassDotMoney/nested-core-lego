import { LoadFixtureFunction } from "../types";
import { factoryAndZeroExFixture, FactoryAndZeroExFixture } from "../shared/fixtures";
import { ActorFixture } from "../shared/actors";
import { createFixtureLoader, expect, provider } from "../shared/provider";
import { BigNumber, Wallet } from "ethers";
import { appendDecimals, toBytes32 } from "../helpers";
import { ethers } from "hardhat";

let loadFixture: LoadFixtureFunction;

interface ZeroExOrder {
    operator: string;
    token: string;
    callData: string | [];
    commit: boolean;
}

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

    describe("create()", () => {
        const ETH = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
        const abiCoder = new ethers.utils.AbiCoder();

        // Selector of "function dummyswapToken(address,address,uint)" of the DummyRouter
        const dummyRouterSelector = "0x76ab33a6";

        beforeEach("Set reserve", async () => {
            await context.nestedFactory.connect(context.masterDeployer).setReserve(context.nestedReserve.address);
        });

        it("reverts if Orders list is empty", async () => {
            let orders: ZeroExOrder[] = [];
            await expect(
                context.nestedFactory.connect(context.user1).create(0, context.mockDAI.address, 0, orders),
            ).to.be.revertedWith("NestedFactory::create: Missing orders");
        });

        it("reverts if bad calldatas", async () => {
            // All the amounts for this test
            const uniBought = appendDecimals(10);
            const expectedFee = uniBought.div(100);
            const totalToSpend = uniBought.add(expectedFee);

            // Orders to buy UNI but the sellToken param (ZeroExOperator) is removed
            const orders: ZeroExOrder[] = [
                {
                    operator: toBytes32("ZeroEx"),
                    token: context.mockUNI.address,
                    callData: abiCoder.encode(
                        ["address", "bytes4", "bytes"],
                        [
                            context.mockUNI.address,
                            dummyRouterSelector,
                            abiCoder.encode(
                                ["address", "address", "uint"],
                                [context.mockDAI.address, context.mockUNI.address, uniBought],
                            ),
                        ],
                    ),
                    commit: true,
                },
            ];

            await expect(
                context.nestedFactory.connect(context.user1).create(0, context.mockDAI.address, totalToSpend, orders),
            ).to.be.revertedWith("NestedFactory::_submitOrder: Operator call failed");
        });

        it("reverts if wrong output token in calldata", async () => {
            // All the amounts for this test
            const uniBought = appendDecimals(10);
            const expectedFee = uniBought.div(100);
            const totalToSpend = uniBought.add(expectedFee);

            // Orders to buy UNI but the sellToken param (ZeroExOperator) is removed
            const orders: ZeroExOrder[] = [
                {
                    operator: toBytes32("ZeroEx"),
                    token: context.mockUNI.address,
                    callData: abiCoder.encode(
                        ["address", "address", "bytes4", "bytes"],
                        [
                            context.mockDAI.address,
                            context.mockKNC.address,
                            dummyRouterSelector,
                            abiCoder.encode(
                                ["address", "address", "uint"],
                                [context.mockDAI.address, context.mockKNC.address, uniBought],
                            ),
                        ],
                    ),
                    commit: true,
                },
            ];

            await expect(
                context.nestedFactory.connect(context.user1).create(0, context.mockDAI.address, totalToSpend, orders),
            ).to.be.revertedWith("NestedFactory::_submitOrder: Wrong output token in calldata");
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
            let orders: ZeroExOrder[] = getUniAndKncWithDaiOrders(uniBought, kncBought);

            // Should revert with "assert" (no message)
            await expect(
                context.nestedFactory.connect(context.user1).create(0, context.mockDAI.address, totalToSpend, orders),
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
            let orders: ZeroExOrder[] = getUniAndKncWithETHOrders(uniBought, kncBought);

            // Should revert with "assert" (no message)
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .create(0, context.mockDAI.address, totalToSpend, orders, { value: totalToSpend }),
            ).to.be.reverted;
        });

        it("Creates NFT from DAI with KNI and UNI inside (ZeroExOperator) with right amounts", async () => {
            // All the amounts for this test
            const uniBought = appendDecimals(6);
            const kncBought = appendDecimals(4);
            const totalToBought = uniBought.add(kncBought);
            const expectedFee = totalToBought.div(100);
            const totalToSpend = totalToBought.add(expectedFee);

            // Orders for UNI and KNC
            let orders: ZeroExOrder[] = getUniAndKncWithDaiOrders(uniBought, kncBought);

            // User1 creates the portfolio/NFT and emit event NftCreated
            await expect(
                context.nestedFactory.connect(context.user1).create(0, context.mockDAI.address, totalToSpend, orders),
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
            let orders: ZeroExOrder[] = getUniAndKncWithDaiOrders(uniBought, kncBought);

            // User1 creates the portfolio/NFT and emit event NftCreated
            await expect(
                context.nestedFactory.connect(context.user1).create(0, context.mockDAI.address, totalToSpend, orders),
            )
                .to.emit(context.nestedFactory, "NftCreated")
                .withArgs(1, 0);

            // The FeeSplitter must receive the DAI in excess
            expect(await context.mockDAI.balanceOf(context.feeSplitter.address)).to.be.equal(
                totalToSpend.sub(totalToBought),
            );
        });

        it("Creates NFT from ETH with KNI and UNI inside (ZeroExOperator) with right amounts", async () => {
            // All the amounts for this test
            const uniBought = appendDecimals(6);
            const kncBought = appendDecimals(4);
            const totalToBought = uniBought.add(kncBought);
            const expectedFee = totalToBought.div(100);
            const totalToSpend = totalToBought.add(expectedFee);

            const ethBalanceBefore = await context.user1.getBalance();

            // Orders for UNI and KNC
            let orders: ZeroExOrder[] = getUniAndKncWithETHOrders(uniBought, kncBought);

            // User1 creates the portfolio/NFT
            const tx = await context.nestedFactory
                .connect(context.user1)
                .create(0, ETH, totalToSpend, orders, { value: totalToSpend });

            // Get the transaction fees
            let txFees;
            const gasPrice = tx.gasPrice;
            tx.wait().then(value => (txFees = value.gasUsed.mul(gasPrice)));

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

        // Create the Orders to buy KNC and UNI with DAI
        function getUniAndKncWithDaiOrders(uniBought: BigNumber, kncBought: BigNumber) {
            return [
                {
                    operator: toBytes32("ZeroEx"),
                    token: context.mockUNI.address,
                    callData: abiCoder.encode(
                        ["address", "address", "bytes4", "bytes"],
                        [
                            context.mockDAI.address,
                            context.mockUNI.address,
                            dummyRouterSelector,
                            abiCoder.encode(
                                ["address", "address", "uint"],
                                [context.mockDAI.address, context.mockUNI.address, uniBought],
                            ),
                        ],
                    ),
                    commit: true,
                },
                {
                    operator: toBytes32("ZeroEx"),
                    token: context.mockKNC.address,
                    callData: abiCoder.encode(
                        ["address", "address", "bytes4", "bytes"],
                        [
                            context.mockDAI.address,
                            context.mockKNC.address,
                            dummyRouterSelector,
                            abiCoder.encode(
                                ["address", "address", "uint"],
                                [context.mockDAI.address, context.mockKNC.address, kncBought],
                            ),
                        ],
                    ),
                    commit: true,
                },
            ];
        }

        // Create the Orders to buy KNC and UNI with ETH
        function getUniAndKncWithETHOrders(uniBought: BigNumber, kncBought: BigNumber) {
            return [
                {
                    operator: toBytes32("ZeroEx"),
                    token: context.mockUNI.address,
                    callData: abiCoder.encode(
                        ["address", "address", "bytes4", "bytes"],
                        [
                            context.WETH.address,
                            context.mockUNI.address,
                            dummyRouterSelector,
                            abiCoder.encode(
                                ["address", "address", "uint"],
                                [context.WETH.address, context.mockUNI.address, uniBought],
                            ),
                        ],
                    ),
                    commit: true,
                },
                {
                    operator: toBytes32("ZeroEx"),
                    token: context.mockKNC.address,
                    callData: abiCoder.encode(
                        ["address", "address", "bytes4", "bytes"],
                        [
                            context.WETH.address,
                            context.mockKNC.address,
                            dummyRouterSelector,
                            abiCoder.encode(
                                ["address", "address", "uint"],
                                [context.WETH.address, context.mockKNC.address, kncBought],
                            ),
                        ],
                    ),
                    commit: true,
                },
            ];
        }
    });
});
