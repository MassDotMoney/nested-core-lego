import { expect } from "chai";
import { createFixtureLoader } from "ethereum-waffle";
import { BigNumber, utils, Wallet } from "ethers";
import { ethers } from "hardhat";
import { cleanResult, getStakeDaoDepositETHOrder, getStakeDaoDepositOrder, getStakeDaoWithdraw128Order, getStakeDaoWithdrawETHOrder, OrderStruct } from "../../scripts/utils";
import { appendDecimals, BIG_NUMBER_ZERO, getExpectedFees, UINT256_MAX } from "../helpers";
import { factoryAndOperatorsForkingBSCFixture, FactoryAndOperatorsForkingBSCFixture, factoryAndOperatorsForkingETHFixture, FactoryAndOperatorsForkingETHFixture, USDCBsc } from "../shared/fixtures";
import { describeOnBscFork, describeOnEthFork, provider } from "../shared/provider";
import { LoadFixtureFunction } from "../types";

let loadFixture: LoadFixtureFunction;

describeOnBscFork("StakeDaoCurveStrategyOperator BSC fork", () => {
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
            const poolToAdd = {
                poolAddress: Wallet.createRandom().address,
                poolCoinAmount: 2,
                lpToken: Wallet.createRandom().address
            };
            await expect(
                context.stakeDaoStrategyStorage.connect(context.masterDeployer).addStrategy(strategyToAdd, poolToAdd),
            ).to.be.revertedWith("SDSS: INVALID_STRATEGY_ADDRESS");
        });

        it("Should revert if pool is address zero", async () => {
            const strategyToAdd = Wallet.createRandom().address;
            const poolToAdd = {
                poolAddress: ethers.constants.AddressZero,
                poolCoinAmount: 2,
                lpToken: Wallet.createRandom().address
            };
            await expect(
                context.stakeDaoStrategyStorage.connect(context.masterDeployer).addStrategy(strategyToAdd, poolToAdd),
            ).to.be.revertedWith("SDSS: INVALID_POOL_ADDRESS");
        });

        it("Should revert if already existent strategy", async () => {
            const strategyToAdd = Wallet.createRandom().address;
            const poolToAdd = {
                poolAddress: Wallet.createRandom().address,
                poolCoinAmount: 2,
                lpToken: Wallet.createRandom().address
            };
            await context.stakeDaoStrategyStorage.connect(context.masterDeployer).addStrategy(strategyToAdd, poolToAdd);

            await expect(
                context.stakeDaoStrategyStorage.connect(context.masterDeployer).addStrategy(strategyToAdd, poolToAdd),
            ).to.be.revertedWith("SDSS: STRATEGY_ALREADY_HAS_POOL");
        });

        it("Should add new strategy", async () => {
            const strategyToAdd = Wallet.createRandom().address;
            const poolToAdd = {
                poolAddress: Wallet.createRandom().address,
                poolCoinAmount: 2,
                lpToken: Wallet.createRandom().address
            };
            await context.stakeDaoStrategyStorage.connect(context.masterDeployer).addStrategy(strategyToAdd, poolToAdd);

            expect(await (await context.stakeDaoStrategyStorage.strategies(strategyToAdd)).poolAddress).to.equal(poolToAdd.poolAddress);
            expect(await (await context.stakeDaoStrategyStorage.strategies(strategyToAdd)).poolCoinAmount).to.equal(poolToAdd.poolCoinAmount);
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
            const poolToAdd = {
                poolAddress: Wallet.createRandom().address,
                poolCoinAmount: 2,
                lpToken: Wallet.createRandom().address
            };
            await context.stakeDaoStrategyStorage.connect(context.masterDeployer).addStrategy(strategyToAdd, poolToAdd);

            expect(await (await context.stakeDaoStrategyStorage.strategies(strategyToAdd)).poolAddress).to.equal(poolToAdd.poolAddress);
            expect(await (await context.stakeDaoStrategyStorage.strategies(strategyToAdd)).poolCoinAmount).to.equal(poolToAdd.poolCoinAmount);

            await context.stakeDaoStrategyStorage.connect(context.masterDeployer).removeStrategy(strategyToAdd);
            expect(await (await context.stakeDaoStrategyStorage.strategies(strategyToAdd)).poolAddress).to.equal(ethers.constants.AddressZero);
        });
    });

    describe("deposit()", () => {
        it("Should revert if amount to deposit is zero", async () => {
            // All the amounts for this test
            const bnbToDeposit = appendDecimals(1);
            const bnbToDepositAndFees = bnbToDeposit.add(getExpectedFees(bnbToDeposit));

            // Orders to deposit in StakeDAO with amount 0
            let orders: OrderStruct[] = getStakeDaoDepositOrder(context, context.stakeDaoUsdStrategyAddress, context.WBNB.address, BIG_NUMBER_ZERO);

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

            let orders: OrderStruct[] = getStakeDaoDepositOrder(context, unwhitelistedStrategy, USDCBsc, usdcToDeposit);

            // // User1 creates the portfolio / NFT and submit stakeDAO deposit order
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .create(0, [{ inputToken: USDCBsc, amount: usdcToDepositWithFees, orders, fromReserve: false }], {
                        value: 0,
                    }),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });

        it("Should revert if amount to deposit is greater than available", async () => {
            let usdcToDeposit: BigNumber = appendDecimals(1000);

            let orders: OrderStruct[] = getStakeDaoDepositOrder(context, context.stakeDaoUsdStrategyAddress, USDCBsc, usdcToDeposit.mul(2));

            // User1 creates the portfolio / NFT
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .create(0, [{ inputToken: USDCBsc, amount: usdcToDeposit, orders, fromReserve: false }], {
                        value: 0,
                    }),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });

        it("Should revert if token to deposit is not in the strategy's pool", async () => {
            // All the amounts for this test
            const bnbToDeposit = appendDecimals(1);
            const bnbToDepositAndFees = bnbToDeposit.add(getExpectedFees(bnbToDeposit));

            // Orders to deposit in beefy with amount 0
            let orders: OrderStruct[] = getStakeDaoDepositOrder(context, context.stakeDaoUsdStrategyAddress, context.WBNB.address, bnbToDeposit);

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

            let orders: OrderStruct[] = getStakeDaoDepositOrder(context, context.stakeDaoUsdStrategyAddress, USDCBsc, usdcToDeposit, UINT256_MAX);

            // // User1 creates the portfolio / NFT and submit stakeDAO deposit order
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .create(0, [{ inputToken: USDCBsc, amount: usdcToDepositWithFees, orders, fromReserve: false }], {
                        value: 0,
                    }),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        })

        it("Create/Deposit in StakeDAO with USDC", async () => {
            // All the amounts for this test
            let usdcToDeposit: BigNumber = appendDecimals(1000);
            let usdcToDepositWithFees: BigNumber = usdcToDeposit.add(getExpectedFees(usdcToDeposit));

            const mockERC20Factory = await ethers.getContractFactory("MockERC20");
            const usdc = mockERC20Factory.attach(USDCBsc);

            let orders: OrderStruct[] = getStakeDaoDepositOrder(context, context.stakeDaoUsdStrategyAddress, USDCBsc, usdcToDeposit);

            const usdcBalanceBefore = await usdc.balanceOf(context.user1.address);

            // // User1 creates the portfolio / NFT and submit stakeDAO deposit order
            await context.nestedFactory
                .connect(context.user1)
                .create(0, [{ inputToken: USDCBsc, amount: usdcToDepositWithFees, orders, fromReserve: false }], {
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

    describe("withdraw128()", () => {
        beforeEach("Create NFT (id 1) with USDC deposited", async () => {
            // All the amounts for this test
            let usdcToDeposit: BigNumber = appendDecimals(1000);
            let usdcToDepositWithFees: BigNumber = usdcToDeposit.add(getExpectedFees(usdcToDeposit));

            let orders: OrderStruct[] = getStakeDaoDepositOrder(context, context.stakeDaoUsdStrategyAddress, USDCBsc, usdcToDeposit);

            // // User1 creates the portfolio / NFT and submit stakeDAO deposit order
            await context.nestedFactory
                .connect(context.user1)
                .create(0, [{ inputToken: USDCBsc, amount: usdcToDepositWithFees, orders, fromReserve: false }], {
                    value: 0,
                });
        });

        it("Should revert if amount to withdraw is zero", async () => {
            const mockERC20Factory = await ethers.getContractFactory("MockERC20");
            const strategy = mockERC20Factory.attach(context.stakeDaoUsdStrategyAddress);

            const strategyTokenBalance = await strategy.balanceOf(context.nestedReserve.address);

            // Orders to withdraw from stakeDAO
            let orders: OrderStruct[] = getStakeDaoWithdraw128Order(context, context.stakeDaoUsdStrategyAddress, BIG_NUMBER_ZERO, USDCBsc);

            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .processOutputOrders(1, [
                        { outputToken: USDCBsc, amounts: [strategyTokenBalance], orders, toReserve: true },
                    ]),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });

        it("Should revert if strategy is not whitelisted", async () => {
            const mockERC20Factory = await ethers.getContractFactory("MockERC20");
            const strategy = mockERC20Factory.attach(context.stakeDaoNonWhitelistedStrategy);
            const strategyTokenBalance = await strategy.balanceOf(context.nestedReserve.address);

            // Orders to withdraw from stakeDAO
            let orders: OrderStruct[] = getStakeDaoWithdraw128Order(context, context.stakeDaoNonWhitelistedStrategy, strategyTokenBalance, USDCBsc);

            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .processOutputOrders(1, [
                        { outputToken: USDCBsc, amounts: [strategyTokenBalance], orders, toReserve: true },
                    ]),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });

        it("Should revert if amount is greater than available", async () => {
            const mockERC20Factory = await ethers.getContractFactory("MockERC20");
            const strategy = mockERC20Factory.attach(context.stakeDaoUsdStrategyAddress);
            const strategyTokenBalance = await strategy.balanceOf(context.nestedReserve.address);

            // Orders to withdraw from stakeDAO
            let orders: OrderStruct[] = getStakeDaoWithdraw128Order(context, context.stakeDaoUsdStrategyAddress, strategyTokenBalance.mul(2), USDCBsc);

            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .processOutputOrders(1, [
                        { outputToken: USDCBsc, amounts: [strategyTokenBalance], orders, toReserve: true },
                    ]),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });

        it("Should revert if output token is not in the curve pool", async () => {
            const mockERC20Factory = await ethers.getContractFactory("MockERC20");
            const strategy = mockERC20Factory.attach(context.stakeDaoUsdStrategyAddress);
            const strategyTokenBalance = await strategy.balanceOf(context.nestedReserve.address);

            // Orders to withdraw from stakeDAO
            let orders: OrderStruct[] = getStakeDaoWithdraw128Order(context, context.stakeDaoUsdStrategyAddress, strategyTokenBalance, context.WBNB.address);

            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .processOutputOrders(1, [
                        { outputToken: USDCBsc, amounts: [strategyTokenBalance], orders, toReserve: true },
                    ]),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });

        it("Should revert if minOutputToken is not reached", async () => {
            const mockERC20Factory = await ethers.getContractFactory("MockERC20");
            const strategy = mockERC20Factory.attach(context.stakeDaoUsdStrategyAddress);
            const strategyTokenBalance = await strategy.balanceOf(context.nestedReserve.address);

            // Orders to withdraw from stakeDAO
            let orders: OrderStruct[] = getStakeDaoWithdraw128Order(context, context.stakeDaoUsdStrategyAddress, strategyTokenBalance, USDCBsc, UINT256_MAX);

            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .processOutputOrders(1, [
                        { outputToken: USDCBsc, amounts: [strategyTokenBalance], orders, toReserve: true },
                    ]),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });

        it("Destroy/Withdraw from stakeDAO", async () => {
            const mockERC20Factory = await ethers.getContractFactory("MockERC20");
            const strategy = mockERC20Factory.attach(context.stakeDaoUsdStrategyAddress);
            const usdcContract = mockERC20Factory.attach(USDCBsc);
            const strategyTokenBalance = await strategy.balanceOf(context.nestedReserve.address);

            // Orders to withdraw from stakeDAO
            let orders: OrderStruct[] = getStakeDaoWithdraw128Order(context, context.stakeDaoUsdStrategyAddress, strategyTokenBalance, USDCBsc);

            await context.nestedFactory.connect(context.user1).destroy(1, USDCBsc, orders);

            // All strategy token removed from reserve
            expect(await strategy.balanceOf(context.nestedReserve.address)).to.be.equal(BIG_NUMBER_ZERO);

            /*
             * USDC amount received by the FeeSplitter cannot be predicted.
             * It should be greater than 0.02 USDC, but sub 1% to allow a margin of error
             */
            expect(await usdcContract.balanceOf(context.feeSplitter.address)).to.be.gt(
                getExpectedFees(appendDecimals(2)).sub(getExpectedFees(appendDecimals(2)).div(100)),
            );
        });
    });
});

describeOnEthFork("StakeDaoCurveStrategyOperator ETH fork", () => {
    let context: FactoryAndOperatorsForkingETHFixture;
    const ETH = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

    before("loader", async () => {
        loadFixture = createFixtureLoader(provider.getWallets(), provider);
    });

    beforeEach("create fixture loader", async () => {
        context = await loadFixture(factoryAndOperatorsForkingETHFixture);
    });

    it("deploys and has an address", async () => {
        expect(context.stakeDaoCurveStrategyOperator.address).to.be.a.string;
    });


    describe("depositETH()", async () => {
        it("Should revert if amount to deposit is zero", async () => { // Done
            // All the amounts for this test
            const ethToDeposit = appendDecimals(1);
            const ethToDepositAndFees = ethToDeposit.add(getExpectedFees(ethToDeposit));

            // Orders to deposit in stakeDAO with amount 0
            let orders: OrderStruct[] = getStakeDaoDepositETHOrder(context, context.stakeDaoStEthStrategyAddress, BIG_NUMBER_ZERO);

            // User1 creates the portfolio/NFT
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .create(0, [{ inputToken: ETH, amount: ethToDepositAndFees, orders, fromReserve: false }], {
                        value: ethToDepositAndFees,
                    }),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });

        it("Should revert if deposit more than available", async () => { // Done, fail at withdrawer
            // All the amounts for this test
            const ethToDeposit = appendDecimals(1);
            const ethToDepositAndFees = ethToDeposit.add(getExpectedFees(ethToDeposit));

            // Orders to deposit in stakeDAO with "initial amount x 2" (more than msg.value)
            let orders: OrderStruct[] = getStakeDaoDepositETHOrder(context, context.stakeDaoStEthStrategyAddress, ethToDepositAndFees.mul(2));

            // User1 creates the portfolio/NFT
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .create(0, [{ inputToken: ETH, amount: ethToDepositAndFees, orders, fromReserve: false }], {
                        value: ethToDepositAndFees,
                    }),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });

        it("Should revert if strategy is not added in Operator Storage", async () => { // Done
            // All the amounts for this test
            const ethToDeposit = appendDecimals(1);
            const ethToDepositAndFees = ethToDeposit.add(getExpectedFees(ethToDeposit));

            // Orders to Deposit in stakeDAO
            let orders: OrderStruct[] = getStakeDaoDepositETHOrder(context, context.stakeDaoNonWhitelistedStrategy, ethToDeposit);

            // User1 creates the portfolio/NFT
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .create(0, [{ inputToken: ETH, amount: ethToDepositAndFees, orders, fromReserve: false }], {
                        value: ethToDepositAndFees,
                    }),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });

        it("Should revert if minstrategyAmount is not respected", async () => { // Done
            // All the amounts for this test
            const ethToDeposit = appendDecimals(1);
            const ethToDepositAndFees = ethToDeposit.add(getExpectedFees(ethToDeposit));

            // Orders to Deposit in stakeDAO
            let orders: OrderStruct[] = getStakeDaoDepositETHOrder(context, context.stakeDaoStEthStrategyAddress, ethToDeposit, UINT256_MAX);

            // User1 creates the portfolio/NFT
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .create(0, [{ inputToken: ETH, amount: ethToDepositAndFees, orders, fromReserve: false }], {
                        value: ethToDepositAndFees,
                    }),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });

        it("Create/Deposit in stakeDAO stETH with ETH", async () => {
            // All the amounts for this test
            const ethToDeposit = appendDecimals(1);
            const ethToDepositAndFees = ethToDeposit.add(getExpectedFees(ethToDeposit));

            const ethBalanceBefore = await context.user1.getBalance();

            // Orders to Deposit in stakeDAO
            let orders: OrderStruct[] = getStakeDaoDepositETHOrder(context, context.stakeDaoStEthStrategyAddress, ethToDeposit);

            // User1 creates the portfolio/NFT
            const tx = await context.nestedFactory
                .connect(context.user1)
                .create(0, [{ inputToken: ETH, amount: ethToDepositAndFees, orders, fromReserve: false }], {
                    value: ethToDepositAndFees,
                });

            // Get the transaction fees
            const txFees = await tx.wait().then(value => value.gasUsed.mul(value.effectiveGasPrice));

            // User1 must be the owner of NFT n°1
            expect(await context.nestedAsset.ownerOf(1)).to.be.equal(context.user1.address);

            const mockERC20Factory = await ethers.getContractFactory("MockERC20");
            const strategy = mockERC20Factory.attach(context.stakeDaoStEthStrategyAddress);

            //  Tokens in strategy
            const strategyBalanceReserve = await strategy.balanceOf(context.nestedReserve.address);
            expect(strategyBalanceReserve).to.not.be.equal(BIG_NUMBER_ZERO);

            expect(await context.user1.getBalance()).to.be.equal(ethBalanceBefore.sub(ethToDepositAndFees).sub(txFees));

            // The FeeSplitter must receive the right fee amount
            expect(await context.WETH.balanceOf(context.feeSplitter.address)).to.be.equal(
                getExpectedFees(ethToDeposit),
            );

            const expectedNfts = [
                {
                    id: BigNumber.from(1),
                    assets: [{ token: context.stakeDaoStEthStrategyAddress, qty: strategyBalanceReserve }],
                },
            ];

            const nfts = await context.nestedAssetBatcher.getNfts(context.user1.address);

            expect(JSON.stringify(cleanResult(nfts))).to.equal(JSON.stringify(cleanResult(expectedNfts)));
        });
    })

    describe("withdrawETH()", () => {
        beforeEach("Create NFT (id 1) with ETH deposited", async () => {
            // All the amounts for this test
            const ethToDeposit = appendDecimals(1);
            const ethToDepositAndFees = ethToDeposit.add(getExpectedFees(ethToDeposit));

            // Orders to Deposit in stakeDAO
            let orders: OrderStruct[] = getStakeDaoDepositETHOrder(context, context.stakeDaoStEthStrategyAddress, ethToDeposit);

            // User1 creates the portfolio/NFT
            const tx = await context.nestedFactory
                .connect(context.user1)
                .create(0, [{ inputToken: ETH, amount: ethToDepositAndFees, orders, fromReserve: false }], {
                    value: ethToDepositAndFees,
                });
        });
        it("Should revert if amount to withdraw is zero", async () => { // Done
            // Orders to withdraw from StakeDAO curve strategy
            let orders: OrderStruct[] = getStakeDaoWithdrawETHOrder(context, context.stakeDaoStEthStrategyAddress, BIG_NUMBER_ZERO);

            // User1 creates the portfolio/NFT
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .processOutputOrders(1, [
                        { outputToken: context.WETH.address, amounts: [BIG_NUMBER_ZERO], orders, toReserve: true },
                    ]),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });
        it("Should revert if withdraw more than available", async () => { // Done
            const mockERC20Factory = await ethers.getContractFactory("MockERC20");
            const strategy = mockERC20Factory.attach(context.stakeDaoStEthStrategyAddress);

            const strategyBalance = await strategy.balanceOf(context.nestedReserve.address);

            // Orders to withdraw from StakeDAO curve strategy
            let orders: OrderStruct[] = getStakeDaoWithdrawETHOrder(context, context.stakeDaoStEthStrategyAddress, strategyBalance.mul(2));

            // User1 creates the portfolio/NFT
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .processOutputOrders(1, [
                        { outputToken: context.WETH.address, amounts: [strategyBalance], orders, toReserve: true },
                    ]),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });
        it("Should revert if strategy is not added in Operator Storage", async () => { // Done
            // Orders to withdraw from StakeDAO curve strategy
            let orders: OrderStruct[] = getStakeDaoWithdrawETHOrder(context, context.stakeDaoNonWhitelistedStrategy, BigNumber.from(100));

            // User1 creates the portfolio/NFT
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .processOutputOrders(1, [
                        { outputToken: context.WETH.address, amounts: [BIG_NUMBER_ZERO], orders, toReserve: true },
                    ]),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });
        it("Should revert if minAmountOut is not respected", async () => { // Done
            const mockERC20Factory = await ethers.getContractFactory("MockERC20");
            const strategy = mockERC20Factory.attach(context.stakeDaoStEthStrategyAddress);

            const strategyBalance = await strategy.balanceOf(context.nestedReserve.address);

            // Orders to withdraw from StakeDAO strategy and remove liquidity from curve pool
            let orders: OrderStruct[] = getStakeDaoWithdrawETHOrder(context, context.stakeDaoStEthStrategyAddress, strategyBalance, UINT256_MAX);

            // User1 creates the portfolio/NFT
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .processOutputOrders(1, [
                        { outputToken: context.WETH.address, amounts: [strategyBalance], orders, toReserve: true },
                    ]),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });
        it("Destroy/Withdraw from StakeDAO", async () => {
            const mockERC20Factory = await ethers.getContractFactory("MockERC20");
            const strategy = mockERC20Factory.attach(context.stakeDaoStEthStrategyAddress);

            const strategyBalance = await strategy.balanceOf(context.nestedReserve.address);

            // Orders to withdraw from StakeDAO curve strategy
            let orders: OrderStruct[] = getStakeDaoWithdrawETHOrder(context, context.stakeDaoStEthStrategyAddress, strategyBalance);

            await context.nestedFactory.connect(context.user1).destroy(1, context.WETH.address, orders);

            // All StakeDAO strategy token removed from reserve
            expect(await strategy.balanceOf(context.nestedReserve.address)).to.be.equal(BIG_NUMBER_ZERO);
            expect(await strategy.balanceOf(context.nestedFactory.address)).to.be.equal(BIG_NUMBER_ZERO);

            /*
             * WETH received by the FeeSplitter cannot be predicted.
             * It should be greater than 0.01 WETH, but sub 1% to allow a margin of error
             */
            expect(await context.WETH.balanceOf(context.feeSplitter.address)).to.be.gt(
                getExpectedFees(appendDecimals(1)).sub(getExpectedFees(appendDecimals(1)).div(100)),
            );
        });
    });
});
