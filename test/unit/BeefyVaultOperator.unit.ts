import { LoadFixtureFunction } from "../types";
import { factoryAndOperatorsForkingBSCFixture, FactoryAndOperatorsForkingBSCFixture } from "../shared/fixtures";
import { createFixtureLoader, describeOnBscFork, expect, provider } from "../shared/provider";
import { BigNumber, Wallet } from "ethers";
import { appendDecimals, BIG_NUMBER_ZERO, getExpectedFees } from "../helpers";
import * as utils from "../../scripts/utils";
import { ethers } from "hardhat";

let loadFixture: LoadFixtureFunction;

describeOnBscFork("BeefyVaultOperator", () => {
    let context: FactoryAndOperatorsForkingBSCFixture;
    const ETH = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

    before("loader", async () => {
        loadFixture = createFixtureLoader(provider.getWallets(), provider);
    });

    beforeEach("create fixture loader", async () => {
        context = await loadFixture(factoryAndOperatorsForkingBSCFixture);
    });

    it("deploys and has an address", async () => {
        expect(context.beefyVaultOperator.address).to.be.a.string;
    });

    describe("addVault()", () => {
        it("Should revert if vault is address zero", async () => {
            const vaultToAdd = ethers.constants.AddressZero;
            const tokenToAdd = Wallet.createRandom().address;
            await expect(
                context.beefyVaultStorage.connect(context.masterDeployer).addVault(vaultToAdd, tokenToAdd),
            ).to.be.revertedWith("BVS: INVALID_VAULT_ADDRESS");
        });

        it("Should revert if token is address zero", async () => {
            const vaultToAdd = Wallet.createRandom().address;
            const tokenToAdd = ethers.constants.AddressZero;
            await expect(
                context.beefyVaultStorage.connect(context.masterDeployer).addVault(vaultToAdd, tokenToAdd),
            ).to.be.revertedWith("BVS: INVALID_UNDERLYING_ADDRESS");
        });

        it("Should revert if already existent vault", async () => {
            const vaultToAdd = Wallet.createRandom().address;
            const tokenToAdd = Wallet.createRandom().address;
            await context.beefyVaultStorage.connect(context.masterDeployer).addVault(vaultToAdd, tokenToAdd);

            await expect(
                context.beefyVaultStorage.connect(context.masterDeployer).addVault(vaultToAdd, tokenToAdd),
            ).to.be.revertedWith("BVS: ALREADY_EXISTENT_VAULT");
        });

        it("Should add new vault", async () => {
            const vaultToAdd = Wallet.createRandom().address;
            const tokenToAdd = Wallet.createRandom().address;
            await context.beefyVaultStorage.connect(context.masterDeployer).addVault(vaultToAdd, tokenToAdd);

            expect(await context.beefyVaultStorage.vaults(vaultToAdd)).to.equal(tokenToAdd);
        });
    });

    describe("removeVault()", () => {
        it("Should revert if non-existent vault", async () => {
            const vaultToRemove = Wallet.createRandom().address;

            await expect(
                context.beefyVaultStorage.connect(context.masterDeployer).removeVault(vaultToRemove),
            ).to.be.revertedWith("BVS: NON_EXISTENT_VAULT");
        });

        it("Should remove vault", async () => {
            const vaultToAdd = Wallet.createRandom().address;
            const tokenToAdd = Wallet.createRandom().address;
            await context.beefyVaultStorage.connect(context.masterDeployer).addVault(vaultToAdd, tokenToAdd);

            await context.beefyVaultStorage.connect(context.masterDeployer).removeVault(vaultToAdd);

            expect(await context.beefyVaultStorage.vaults(vaultToAdd)).to.equal(ethers.constants.AddressZero);
        });
    });

    describe("deposit()", () => {
        it("Should revert if amount to deposit is zero", async () => {
            // All the amounts for this test
            const bnbToDeposit = appendDecimals(1);
            const bnbToDepositAndFees = bnbToDeposit.add(getExpectedFees(bnbToDeposit));

            // Orders to deposit in beefy with amount 0
            let orders: utils.OrderStruct[] = utils.getBeefyBnbVenusDepositOrder(context, BIG_NUMBER_ZERO);

            // User1 creates the portfolio/NFT
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .create(0, [{ inputToken: ETH, amount: bnbToDepositAndFees, orders, fromReserve: false }], {
                        value: bnbToDepositAndFees,
                    }),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });

        it("Should revert if deposit more than available", async () => {
            // All the amounts for this test
            const bnbToDeposit = appendDecimals(1);
            const bnbToDepositAndFees = bnbToDeposit.add(getExpectedFees(bnbToDeposit));

            // Orders to deposit in beefy with "initial amount x 2" (more than msg.value)
            let orders: utils.OrderStruct[] = utils.getBeefyBnbVenusDepositOrder(context, bnbToDepositAndFees.mul(2));

            // User1 creates the portfolio/NFT
            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .create(0, [{ inputToken: ETH, amount: bnbToDepositAndFees, orders, fromReserve: false }], {
                        value: bnbToDepositAndFees,
                    }),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });

        it("Create/Deposit in Beefy with BNB", async () => {
            // All the amounts for this test
            const bnbToDeposit = appendDecimals(1);
            const bnbToDepositAndFees = bnbToDeposit.add(getExpectedFees(bnbToDeposit));

            const ethBalanceBefore = await context.user1.getBalance();

            // Orders to Deposit in beefy
            let orders: utils.OrderStruct[] = utils.getBeefyBnbVenusDepositOrder(context, bnbToDeposit);

            // User1 creates the portfolio/NFT
            const tx = await context.nestedFactory
                .connect(context.user1)
                .create(0, [{ inputToken: ETH, amount: bnbToDepositAndFees, orders, fromReserve: false }], {
                    value: bnbToDepositAndFees,
                });

            // Get the transaction fees
            const txFees = await tx.wait().then(value => value.gasUsed.mul(value.effectiveGasPrice));

            // User1 must be the owner of NFT n°1
            expect(await context.nestedAsset.ownerOf(1)).to.be.equal(context.user1.address);

            const mockERC20Factory = await ethers.getContractFactory("MockERC20");
            const vault = mockERC20Factory.attach(context.beefyVenusBNBVaultAddress);

            // Moo tokens in vault
            const mooBalanceReserve = await vault.balanceOf(context.nestedReserve.address);
            expect(mooBalanceReserve).to.not.be.equal(BIG_NUMBER_ZERO);

            expect(await context.user1.getBalance()).to.be.equal(ethBalanceBefore.sub(bnbToDepositAndFees).sub(txFees));

            // The FeeSplitter must receive the right fee amount
            expect(await context.WBNB.balanceOf(context.feeSplitter.address)).to.be.equal(
                getExpectedFees(bnbToDeposit),
            );

            const expectedNfts = [
                {
                    id: BigNumber.from(1),
                    assets: [{ token: context.beefyVenusBNBVaultAddress, qty: mooBalanceReserve }],
                },
            ];

            const nfts = await context.nestedAssetBatcher.getNfts(context.user1.address);

            expect(JSON.stringify(utils.cleanResult(nfts))).to.equal(JSON.stringify(utils.cleanResult(expectedNfts)));
        });

        it("Create with FlatOperator and Deposit in Beefy with BNB", async () => {
            // The user add 10 WBNB to the portfolio
            const uniBought = appendDecimals(10);
            const totalToBought = uniBought;
            const expectedFee = getExpectedFees(totalToBought);
            const totalToSpend = totalToBought.add(expectedFee);

            // Add 10 UNI with FlatOperator
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
                    [
                        {
                            inputToken: ETH,
                            amount: totalToSpend,
                            orders,
                            fromReserve: false,
                        },
                    ],
                    { value: totalToSpend },
                ),
            )
                .to.emit(context.nestedFactory, "NftCreated")
                .withArgs(1, 0);

            // Orders to Deposit in beefy
            orders = [
                utils.buildOrderStruct(context.beefyVaultDepositOperatorNameBytes32, context.WBNB.address, [
                    ["address", context.beefyVenusBNBVaultAddress],
                    ["uint256", totalToBought],
                    ["uint256", 0], // 100% slippage
                ]),
            ];

            // User1 deposit in beefy via OutputOrder
            await expect(
                context.nestedFactory.connect(context.user1).processOutputOrders(1, [
                    {
                        outputToken: context.beefyVenusBNBVaultAddress,
                        amounts: [totalToBought],
                        orders,
                        toReserve: true,
                    },
                ]),
            )
                .to.emit(context.nestedFactory, "NftUpdated")
                .withArgs(1);

            const nfts = await context.nestedAssetBatcher.getNfts(context.user1.address);

            expect(nfts[0].assets.length).to.equal(1);
            expect(nfts[0].assets[0].token).to.equal(context.beefyVenusBNBVaultAddress);

            // Moo and WBNB in Fee Splitter
            const mockERC20Factory = await ethers.getContractFactory("MockERC20");
            const vault = mockERC20Factory.attach(context.beefyVenusBNBVaultAddress);

            expect(await vault.balanceOf(context.feeSplitter.address)).to.not.be.equal(BIG_NUMBER_ZERO);
            expect(await context.WBNB.balanceOf(context.feeSplitter.address)).to.not.be.equal(BIG_NUMBER_ZERO);
        });
    });

    describe("withdraw()", () => {
        beforeEach("Create NFT (id 1) with BNB deposited", async () => {
            const bnbToDeposit = appendDecimals(1);
            const bnbToDepositAndFees = bnbToDeposit.add(getExpectedFees(bnbToDeposit));

            // Orders to withdraw from beefy
            let orders: utils.OrderStruct[] = utils.getBeefyBnbVenusDepositOrder(context, bnbToDeposit);

            // User1 creates the portfolio/NFT
            await context.nestedFactory
                .connect(context.user1)
                .create(0, [{ inputToken: ETH, amount: bnbToDepositAndFees, orders, fromReserve: false }], {
                    value: bnbToDepositAndFees,
                });
        });

        it("Should revert if amount to withdraw is zero", async () => {
            const mockERC20Factory = await ethers.getContractFactory("MockERC20");
            const vault = mockERC20Factory.attach(context.beefyVenusBNBVaultAddress);

            const mooBalance = await vault.balanceOf(context.nestedReserve.address);

            // Orders to withdraw from beefy
            let orders: utils.OrderStruct[] = utils.getBeefyBnbVenusWithdrawOrder(context, BIG_NUMBER_ZERO);

            await expect(
                context.nestedFactory
                    .connect(context.user1)
                    .processOutputOrders(1, [
                        { outputToken: context.WBNB.address, amounts: [mooBalance], orders, toReserve: true },
                    ]),
            ).to.be.revertedWith("NF: OPERATOR_CALL_FAILED");
        });

        it("Destroy/Withdraw from Beefy", async () => {
            const mockERC20Factory = await ethers.getContractFactory("MockERC20");
            const vault = mockERC20Factory.attach(context.beefyVenusBNBVaultAddress);

            const mooBalance = await vault.balanceOf(context.nestedReserve.address);

            // Orders to withdraw from beefy
            let orders: utils.OrderStruct[] = utils.getBeefyBnbVenusWithdrawOrder(context, mooBalance);

            await context.nestedFactory.connect(context.user1).destroy(1, context.WBNB.address, orders);

            // All moo removed from reserve
            expect(await vault.balanceOf(context.nestedReserve.address)).to.be.equal(BIG_NUMBER_ZERO);
            expect(await vault.balanceOf(context.nestedFactory.address)).to.be.equal(BIG_NUMBER_ZERO);

            /*
             * I can't predict the WBNB received in the FeeSplitter.
             * It should be greater than 0.02 WBNB, but sub 1% to allow a margin of error
             */
            expect(await context.WBNB.balanceOf(context.feeSplitter.address)).to.be.gt(
                getExpectedFees(appendDecimals(2)).sub(getExpectedFees(appendDecimals(2)).div(100)),
            );
        });
    });
});
