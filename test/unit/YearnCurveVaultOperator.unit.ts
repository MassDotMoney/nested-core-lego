import { LoadFixtureFunction } from "../types";
import { EURTEth, FactoryAndOperatorsForkingETHFixture, factoryAndOperatorsForkingETHFixture, USDCEth } from "../shared/fixtures";
import { createFixtureLoader, describeOnEthFork, expect, provider } from "../shared/provider";
import { BigNumber, Wallet } from "ethers";
import { append6Decimals, appendDecimals, BIG_NUMBER_ZERO, getExpectedFees, UINT256_MAX } from "../helpers";
import * as utils from "../../scripts/utils";
import { ethers } from "hardhat";

let loadFixture: LoadFixtureFunction;

describeOnEthFork("YearnCurveVaultOperator", () => {
    let context: FactoryAndOperatorsForkingETHFixture;
    const ETH = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

    before("loader", async () => {
        loadFixture = createFixtureLoader(provider.getWallets(), provider);
    });

    beforeEach("create fixture loader", async () => {
        context = await loadFixture(factoryAndOperatorsForkingETHFixture);
    });

    it("deploys and has an address", async () => {
        expect(context.yearnCurveVaultOperator.address).to.be.a.string;
    });

    describe("addVault()", () => {
        it("Should revert if vault is address zero", async () => {
            const vaultToAdd = ethers.constants.AddressZero;
            const poolToAdd = Wallet.createRandom().address;
            await expect(
                context.yearnVaultStorage.connect(context.masterDeployer).addVault(vaultToAdd, {
                    poolAddress: poolToAdd,
                    poolCoinAmount: 1,
                    lpToken: poolToAdd
                }),
            ).to.be.revertedWith("YVS: INVALID_VAULT_ADDRESS");
        });

        it("Should revert if already existent vault", async () => {
            const vaultToAdd = Wallet.createRandom().address;
            const poolToAdd = Wallet.createRandom().address;
            await context.yearnVaultStorage.connect(context.masterDeployer).addVault(vaultToAdd, {
                poolAddress: poolToAdd,
                poolCoinAmount: 1,
                lpToken: poolToAdd
            });

            await expect(
                context.yearnVaultStorage.connect(context.masterDeployer).addVault(vaultToAdd, {
                    poolAddress: poolToAdd,
                    poolCoinAmount: 1,
                    lpToken: poolToAdd
                }),
            ).to.be.revertedWith("YVS: VAULT_ALREADY_HAS_POOL");
        });

        it("Should add new vault", async () => {
            const vaultToAdd = Wallet.createRandom().address;
            const poolToAdd = Wallet.createRandom().address;
            const poolCoinAmount = 1;
            await context.yearnVaultStorage.connect(context.masterDeployer).addVault(vaultToAdd, {
                poolAddress: poolToAdd,
                poolCoinAmount,
                lpToken: poolToAdd
            });

            expect(await (await context.yearnVaultStorage.vaults(vaultToAdd)).poolAddress).to.equal(poolToAdd);
            expect(await (await context.yearnVaultStorage.vaults(vaultToAdd)).poolCoinAmount).to.equal(poolCoinAmount);

        });
    });

    describe("removeVault()", () => {
        it("Should revert if non-existent vault", async () => {
            const vaultToRemove = Wallet.createRandom().address;

            await expect(
                context.yearnVaultStorage.connect(context.masterDeployer).removeVault(vaultToRemove),
            ).to.be.revertedWith("YVS: NON_EXISTENT_VAULT");
        });

        it("Should remove vault", async () => {
            const vaultToAdd = Wallet.createRandom().address;
            const poolToAdd = Wallet.createRandom().address;
            await context.yearnVaultStorage.connect(context.masterDeployer).addVault(vaultToAdd, {
                poolAddress: poolToAdd,
                poolCoinAmount: 1,
                lpToken: poolToAdd
            });

            await context.yearnVaultStorage.connect(context.masterDeployer).removeVault(vaultToAdd);

            expect(await (await context.yearnVaultStorage.vaults(vaultToAdd)).poolAddress).to.equal(ethers.constants.AddressZero);
        });
    });

    describe("deposit()", () => {
        it("Should revert if amount to deposit is zero", async () => {
            // All the amounts for this test
            const ethToDeposit = appendDecimals(1);
            const ethToDepositAndFees = ethToDeposit.add(getExpectedFees(ethToDeposit));

            // Orders to deposit in yearn with amount 0
            let orders: utils.OrderStruct[] = utils.getYearnCurveDepositOrder(context, context.yearnVaultAddresses.triCryptoVault, context.WETH.address, BIG_NUMBER_ZERO);

            // User1 creates the portfolio/NFT
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .create(0, [{ inputToken: ETH, amount: ethToDepositAndFees, orders, fromReserve: false }], {
                        value: ethToDepositAndFees,
                    }),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });

        it("Should revert if deposit more than available", async () => {
            // All the amounts for this test
            const ethToDeposit = appendDecimals(1);
            const ethToDepositAndFees = ethToDeposit.add(getExpectedFees(ethToDeposit));

            // Orders to deposit in yearn with "initial amount x 2" (more than msg.value)
            let orders: utils.OrderStruct[] = utils.getYearnCurveDepositOrder(context, context.yearnVaultAddresses.triCryptoVault, context.WETH.address, ethToDepositAndFees.mul(2));

            // User1 creates the portfolio/NFT
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .create(0, [{ inputToken: ETH, amount: ethToDepositAndFees, orders, fromReserve: false }], {
                        value: ethToDepositAndFees,
                    }),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });

        it("Should revert if vault is not added in Operator Storage", async () => {
            // All the amounts for this test
            const ethToDeposit = appendDecimals(1);
            const ethToDepositAndFees = ethToDeposit.add(getExpectedFees(ethToDeposit));

            const notWhitelistedVault = Wallet.createRandom().address;

            // Orders to Deposit in yearn
            let orders: utils.OrderStruct[] = utils.getYearnCurveDepositOrder(context, notWhitelistedVault, context.WETH.address, ethToDeposit);

            // User1 creates the portfolio/NFT
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .create(0, [{ inputToken: ETH, amount: ethToDepositAndFees, orders, fromReserve: false }], {
                        value: ethToDepositAndFees,
                    }),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });

        it("Should revert if token is not in Curve pool", async () => {
            // All the amounts for this test
            const ethToDeposit = appendDecimals(1);
            const ethToDepositAndFees = ethToDeposit.add(getExpectedFees(ethToDeposit));

            // Orders to Deposit in yearn
            let orders: utils.OrderStruct[] = utils.getYearnCurveDepositOrder(context, context.yearnVaultAddresses.triCryptoVault, USDCEth, ethToDeposit);

            // User1 creates the portfolio/NFT
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .create(0, [{ inputToken: ETH, amount: ethToDepositAndFees, orders, fromReserve: false }], {
                        value: ethToDepositAndFees,
                    }),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });

        it("Should revert if minVaultAmount is not respected", async () => {
            // All the amounts for this test
            const ethToDeposit = appendDecimals(1);
            const ethToDepositAndFees = ethToDeposit.add(getExpectedFees(ethToDeposit));

            // Orders to Deposit in yearn
            let orders: utils.OrderStruct[] = utils.getYearnCurveDepositOrder(context, context.yearnVaultAddresses.triCryptoVault, context.WETH.address, ethToDeposit, UINT256_MAX);

            // User1 creates the portfolio/NFT
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .create(0, [{ inputToken: ETH, amount: ethToDepositAndFees, orders, fromReserve: false }], {
                        value: ethToDepositAndFees,
                    }),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });

        it("Create with ETH and Deposit in yearn 3crypto with WETH", async () => {
            // All the amounts for this test
            const ethToDeposit = appendDecimals(1);
            const ethToDepositAndFees = ethToDeposit.add(getExpectedFees(ethToDeposit));

            const ethBalanceBefore = await context.user1.getBalance();

            // Orders to Deposit in yearn
            let orders: utils.OrderStruct[] = utils.getYearnCurveDepositOrder(context, context.yearnVaultAddresses.triCryptoVault, context.WETH.address, ethToDeposit);

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
            const vault = mockERC20Factory.attach(context.yearnVaultAddresses.triCryptoVault);

            //  Tokens in vault
            const vaultBalanceReserve = await vault.balanceOf(context.nestedReserve.address);
            expect(vaultBalanceReserve).to.not.be.equal(BIG_NUMBER_ZERO);

            expect(await context.user1.getBalance()).to.be.equal(ethBalanceBefore.sub(ethToDepositAndFees).sub(txFees));

            // The FeeSplitter must receive the right fee amount
            expect(await context.WETH.balanceOf(context.feeSplitter.address)).to.be.equal(
                getExpectedFees(ethToDeposit),
            );

            const expectedNfts = [
                {
                    id: BigNumber.from(1),
                    assets: [{ token: context.yearnVaultAddresses.triCryptoVault, qty: vaultBalanceReserve }],
                },
            ];

            const nfts = await context.nestedAssetBatcher.getNfts(context.user1.address);

            expect(JSON.stringify(utils.cleanResult(nfts))).to.equal(JSON.stringify(utils.cleanResult(expectedNfts)));
        });
    });

    describe("depositETH()", async () => {
        it("Should revert if amount to deposit is zero", async () => {
            // All the amounts for this test
            const ethToDeposit = appendDecimals(1);
            const ethToDepositAndFees = ethToDeposit.add(getExpectedFees(ethToDeposit));

            // Orders to deposit in yearn with amount 0
            let orders: utils.OrderStruct[] = utils.getYearnCurveDepositETHOrder(context, context.yearnVaultAddresses.alEthVault, BIG_NUMBER_ZERO);

            // User1 creates the portfolio/NFT
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .create(0, [{ inputToken: ETH, amount: ethToDepositAndFees, orders, fromReserve: false }], {
                        value: ethToDepositAndFees,
                    }),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });
        it("Should revert if deposit more than available", async () => {
            // All the amounts for this test
            const ethToDeposit = appendDecimals(1);
            const ethToDepositAndFees = ethToDeposit.add(getExpectedFees(ethToDeposit));

            // Orders to deposit in yearn with "initial amount x 2" (more than msg.value)
            let orders: utils.OrderStruct[] = utils.getYearnCurveDepositETHOrder(context, context.yearnVaultAddresses.alEthVault, ethToDepositAndFees.mul(2));

            // User1 creates the portfolio/NFT
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .create(0, [{ inputToken: ETH, amount: ethToDepositAndFees, orders, fromReserve: false }], {
                        value: ethToDepositAndFees,
                    }),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });
        it("Should revert if vault is not added in Operator Storage", async () => {
            // All the amounts for this test
            const ethToDeposit = appendDecimals(1);
            const ethToDepositAndFees = ethToDeposit.add(getExpectedFees(ethToDeposit));

            const notWhitelistedVault = Wallet.createRandom().address;

            // Orders to Deposit in yearn
            let orders: utils.OrderStruct[] = utils.getYearnCurveDepositETHOrder(context, notWhitelistedVault, ethToDeposit);

            // User1 creates the portfolio/NFT
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .create(0, [{ inputToken: ETH, amount: ethToDepositAndFees, orders, fromReserve: false }], {
                        value: ethToDepositAndFees,
                    }),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });
        it("Should revert if minVaultAmount is not respected", async () => {
            // All the amounts for this test
            const ethToDeposit = appendDecimals(1);
            const ethToDepositAndFees = ethToDeposit.add(getExpectedFees(ethToDeposit));

            // Orders to Deposit in yearn
            let orders: utils.OrderStruct[] = utils.getYearnCurveDepositETHOrder(context, context.yearnVaultAddresses.alEthVault, ethToDeposit, UINT256_MAX);

            // User1 creates the portfolio/NFT
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .create(0, [{ inputToken: ETH, amount: ethToDepositAndFees, orders, fromReserve: false }], {
                        value: ethToDepositAndFees,
                    }),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });
        it("Create/Deposit in yearn alETH with ETH", async () => {
            // All the amounts for this test
            const ethToDeposit = appendDecimals(1);
            const ethToDepositAndFees = ethToDeposit.add(getExpectedFees(ethToDeposit));

            const ethBalanceBefore = await context.user1.getBalance();

            // Orders to Deposit in yearn
            let orders: utils.OrderStruct[] = utils.getYearnCurveDepositETHOrder(context, context.yearnVaultAddresses.alEthVault, ethToDeposit);

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
            const vault = mockERC20Factory.attach(context.yearnVaultAddresses.alEthVault);

            //  Tokens in vault
            const vaultBalanceReserve = await vault.balanceOf(context.nestedReserve.address);
            expect(vaultBalanceReserve).to.not.be.equal(BIG_NUMBER_ZERO);

            expect(await context.user1.getBalance()).to.be.equal(ethBalanceBefore.sub(ethToDepositAndFees).sub(txFees));

            // The FeeSplitter must receive the right fee amount
            expect(await context.WETH.balanceOf(context.feeSplitter.address)).to.be.equal(
                getExpectedFees(ethToDeposit),
            );

            const expectedNfts = [
                {
                    id: BigNumber.from(1),
                    assets: [{ token: context.yearnVaultAddresses.alEthVault, qty: vaultBalanceReserve }],
                },
            ];

            const nfts = await context.nestedAssetBatcher.getNfts(context.user1.address);

            expect(JSON.stringify(utils.cleanResult(nfts))).to.equal(JSON.stringify(utils.cleanResult(expectedNfts)));
        });
    })

    describe("withdraw256()", () => {
        beforeEach("Create NFT (id 1) with ETH deposited", async () => {
            // All the amounts for this test
            const ethToDeposit = appendDecimals(1);
            const ethToDepositAndFees = ethToDeposit.add(getExpectedFees(ethToDeposit));

            // Orders to Deposit in yearn
            let orders: utils.OrderStruct[] = utils.getYearnCurveDepositOrder(context, context.yearnVaultAddresses.triCryptoVault, context.WETH.address, ethToDeposit);

            // User1 creates the portfolio/NFT
            const tx = await context.nestedFactory
                .connect(context.user1)
                .create(0, [{ inputToken: ETH, amount: ethToDepositAndFees, orders, fromReserve: false }], {
                    value: ethToDepositAndFees,
                });

        });
        it("Should revert if amount to withdraw is zero", async () => {
            const mockERC20Factory = await ethers.getContractFactory("MockERC20");
            const vault = mockERC20Factory.attach(context.yearnVaultAddresses.triCryptoVault);

            const vaultBalance = await vault.balanceOf(context.nestedReserve.address);

            // Orders to withdraw from yearn curve vault
            let orders: utils.OrderStruct[] = utils.getYearnCurveWithdraw256Order(context, context.yearnVaultAddresses.triCryptoVault, BIG_NUMBER_ZERO, context.WETH.address);

            // User1 creates the portfolio/NFT
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .processOutputOrders(1, [
                        { outputToken: context.WETH.address, amounts: [vaultBalance], orders, toReserve: true },
                    ]),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });
        it("Should revert if withdraw more than available", async () => {
            const mockERC20Factory = await ethers.getContractFactory("MockERC20");
            const vault = mockERC20Factory.attach(context.yearnVaultAddresses.triCryptoVault);

            const vaultBalance = await vault.balanceOf(context.nestedReserve.address);

            // Orders to withdraw from yearn curve vault
            let orders: utils.OrderStruct[] = utils.getYearnCurveWithdraw256Order(context, context.yearnVaultAddresses.triCryptoVault, vaultBalance.mul(2), context.WETH.address);

            // User1 creates the portfolio/NFT
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .processOutputOrders(1, [
                        { outputToken: context.WETH.address, amounts: [vaultBalance], orders, toReserve: true },
                    ]),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });
        it("Should revert if vault is not added in Operator Storage", async () => {
            // Orders to withdraw from yearn curve vault
            let orders: utils.OrderStruct[] = utils.getYearnCurveWithdraw256Order(context, context.yearnVaultAddresses.nonWhitelistedVault, BigNumber.from(100), context.WETH.address);

            // User1 creates the portfolio/NFT
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .processOutputOrders(1, [
                        { outputToken: context.WETH.address, amounts: [BIG_NUMBER_ZERO], orders, toReserve: true },
                    ]),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });
        it("Should revert if token is not in Curve pool", async () => {
            const mockERC20Factory = await ethers.getContractFactory("MockERC20");
            const vault = mockERC20Factory.attach(context.yearnVaultAddresses.triCryptoVault);

            const vaultBalance = await vault.balanceOf(context.nestedReserve.address);

            // Orders to withdraw from yearn vault and remove liquidity from curve pool
            let orders: utils.OrderStruct[] = utils.getYearnCurveWithdraw256Order(context, context.yearnVaultAddresses.triCryptoVault, vaultBalance, USDCEth); // if you pass a no ERC20 address it will return a random fail

            // User1 creates the portfolio/NFT
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .processOutputOrders(1, [
                        { outputToken: context.WETH.address, amounts: [vaultBalance], orders, toReserve: true },
                    ]),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });
        it("Should revert if minAmountOut is not respected", async () => {
            const mockERC20Factory = await ethers.getContractFactory("MockERC20");
            const vault = mockERC20Factory.attach(context.yearnVaultAddresses.triCryptoVault);

            const vaultBalance = await vault.balanceOf(context.nestedReserve.address);

            // Orders to withdraw from yearn vault and remove liquidity from curve pool
            let orders: utils.OrderStruct[] = utils.getYearnCurveWithdraw256Order(context, context.yearnVaultAddresses.triCryptoVault, vaultBalance, context.WETH.address, UINT256_MAX);

            // User1 creates the portfolio/NFT
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .processOutputOrders(1, [
                        { outputToken: context.WETH.address, amounts: [vaultBalance], orders, toReserve: true },
                    ]),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });
        it("Destroy/Withdraw from Yearn", async () => {
            const mockERC20Factory = await ethers.getContractFactory("MockERC20");
            const vault = mockERC20Factory.attach(context.yearnVaultAddresses.triCryptoVault);

            const vaultBalance = await vault.balanceOf(context.nestedReserve.address);

            // Orders to withdraw from yearn curve vault
            let orders: utils.OrderStruct[] = utils.getYearnCurveWithdraw256Order(context, context.yearnVaultAddresses.triCryptoVault, vaultBalance, context.WETH.address);

            await context.nestedFactory.connect(context.user1).destroy(1, context.WETH.address, orders);

            // All yearn vault token removed from reserve
            expect(await vault.balanceOf(context.nestedReserve.address)).to.be.equal(BIG_NUMBER_ZERO);
            expect(await vault.balanceOf(context.nestedFactory.address)).to.be.equal(BIG_NUMBER_ZERO);

            /*
             * WETH received by the FeeSplitter cannot be predicted.
             * It should be greater than 0.01 WETH, but sub 1% to allow a margin of error
             */
            expect(await context.WETH.balanceOf(context.feeSplitter.address)).to.be.gt(
                getExpectedFees(appendDecimals(1)).sub(getExpectedFees(appendDecimals(1)).div(100)),
            );
        });
    });

    describe("withdraw128()", () => {
        beforeEach("Create NFT (id 1) with eurt deposited", async () => {
            // All the amounts for this test
            const eurtToDeposit = append6Decimals(1000);
            const eurtToDepositAndFees = eurtToDeposit.add(getExpectedFees(eurtToDeposit));

            // Orders to Deposit in yearn
            let orders: utils.OrderStruct[] = utils.getYearnCurveDepositOrder(context, context.yearnVaultAddresses.threeEurVault, EURTEth, eurtToDeposit);

            // User1 creates the portfolio/NFT
            await context.nestedFactory
                .connect(context.user1)
                .create(0, [{ inputToken: EURTEth, amount: eurtToDepositAndFees, orders, fromReserve: false }], {
                    value: 0,
                });
        });
        it("Should revert if amount to withdraw is zero", async () => {
            const mockERC20Factory = await ethers.getContractFactory("MockERC20");
            const vault = mockERC20Factory.attach(context.yearnVaultAddresses.threeEurVault);

            const vaultBalance = await vault.balanceOf(context.nestedReserve.address);

            // Orders to withdraw from yearn vault and remove liquidity from curve pool
            let orders: utils.OrderStruct[] = utils.getYearnCurveWithdraw128Order(context, context.yearnVaultAddresses.threeEurVault, BIG_NUMBER_ZERO, EURTEth);

            // User1 creates the portfolio/NFT
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .processOutputOrders(1, [
                        { outputToken: EURTEth, amounts: [vaultBalance], orders, toReserve: true },
                    ]),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });
        it("Should revert if withdraw more than available", async () => {
            const mockERC20Factory = await ethers.getContractFactory("MockERC20");
            const vault = mockERC20Factory.attach(context.yearnVaultAddresses.threeEurVault);

            const vaultBalance = await vault.balanceOf(context.nestedReserve.address);

            // Orders to withdraw from yearn vault and remove liquidity from curve pool
            let orders: utils.OrderStruct[] = utils.getYearnCurveWithdraw128Order(context, context.yearnVaultAddresses.threeEurVault, vaultBalance.mul(2), EURTEth);

            // User1 creates the portfolio/NFT
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .processOutputOrders(1, [
                        { outputToken: EURTEth, amounts: [vaultBalance], orders, toReserve: true },
                    ]),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });
        it("Should revert if vault is not added in Operator Storage", async () => {
            // Orders to withdraw from yearn curve vault
            let orders: utils.OrderStruct[] = utils.getYearnCurveWithdraw128Order(context, context.yearnVaultAddresses.nonWhitelistedVault, BigNumber.from(100), EURTEth);

            // User1 creates the portfolio/NFT
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .processOutputOrders(1, [
                        { outputToken: EURTEth, amounts: [BIG_NUMBER_ZERO], orders, toReserve: true },
                    ]),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });
        it("Should revert if token is not in Curve pool", async () => {
            const mockERC20Factory = await ethers.getContractFactory("MockERC20");
            const vault = mockERC20Factory.attach(context.yearnVaultAddresses.threeEurVault);

            const vaultBalance = await vault.balanceOf(context.nestedReserve.address);

            // Orders to withdraw from yearn vault and remove liquidity from curve pool
            let orders: utils.OrderStruct[] = utils.getYearnCurveWithdraw128Order(context, context.yearnVaultAddresses.threeEurVault, vaultBalance, USDCEth);// if you pass a no ERC20 address it will return a random fail

            // User1 creates the portfolio/NFT
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .processOutputOrders(1, [
                        { outputToken: EURTEth, amounts: [vaultBalance], orders, toReserve: true },
                    ]),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });
        it("Should revert if minAmountOut is not respected", async () => {
            const mockERC20Factory = await ethers.getContractFactory("MockERC20");
            const vault = mockERC20Factory.attach(context.yearnVaultAddresses.threeEurVault);

            const vaultBalance = await vault.balanceOf(context.nestedReserve.address);

            // Orders to withdraw from yearn vault and remove liquidity from curve pool
            let orders: utils.OrderStruct[] = utils.getYearnCurveWithdraw128Order(context, context.yearnVaultAddresses.threeEurVault, vaultBalance, context.WETH.address, UINT256_MAX);

            // User1 creates the portfolio/NFT
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .processOutputOrders(1, [
                        { outputToken: EURTEth, amounts: [vaultBalance], orders, toReserve: true },
                    ]),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });
        it("Destroy/Withdraw with EURT from Yearn", async () => {
            const mockERC20Factory = await ethers.getContractFactory("MockERC20");
            const vault = mockERC20Factory.attach(context.yearnVaultAddresses.threeEurVault);

            const eurt = mockERC20Factory.attach(EURTEth);

            const vaultBalance = await vault.balanceOf(context.nestedReserve.address);

            // Orders to withdraw from yearn curve vault
            let orders: utils.OrderStruct[] = utils.getYearnCurveWithdraw128Order(context, context.yearnVaultAddresses.threeEurVault, vaultBalance, EURTEth);

            await context.nestedFactory.connect(context.user1).destroy(1, EURTEth, orders);

            // All yearn vault token removed from reserve
            expect(await vault.balanceOf(context.nestedReserve.address)).to.be.equal(BIG_NUMBER_ZERO);
            expect(await vault.balanceOf(context.nestedFactory.address)).to.be.equal(BIG_NUMBER_ZERO);

            /*
             * WETH received by the FeeSplitter cannot be predicted.
             * It should be greater than 0.01 WETH, but sub 1% to allow a margin of error
             */
            expect(await eurt.balanceOf(context.feeSplitter.address)).to.be.gt(
                getExpectedFees(append6Decimals(1)).sub(getExpectedFees(append6Decimals(1)).div(100)),
            );

            expect(await (await eurt.balanceOf(context.user1.address))).to.be.gt(BIG_NUMBER_ZERO);
        });
    });

    describe("withdrawETH()", () => {
        beforeEach("Create NFT (id 1) with ETH deposited", async () => {
            // All the amounts for this test
            const ethToDeposit = appendDecimals(1);
            const ethToDepositAndFees = ethToDeposit.add(getExpectedFees(ethToDeposit));

            // Orders to Deposit in yearn
            let orders: utils.OrderStruct[] = utils.getYearnCurveDepositETHOrder(context, context.yearnVaultAddresses.alEthVault, ethToDeposit);

            // User1 creates the portfolio/NFT
            const tx = await context.nestedFactory
                .connect(context.user1)
                .create(0, [{ inputToken: ETH, amount: ethToDepositAndFees, orders, fromReserve: false }], {
                    value: ethToDepositAndFees,
                });
        });
        it("Should revert if amount to withdraw is zero", async () => {
            // Orders to withdraw from yearn curve vault
            let orders: utils.OrderStruct[] = utils.getYearnCurveWithdrawETHOrder(context, context.yearnVaultAddresses.alEthVault, BIG_NUMBER_ZERO);

            // User1 creates the portfolio/NFT
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .processOutputOrders(1, [
                        { outputToken: context.WETH.address, amounts: [BIG_NUMBER_ZERO], orders, toReserve: true },
                    ]),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });
        it("Should revert if withdraw more than available", async () => {
            const mockERC20Factory = await ethers.getContractFactory("MockERC20");
            const vault = mockERC20Factory.attach(context.yearnVaultAddresses.alEthVault);

            const vaultBalance = await vault.balanceOf(context.nestedReserve.address);

            // Orders to withdraw from yearn curve vault
            let orders: utils.OrderStruct[] = utils.getYearnCurveWithdrawETHOrder(context, context.yearnVaultAddresses.alEthVault, vaultBalance.mul(2));

            // User1 creates the portfolio/NFT
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .processOutputOrders(1, [
                        { outputToken: context.WETH.address, amounts: [vaultBalance], orders, toReserve: true },
                    ]),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });
        it("Should revert if vault is not added in Operator Storage", async () => {
            // Orders to withdraw from yearn curve vault
            let orders: utils.OrderStruct[] = utils.getYearnCurveWithdrawETHOrder(context, context.yearnVaultAddresses.nonWhitelistedVault, BigNumber.from(100));

            // User1 creates the portfolio/NFT
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .processOutputOrders(1, [
                        { outputToken: context.WETH.address, amounts: [BIG_NUMBER_ZERO], orders, toReserve: true },
                    ]),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });
        it("Should revert if minAmountOut is not respected", async () => {
            const mockERC20Factory = await ethers.getContractFactory("MockERC20");
            const vault = mockERC20Factory.attach(context.yearnVaultAddresses.alEthVault);

            const vaultBalance = await vault.balanceOf(context.nestedReserve.address);

            // Orders to withdraw from yearn vault and remove liquidity from curve pool
            let orders: utils.OrderStruct[] = utils.getYearnCurveWithdrawETHOrder(context, context.yearnVaultAddresses.alEthVault, vaultBalance, UINT256_MAX);

            // User1 creates the portfolio/NFT
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .processOutputOrders(1, [
                        { outputToken: context.WETH.address, amounts: [vaultBalance], orders, toReserve: true },
                    ]),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });
        it("Destroy/Withdraw from Yearn", async () => {
            const mockERC20Factory = await ethers.getContractFactory("MockERC20");
            const vault = mockERC20Factory.attach(context.yearnVaultAddresses.alEthVault);

            const vaultBalance = await vault.balanceOf(context.nestedReserve.address);

            // Orders to withdraw from yearn curve vault
            let orders: utils.OrderStruct[] = utils.getYearnCurveWithdrawETHOrder(context, context.yearnVaultAddresses.alEthVault, vaultBalance);

            await context.nestedFactory.connect(context.user1).destroy(1, context.WETH.address, orders);

            // All yearn vault token removed from reserve
            expect(await vault.balanceOf(context.nestedReserve.address)).to.be.equal(BIG_NUMBER_ZERO);
            expect(await vault.balanceOf(context.nestedFactory.address)).to.be.equal(BIG_NUMBER_ZERO);

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