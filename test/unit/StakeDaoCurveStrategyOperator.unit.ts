import { expect } from "chai";
import { createFixtureLoader } from "ethereum-waffle";
import { BigNumber, utils, Wallet } from "ethers";
import { ethers } from "hardhat";
import { cleanResult, getStakeDao3EpsDepositOrder, getStakeDao3EpsWithdrawOrder, OrderStruct } from "../../scripts/utils";
import { appendDecimals, BIG_NUMBER_ZERO, getExpectedFees, UINT256_MAX } from "../helpers";
import { factoryAndOperatorsForkingBSCFixture, FactoryAndOperatorsForkingBSCFixture, USDC } from "../shared/fixtures";
import { describeOnBscFork, provider } from "../shared/provider";
import { LoadFixtureFunction } from "../types";

let loadFixture: LoadFixtureFunction;

describeOnBscFork("StakeDaoCurveStrategyOperator", () => {
    let context: FactoryAndOperatorsForkingBSCFixture;
    const ETH = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

    before("loader", async () => {
        loadFixture = createFixtureLoader(provider.getWallets(), provider);
    });

    beforeEach("create fixture loader", async () => {
        context = await loadFixture(factoryAndOperatorsForkingBSCFixture);
    });

    it("deploys and has an address", async () => {
        expect(context.stakeDaoCurveStrategyOperator.address).to.be.a.string;
    });

    describe("addStrategy()", () => {
        it("Should revert if strategy is address zero", async () => {
            const strategyToAdd = ethers.constants.AddressZero;
            const poolToAdd = Wallet.createRandom().address;
            await expect(
                context.stakeDaoStrategyStorage.connect(context.masterDeployer).addStrategy(strategyToAdd, poolToAdd),
            ).to.be.revertedWith("SDSS: INVALID_STRATEGY_ADDRESS");
        });

        it("Should revert if pool is address zero", async () => {
            const strategyToAdd = Wallet.createRandom().address;
            const poolToAdd = ethers.constants.AddressZero;
            await expect(
                context.stakeDaoStrategyStorage.connect(context.masterDeployer).addStrategy(strategyToAdd, poolToAdd),
            ).to.be.revertedWith("SDSS: INVALID_POOL_ADDRESS");
        });

        it("Should revert if already existent strategy", async () => {
            const strategyToAdd = Wallet.createRandom().address;
            const poolToAdd = Wallet.createRandom().address;
            await context.stakeDaoStrategyStorage.connect(context.masterDeployer).addStrategy(strategyToAdd, poolToAdd);

            await expect(
                context.stakeDaoStrategyStorage.connect(context.masterDeployer).addStrategy(strategyToAdd, poolToAdd),
            ).to.be.revertedWith("SDSS: ALREADY_EXISTENT_STRATEGY");
        });

        it("Should add new strategy", async () => {
            const strategyToAdd = Wallet.createRandom().address;
            const poolToAdd = Wallet.createRandom().address;
            await context.stakeDaoStrategyStorage.connect(context.masterDeployer).addStrategy(strategyToAdd, poolToAdd);

            expect(await context.stakeDaoStrategyStorage.strategies(strategyToAdd)).to.equal(poolToAdd);
        });
    });

    describe("removeStrategy()", () => {
        it("Should revert if non-existent strategy", async () => {
            const strategyToRemove = Wallet.createRandom().address;

            await expect(
                context.stakeDaoStrategyStorage.connect(context.masterDeployer).removeStrategy(strategyToRemove),
            ).to.be.revertedWith("SDSS: NON_EXISTENT_STRATEGY");
        });

        it("Should remove strategy", async () => {
            const strategyToAdd = Wallet.createRandom().address;
            const poolToAdd = Wallet.createRandom().address;

            await context.stakeDaoStrategyStorage.connect(context.masterDeployer).addStrategy(strategyToAdd, poolToAdd);
            expect(await context.stakeDaoStrategyStorage.strategies(strategyToAdd)).to.equal(poolToAdd);

            await context.stakeDaoStrategyStorage.connect(context.masterDeployer).removeStrategy(strategyToAdd);
            expect(await context.stakeDaoStrategyStorage.strategies(strategyToAdd)).to.equal(ethers.constants.AddressZero);
        });
    });

    describe("deposit()", () => {
        it("Should revert if amount to deposit is zero", async () => {
            // All the amounts for this test
            const bnbToDeposit = appendDecimals(1);
            const bnbToDepositAndFees = bnbToDeposit.add(getExpectedFees(bnbToDeposit));

            // Orders to deposit in StakeDAO with amount 0
            let orders: OrderStruct[] = getStakeDao3EpsDepositOrder(context, context.stakeDaoUsdStrategyAddress, context.WBNB.address, BIG_NUMBER_ZERO);

            // User1 creates the portfolio/NFT
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .create(0, [{ inputToken: ETH, amount: bnbToDepositAndFees, orders, fromReserve: false }], {
                        value: bnbToDepositAndFees,
                    }),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });

        it("Should revert if the strategy is not whitelisted in StakeDAO storage", async () => {
            // All the amounts for this test
            let usdcToDeposit: BigNumber = appendDecimals(1000);
            let usdcToDepositWithFees: BigNumber = usdcToDeposit.add(getExpectedFees(usdcToDeposit));
            let unwhitelistedStrategy: string = Wallet.createRandom().address;

            let orders: OrderStruct[] = getStakeDao3EpsDepositOrder(context, unwhitelistedStrategy, USDC, usdcToDeposit);

            // // User1 creates the portfolio / NFT and submit stakeDAO deposit order
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .create(0, [{ inputToken: USDC, amount: usdcToDepositWithFees, orders, fromReserve: false }], {
                        value: 0,
                    }),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });

        it("Should revert if amount to deposit is greater than available", async () => {
            let usdcToDeposit: BigNumber = appendDecimals(1000);

            let orders: OrderStruct[] = getStakeDao3EpsDepositOrder(context, context.stakeDaoUsdStrategyAddress, USDC, usdcToDeposit.mul(2));

            // User1 creates the portfolio / NFT
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .create(0, [{ inputToken: USDC, amount: usdcToDeposit, orders, fromReserve: false }], {
                        value: 0,
                    }),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });

        it("Should revert if token to deposit is not in the strategy's pool", async () => {
            // All the amounts for this test
            const bnbToDeposit = appendDecimals(1);
            const bnbToDepositAndFees = bnbToDeposit.add(getExpectedFees(bnbToDeposit));

            // Orders to deposit in beefy with amount 0
            let orders: OrderStruct[] = getStakeDao3EpsDepositOrder(context, context.stakeDaoUsdStrategyAddress, context.WBNB.address, bnbToDeposit);

            // User1 creates the portfolio/NFT
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .create(0, [{ inputToken: ETH, amount: bnbToDepositAndFees, orders, fromReserve: false }], {
                        value: bnbToDepositAndFees,
                    }),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });

        it("Sould revert if the minStrategyToken is not reached", async () => {
            // All the amounts for this test
            let usdcToDeposit: BigNumber = appendDecimals(1000);
            let usdcToDepositWithFees: BigNumber = usdcToDeposit.add(getExpectedFees(usdcToDeposit));

            let orders: OrderStruct[] = getStakeDao3EpsDepositOrder(context, context.stakeDaoUsdStrategyAddress, USDC, usdcToDeposit, UINT256_MAX);

            // // User1 creates the portfolio / NFT and submit stakeDAO deposit order
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .create(0, [{ inputToken: USDC, amount: usdcToDepositWithFees, orders, fromReserve: false }], {
                        value: 0,
                    }),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        })

        it("Create/Deposit in StakeDAO with USDC", async () => {
            // All the amounts for this test
            let usdcToDeposit: BigNumber = appendDecimals(1000);
            let usdcToDepositWithFees: BigNumber = usdcToDeposit.add(getExpectedFees(usdcToDeposit));

            const mockERC20Factory = await ethers.getContractFactory("MockERC20");
            const usdc = mockERC20Factory.attach(USDC);

            let orders: OrderStruct[] = getStakeDao3EpsDepositOrder(context, context.stakeDaoUsdStrategyAddress, USDC, usdcToDeposit);

            const usdcBalanceBefore = await usdc.balanceOf(context.user1.address);

            // // User1 creates the portfolio / NFT and submit stakeDAO deposit order
            await context.nestedFactory
                .connect(context.user1)
                .create(0, [{ inputToken: USDC, amount: usdcToDepositWithFees, orders, fromReserve: false }], {
                    value: 0,
                })


            // User1 must be the owner of NFT n°1
            expect(await context.nestedAsset.ownerOf(1)).to.be.equal(context.user1.address);

            const strategy = mockERC20Factory.attach(context.stakeDaoUsdStrategyAddress);

            // StakeDAO strategy tokens user1 balance should be greater than 0
            const strategyTokenBalance = await strategy.balanceOf(context.nestedReserve.address);
            expect(strategyTokenBalance).to.be.gt(BIG_NUMBER_ZERO);

            expect(await usdc.balanceOf(context.user1.address)).to.be.equal(usdcBalanceBefore.sub(usdcToDepositWithFees));

            // The FeeSplitter must receive the right fee amount
            expect(await usdc.balanceOf(context.feeSplitter.address)).to.be.equal(
                getExpectedFees(usdcToDeposit),
            );

            const expectedNfts = [
                {
                    id: BigNumber.from(1),
                    assets: [{ token: context.stakeDaoUsdStrategyAddress, qty: strategyTokenBalance }],
                },
            ];

            const nfts = await context.nestedAssetBatcher.getNfts(context.user1.address);

            expect(JSON.stringify(cleanResult(nfts))).to.equal(JSON.stringify(cleanResult(expectedNfts)));
        });
    });

    describe("withdraw()", () => {
        beforeEach("Create NFT (id 1) with USDC deposited", async () => {
            // All the amounts for this test
            let usdcToDeposit: BigNumber = appendDecimals(1000);
            let usdcToDepositWithFees: BigNumber = usdcToDeposit.add(getExpectedFees(usdcToDeposit));

            let orders: OrderStruct[] = getStakeDao3EpsDepositOrder(context, context.stakeDaoUsdStrategyAddress, USDC, usdcToDeposit);

            // // User1 creates the portfolio / NFT and submit stakeDAO deposit order
            await context.nestedFactory
                .connect(context.user1)
                .create(0, [{ inputToken: USDC, amount: usdcToDepositWithFees, orders, fromReserve: false }], {
                    value: 0,
                });
        });

        it("Should revert if amount to withdraw is zero", async () => {
            const mockERC20Factory = await ethers.getContractFactory("MockERC20");
            const strategy = mockERC20Factory.attach(context.stakeDaoUsdStrategyAddress);

            const strategyTokenBalance = await strategy.balanceOf(context.nestedReserve.address);

            // Orders to withdraw from stakeDAO
            let orders: OrderStruct[] = getStakeDao3EpsWithdrawOrder(context, context.stakeDaoUsdStrategyAddress, BIG_NUMBER_ZERO, USDC);

            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .processOutputOrders(1, [
                        { outputToken: USDC, amounts: [strategyTokenBalance], orders, toReserve: true },
                    ]),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });

        it("Should revert if strategy is not whitelisted", async () => {
            const mockERC20Factory = await ethers.getContractFactory("MockERC20");
            const strategy = mockERC20Factory.attach(context.stakeDaoUsdStrategyAddress);
            const strategyTokenBalance = await strategy.balanceOf(context.nestedReserve.address);

            const unknownStrategyAddress = Wallet.createRandom().address;

            // Orders to withdraw from stakeDAO
            let orders: OrderStruct[] = getStakeDao3EpsWithdrawOrder(context, unknownStrategyAddress, strategyTokenBalance, USDC);

            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .processOutputOrders(1, [
                        { outputToken: USDC, amounts: [strategyTokenBalance], orders, toReserve: true },
                    ]),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });

        it("Should revert if amount is greater than available", async () => {
            const mockERC20Factory = await ethers.getContractFactory("MockERC20");
            const strategy = mockERC20Factory.attach(context.stakeDaoUsdStrategyAddress);
            const strategyTokenBalance = await strategy.balanceOf(context.nestedReserve.address);

            // Orders to withdraw from stakeDAO
            let orders: OrderStruct[] = getStakeDao3EpsWithdrawOrder(context, context.stakeDaoUsdStrategyAddress, strategyTokenBalance.mul(2), USDC);

            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .processOutputOrders(1, [
                        { outputToken: USDC, amounts: [strategyTokenBalance], orders, toReserve: true },
                    ]),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });

        it("Should revert if output token is not in the curve pool", async () => {
            const mockERC20Factory = await ethers.getContractFactory("MockERC20");
            const strategy = mockERC20Factory.attach(context.stakeDaoUsdStrategyAddress);
            const strategyTokenBalance = await strategy.balanceOf(context.nestedReserve.address);

            // Orders to withdraw from stakeDAO
            let orders: OrderStruct[] = getStakeDao3EpsWithdrawOrder(context, context.stakeDaoUsdStrategyAddress, strategyTokenBalance, context.WBNB.address);

            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .processOutputOrders(1, [
                        { outputToken: USDC, amounts: [strategyTokenBalance], orders, toReserve: true },
                    ]),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });

        it("Should revert if minOutputToken is not reached", async () => {
            const mockERC20Factory = await ethers.getContractFactory("MockERC20");
            const strategy = mockERC20Factory.attach(context.stakeDaoUsdStrategyAddress);
            const strategyTokenBalance = await strategy.balanceOf(context.nestedReserve.address);

            // Orders to withdraw from stakeDAO
            let orders: OrderStruct[] = getStakeDao3EpsWithdrawOrder(context, context.stakeDaoUsdStrategyAddress, strategyTokenBalance, USDC, UINT256_MAX);

            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .processOutputOrders(1, [
                        { outputToken: USDC, amounts: [strategyTokenBalance], orders, toReserve: true },
                    ]),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });

        it("Destroy/Withdraw from stakeDAO", async () => {
            const mockERC20Factory = await ethers.getContractFactory("MockERC20");
            const strategy = mockERC20Factory.attach(context.stakeDaoUsdStrategyAddress);
            const usdcContract = mockERC20Factory.attach(USDC);
            const strategyTokenBalance = await strategy.balanceOf(context.nestedReserve.address);

            // Orders to withdraw from stakeDAO
            let orders: OrderStruct[] = getStakeDao3EpsWithdrawOrder(context, context.stakeDaoUsdStrategyAddress, strategyTokenBalance, USDC);

            await context.nestedFactory
                .connect(context.user1)
                .processOutputOrders(1, [
                    { outputToken: USDC, amounts: [strategyTokenBalance], orders, toReserve: true },
                ]);

            // All strategy token removed from reserve
            expect(await strategy.balanceOf(context.nestedReserve.address)).to.be.equal(BIG_NUMBER_ZERO);

            /*
             * I can't predict the USDC received in the FeeSplitter.
             * It should be greater than 0.02 USDC, but sub 1% to allow a margin of error
             */
            expect(await usdcContract.balanceOf(context.feeSplitter.address)).to.be.gt(
                getExpectedFees(appendDecimals(2)).sub(getExpectedFees(appendDecimals(2)).div(100)),
            );
        });
    });
});
