import { LoadFixtureFunction } from "../types";
import { factoryAndOperatorsForkingBSCFixture, FactoryAndOperatorsForkingBSCFixture, USDCBsc } from "../shared/fixtures";
import { createFixtureLoader, describeOnBscFork, expect, provider } from "../shared/provider";
import { BigNumber, Wallet } from "ethers";
import { appendDecimals, BIG_NUMBER_ZERO, getExpectedFees } from "../helpers";
import * as utils from "../../scripts/utils";
import { ethers } from "hardhat";

let loadFixture: LoadFixtureFunction;

describeOnBscFork("BeefyZapUniswapLPVaultOperator", () => {
    let context: FactoryAndOperatorsForkingBSCFixture;
    const ETH = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

    before("loader", async () => {
        loadFixture = createFixtureLoader(provider.getWallets(), provider);
    });

    beforeEach("create fixture loader", async () => {
        context = await loadFixture(factoryAndOperatorsForkingBSCFixture);
    });

    it("deploys and has an address", async () => {
        expect(context.beefyZapUniswapLPVaultOperator.address).to.be.a.string;
    });

    // BeefyVaultStorage already tested iun BeefyVaultOperator.ts

    describe("deposit()", () => {
        it("Should revert if amount to deposit is zero", async () => {
            // All the amounts for this test
            const bnbToDeposit = appendDecimals(1);
            const feesAmount = getExpectedFees(bnbToDeposit);
            const bnbToDepositAndFees = bnbToDeposit.add(feesAmount);

            // Orders to deposit in beefy with amount 0
            let orders: utils.OrderStruct[] = utils.getBeefyUniswapDepositOrder(
                context,
                context.WBNB.address,
                BIG_NUMBER_ZERO,
                context.beefyUniswapVaultAddress,
            );

            // User1 creates the portfolio/NFT
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .create(0, ETH, feesAmount, [{ inputToken: ETH, amount: bnbToDeposit, orders, fromReserve: false }], {
                        value: bnbToDepositAndFees,
                    }),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });

        it("Should revert if deposit more than available", async () => {
            // All the amounts for this test
            const bnbToDeposit = appendDecimals(1);
            const feesAmount = getExpectedFees(bnbToDeposit);
            const bnbToDepositAndFees = bnbToDeposit.add(feesAmount);

            // Orders to deposit in beefy with "initial amount x 2" (more than msg.value)
            let orders: utils.OrderStruct[] = utils.getBeefyUniswapDepositOrder(
                context,
                context.WBNB.address,
                bnbToDepositAndFees.mul(2),
                context.beefyUniswapVaultAddress,
            );

            // User1 creates the portfolio/NFT
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .create(0, ETH, feesAmount, [{ inputToken: ETH, amount: bnbToDeposit, orders, fromReserve: false }], {
                        value: bnbToDepositAndFees,
                    }),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });

        it("Should revert if sended vault is not registered in BeefyVaultStorage", async () => {
            // All the amounts for this test
            const bnbToDeposit = appendDecimals(1);
            const feesAmount = getExpectedFees(bnbToDeposit);
            const bnbToDepositAndFees = bnbToDeposit.add(feesAmount);

            let orders: utils.OrderStruct[] = utils.getBeefyUniswapDepositOrder(
                context,
                context.WBNB.address,
                bnbToDepositAndFees,
                context.beefyUnregisteredUniswapVaultAddress,
            );

            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .create(0, ETH, feesAmount, [{ inputToken: ETH, amount: bnbToDeposit, orders, fromReserve: false }], {
                        value: bnbToDepositAndFees,
                    }),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });

        it("Should revert if the inputToken is not one of the paired tokens expected by the vault", async () => {
            // All the amounts for this test
            const bnbToDeposit = appendDecimals(1);
            const feesAmount = getExpectedFees(bnbToDeposit);
            const bnbToDepositAndFees = bnbToDeposit.add(feesAmount);

            // Order to deposit WBNB into the Beefy Uniswap BTCB-ETH LP vault operator
            let orders: utils.OrderStruct[] = utils.getBeefyUniswapDepositOrder(
                context,
                context.WBNB.address,
                bnbToDepositAndFees,
                context.beefyUniswapBtcEthLPVaultAddress,
            );

            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .create(0, ETH, feesAmount, [{ inputToken: ETH, amount: bnbToDeposit, orders, fromReserve: false }], {
                        value: bnbToDepositAndFees,
                    }),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });

        it("Should revert if the minVaultAmount is not reached after the deposit", async () => {
            // All the amounts for this test
            const bnbToDeposit = appendDecimals(1);
            const feesAmount = getExpectedFees(bnbToDeposit);
            const bnbToDepositAndFees = bnbToDeposit.add(feesAmount);

            // Order to deposit WBNB into the Beefy Uniswap BTCB-ETH LP vault operator
            let orders: utils.OrderStruct[] = utils.getBeefyUniswapDepositOrder(
                context,
                context.WBNB.address,
                bnbToDepositAndFees,
                context.beefyUniswapVaultAddress,
                ethers.constants.MaxUint256,
            );

            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .create(0, ETH, feesAmount, [{ inputToken: ETH, amount: bnbToDeposit, orders, fromReserve: false }], {
                        value: bnbToDepositAndFees,
                    }),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });

        it("Create/Deposit in Beefy with BNB", async () => {
            // All the amounts for this test
            const bnbToDeposit = appendDecimals(1);
            const feesAmount = getExpectedFees(bnbToDeposit);
            const bnbToDepositAndFees = bnbToDeposit.add(feesAmount);

            const ethBalanceBefore = await context.user1.getBalance();

            // Orders to Deposit in beefy
            let orders: utils.OrderStruct[] = utils.getBeefyUniswapDepositOrder(
                context,
                context.WBNB.address,
                bnbToDeposit,
                context.beefyUniswapVaultAddress,
            );

            // User1 creates the portfolio/NFT
            const tx = await context.nestedFactory
                .connect(context.user1)
                .create(0, ETH, feesAmount, [{ inputToken: ETH, amount: bnbToDeposit, orders, fromReserve: false }], {
                    value: bnbToDepositAndFees,
                });

            // Get the transaction fees
            const txFees = await tx.wait().then(value => value.gasUsed.mul(value.effectiveGasPrice));

            // User1 must be the owner of NFT n°1
            expect(await context.nestedAsset.ownerOf(1)).to.be.equal(context.user1.address);

            const mockERC20Factory = await ethers.getContractFactory("MockERC20");
            const vault = mockERC20Factory.attach(context.beefyUniswapVaultAddress);

            // Moo tokens in vault
            const mooBalanceReserve = await vault.balanceOf(context.nestedReserve.address);
            expect(mooBalanceReserve).to.not.be.equal(BIG_NUMBER_ZERO);

            expect(await context.user1.getBalance()).to.be.equal(ethBalanceBefore.sub(bnbToDepositAndFees).sub(txFees));

            /*
             * I can't predict the WBNB received in the FeeSplitter.
             * It should be greater than 0.01 WBNB, but sub 1% to allow some dust sent back to the user (without fees)
             */
            expect(await context.WBNB.balanceOf(context.feeSplitter.address)).to.be.gt(
                getExpectedFees(bnbToDeposit).sub(getExpectedFees(bnbToDeposit).div(100)),
            );

            const expectedNfts = [
                {
                    id: BigNumber.from(1),
                    assets: [{ token: context.beefyUniswapVaultAddress, qty: mooBalanceReserve }],
                },
            ];

            const nfts = await context.nestedAssetBatcher.getNfts(context.user1.address);

            expect(JSON.stringify(utils.cleanResult(nfts))).to.equal(JSON.stringify(utils.cleanResult(expectedNfts)));
        });

        it("Create with FlatOperator and Deposit in Beefy with BNB", async () => {
            // The user add 10 WBNB to the portfolio
            const WBNBBought = appendDecimals(10);
            const totalToBought = WBNBBought;
            const expectedFee = getExpectedFees(totalToBought);

            // Add 10 WBNB with FlatOperator
            let orders: utils.OrderStruct[] = [
                {
                    operator: context.flatOperatorNameBytes32,
                    token: context.WBNB.address,
                    callData: utils.abiCoder.encode(["address", "uint256"], [context.WBNB.address, totalToBought]),
                },
            ];

            // User1 creates the portfolio/NFT and emit event NftCreated
            await expect(
                context.nestedFactory.connect(context.user1).create(
                    0,
                    USDCBsc,
                    expectedFee,
                    [
                        {
                            inputToken: ETH,
                            amount: totalToBought,
                            orders,
                            fromReserve: false,
                        },
                    ],
                    { value: totalToBought },
                ),
            )
                .to.emit(context.nestedFactory, "NftCreated")
                .withArgs(1, 0);

            // Orders to Deposit in beefy
            orders = [
                utils.buildOrderStruct(context.beefyZapUniswapLPVaultDepositOperatorNameBytes32, context.WBNB.address, [
                    ["address", context.beefyUniswapVaultAddress],
                    ["address", context.WBNB.address],
                    ["uint256", totalToBought],
                    ["uint256", 0], // 100% slippage
                ]),
            ];

            // User1 deposit in beefy via OutputOrder
            await expect(
                context.nestedFactory.connect(context.user1).processOutputOrders(1, USDCBsc, expectedFee, [
                    {
                        outputToken: context.beefyUniswapVaultAddress,
                        amounts: [totalToBought],
                        orders,
                        toReserve: true,
                    },
                ]),
            )
                .to.emit(context.nestedFactory, "NftUpdated")
                .withArgs(1);

            const nfts = await context.nestedAssetBatcher.getNfts(context.user1.address);

            expect(nfts[0].assets.length > 0 && nfts[0].assets.length <= 2).to.be.true; // Moo + dust (not always)

            if (nfts[0].assets.length == 1) {
                expect(nfts[0].assets[0].token).to.be.equal(context.beefyUniswapVaultAddress);
            } else {
                expect(nfts[0].assets[1].token).to.be.equal(context.beefyUniswapVaultAddress);
            }

            // USDCBsc in Fee Splitter
            const mockERC20Factory = await ethers.getContractFactory("MockERC20");
            const USDCBscContract = mockERC20Factory.attach(USDCBsc);

            expect(await USDCBscContract.balanceOf(context.feeSplitter.address)).to.be.equal(expectedFee.mul(2));
        });
    });

    describe("withdraw()", () => {
        beforeEach("Create NFT (id 1) with BNB deposited", async () => {
            const bnbToDeposit = appendDecimals(1);
            const feesAmount = getExpectedFees(bnbToDeposit);
            const bnbToDepositAndFees = bnbToDeposit.add(feesAmount);

            // Orders to deposit to beefy
            let orders: utils.OrderStruct[] = utils.getBeefyUniswapDepositOrder(
                context,
                context.WBNB.address,
                bnbToDeposit,
                context.beefyUniswapVaultAddress,
            );

            // User1 creates the portfolio/NFT
            await context.nestedFactory
                .connect(context.user1)
                .create(0, ETH, feesAmount, [{ inputToken: ETH, amount: bnbToDeposit, orders, fromReserve: false }], {
                    value: bnbToDepositAndFees,
                });
        });

        it("Should revert if amount to withdraw is zero", async () => {
            const mockERC20Factory = await ethers.getContractFactory("MockERC20");
            const vault = mockERC20Factory.attach(context.beefyUniswapVaultAddress);

            const mooBalance = await vault.balanceOf(context.nestedReserve.address);
            const feesAmount = getExpectedFees(mooBalance)

            // Orders to withdraw from beefy
            let orders: utils.OrderStruct[] = utils.getBeefyUniswapWithdrawOrder(
                context,
                context.WBNB.address,
                BIG_NUMBER_ZERO,
                context.beefyUniswapVaultAddress,
            );

            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .processOutputOrders(1, USDCBsc, feesAmount, [
                        { outputToken: context.WBNB.address, amounts: [mooBalance], orders, toReserve: true },
                    ]),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });

        it("Should revert if the outputToken is not one of the paired tokens expected by the vault", async () => {
            const mockERC20Factory = await ethers.getContractFactory("MockERC20");
            const vault = mockERC20Factory.attach(context.beefyUniswapVaultAddress);

            const mooBalance = await vault.balanceOf(context.nestedReserve.address);
            const feesAmount = getExpectedFees(mooBalance)

            // Orders to withdraw from beefy
            let orders: utils.OrderStruct[] = utils.getBeefyUniswapWithdrawOrder(
                context,
                context.beefyUnregisteredUniswapVaultAddress, // Not one of the paired token expected by the vault
                mooBalance,
                context.beefyUniswapVaultAddress,
            );

            await expect(
                context.nestedFactory.connect(context.user1).processOutputOrders(1, USDCBsc, feesAmount, [
                    {
                        outputToken: context.beefyUnregisteredUniswapVaultAddress,
                        amounts: [mooBalance],
                        orders,
                        toReserve: true,
                    },
                ]),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });

        it("Should revert if sended vault is not registered in BeefyVaultStorage", async () => {
            // Orders to withdraw from beefy
            let orders: utils.OrderStruct[] = utils.getBeefyUniswapWithdrawOrder(
                context,
                context.WBNB.address,
                BIG_NUMBER_ZERO.add(1),
                context.beefyUnregisteredUniswapVaultAddress,
            );
            
            const feesAmount = 10
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .processOutputOrders(1, USDCBsc, feesAmount, [
                        { outputToken: context.WBNB.address, amounts: [BIG_NUMBER_ZERO], orders, toReserve: true },
                    ]),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });

        it("Should revert if the amount to withdraw is greater than the maximum amount that can be withdrawn", async () => {
            const mockERC20Factory = await ethers.getContractFactory("MockERC20");
            const vault = mockERC20Factory.attach(context.beefyUniswapVaultAddress);

            const mooBalance = await vault.balanceOf(context.nestedReserve.address);
            const feesAmount = getExpectedFees(mooBalance)
            // Orders to withdraw from beefy
            let orders: utils.OrderStruct[] = utils.getBeefyUniswapWithdrawOrder(
                context,
                context.WBNB.address,
                mooBalance.add(1),
                context.beefyUniswapVaultAddress,
            );

            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .processOutputOrders(1, USDCBsc, feesAmount, [
                        { outputToken: context.WBNB.address, amounts: [mooBalance], orders, toReserve: true },
                    ]),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });

        it("Should revert if the minTokenAmount to withdraw is not reached", async () => {
            const mockERC20Factory = await ethers.getContractFactory("MockERC20");
            const vault = mockERC20Factory.attach(context.beefyUniswapVaultAddress);

            const mooBalance = await vault.balanceOf(context.nestedReserve.address);
            const feesAmount = getExpectedFees(mooBalance)

            // Orders to withdraw from beefy
            let orders: utils.OrderStruct[] = utils.getBeefyUniswapWithdrawOrder(
                context,
                context.WBNB.address,
                mooBalance,
                context.beefyUniswapVaultAddress,
                ethers.constants.MaxUint256,
            );

            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .processOutputOrders(1, USDCBsc, feesAmount, [
                        { outputToken: context.WBNB.address, amounts: [mooBalance], orders, toReserve: true },
                    ]),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });

        it("Destroy/Withdraw from Beefy", async () => {
            const mockERC20Factory = await ethers.getContractFactory("MockERC20");
            const vault = mockERC20Factory.attach(context.beefyUniswapVaultAddress);

            const mockERC20FactoryUSDC = await ethers.getContractFactory("MockERC20");
            const USDCBscContract = mockERC20FactoryUSDC.attach(USDCBsc);

            // Moo balance of the nested reserve before the withdraw
            const mooBalance: BigNumber = await vault.balanceOf(context.nestedReserve.address);
            const feesAmount = getExpectedFees(mooBalance)

            // Orders to withdraw from beefy
            let orders: utils.OrderStruct[] = utils.getBeefyUniswapWithdrawOrder(
                context,
                context.WBNB.address,
                mooBalance,
                context.beefyUniswapVaultAddress,
            );

            await context.nestedFactory.connect(context.user1).destroy(1, USDCBsc, feesAmount, context.WBNB.address, orders);

            // All moo removed from reserve
            expect(await vault.balanceOf(context.nestedReserve.address)).to.be.equal(BIG_NUMBER_ZERO);
            expect(await vault.balanceOf(context.nestedFactory.address)).to.be.equal(BIG_NUMBER_ZERO);
            
            // Fees in USDC
            expect(await USDCBscContract.balanceOf(context.feeSplitter.address)).to.be.equal(feesAmount);
        });
    });
});
