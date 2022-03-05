import { LoadFixtureFunction } from "../types";
import { factoryAndOperatorsForkingBSCFixture, FactoryAndOperatorsForkingBSCFixture } from "../shared/fixtures";
import { ActorFixture } from "../shared/actors";
import { createFixtureLoader, describeOnBscFork, expect, provider } from "../shared/provider";
import { BigNumber, Wallet } from "ethers";
import { appendDecimals, getExpectedFees } from "../helpers";
import * as utils from "../../scripts/utils";
import { ethers } from "hardhat";

let loadFixture: LoadFixtureFunction;

/*
 * The operator's in-depth tests are in the factory tests.
 */
describeOnBscFork("BeefyVaultOperator", () => {
    let context: FactoryAndOperatorsForkingBSCFixture;
    const ETH = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
    const actors = new ActorFixture(provider.getWallets() as Wallet[], provider);

    before("loader", async () => {
        loadFixture = createFixtureLoader(provider.getWallets(), provider);
    });

    beforeEach("create fixture loader", async () => {
        context = await loadFixture(factoryAndOperatorsForkingBSCFixture);
    });

    it("deploys and has an address", async () => {
        expect(context.beefyVaultOperator.address).to.be.a.string;
    });

    it("has swapTarget (storage)", async () => {
        expect(context.zeroExOperator.operatorStorage()).to.be.a.string;
    });

    describe("deposit()", () => {
        it("Create and deposit un Beefy", async () => {
            // All the amounts for this test
            const bnbToDeposit = appendDecimals(1);
            const bnbToDepositAndFees = bnbToDeposit.add(getExpectedFees(bnbToDeposit));

            const ethBalanceBefore = await context.user1.getBalance();

            // Orders for UNI and KNC
            let orders: utils.OrderStruct[] = utils.getBeefyBnbVenusOrder(context, bnbToDeposit);

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
            const mooBalanceReserve = await vault.balanceOf(context.nestedReserve.address)
            expect(mooBalanceReserve).to.not.be.equal(BigNumber.from(0));

            expect(await context.user1.getBalance()).to.be.equal(ethBalanceBefore.sub(bnbToDepositAndFees).sub(txFees));

            // The FeeSplitter must receive the right fee amount
            expect(await context.WBNB.balanceOf(context.feeSplitter.address)).to.be.equal(
                getExpectedFees(bnbToDeposit),
            );

            const expectedNfts = [
                {
                    id: BigNumber.from(1),
                    assets: [
                        { token: context.beefyVenusBNBVaultAddress, qty: mooBalanceReserve },
                    ],
                },
            ];

            const nfts = await context.nestedAssetBatcher.getNfts(context.user1.address);

            expect(JSON.stringify(utils.cleanResult(nfts))).to.equal(JSON.stringify(utils.cleanResult(expectedNfts))); 
        });
    });
});
