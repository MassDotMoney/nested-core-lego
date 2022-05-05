import { LoadFixtureFunction } from "../types";
import { createFixtureLoader, describeWithoutFork, expect, provider } from "../shared/helpers/provider";
import { BigNumber } from "ethers";
import { appendDecimals, getExpectedFees } from "../helpers";
import * as utils from "../../scripts/utils";
import { factoryAndOperatorsFixture } from "../shared/helpers/fixtures/factoryAndOperatorsFixture";
import { FactoryAndOperatorsFixture } from "../shared/types/FactoryAndOperatorsFixture";

let loadFixture: LoadFixtureFunction;

describeWithoutFork("NestedAssetBatcher", () => {
    let context: FactoryAndOperatorsFixture;

    before("loader", async () => {
        loadFixture = createFixtureLoader(provider.getWallets(), provider);
    });

    beforeEach("create fixture loader", async () => {
        context = await loadFixture(factoryAndOperatorsFixture);
    });

    describe("Getters", () => {
        // Amount already in the portfolio
        let baseUniBought = appendDecimals(6);
        let baseKncBought = appendDecimals(4);
        let baseTotalToBought = baseUniBought.add(baseKncBought);
        let baseExpectedFee = getExpectedFees(baseTotalToBought);
        let baseTotalToSpend = baseTotalToBought.add(baseExpectedFee);

        beforeEach("Create NFT (id 1)", async () => {
            // create nft 1 with UNI and KNC from DAI (use the base amounts)
            let orders: utils.OrderStruct[] = utils.getUniAndKncWithDaiOrders(context, baseUniBought, baseKncBought);
            await context.nested.nestedFactory
                .connect(context.wallets.user1)
                .create(0, [
                    { inputToken: context.tokens.mockDAI.address, amount: baseTotalToSpend, orders, fromReserve: true },
                ]);
        });

        it("get all ids", async () => {
            expect(await (await context.nested.nestedAssetBatcher.getIds(context.wallets.user1.address)).toString()).to.equal(
                [BigNumber.from(1)].toString(),
            );
        });

        it("get all NFTs", async () => {
            const expectedNfts = [
                {
                    id: BigNumber.from(1),
                    assets: [
                        { token: context.tokens.mockUNI.address, qty: baseUniBought },
                        { token: context.tokens.mockKNC.address, qty: baseKncBought },
                    ],
                },
            ];

            const nfts = await context.nested.nestedAssetBatcher.getNfts(context.wallets.user1.address);

            expect(JSON.stringify(utils.cleanResult(nfts))).to.equal(JSON.stringify(utils.cleanResult(expectedNfts)));
        });

        it("require and get TokenHoldings", async () => {
            await expect(context.nested.nestedAssetBatcher.requireTokenHoldings(2)).to.be.revertedWith("NAB: NEVER_CREATED");
            await expect(context.nested.nestedAssetBatcher.requireTokenHoldings(1)).to.not.be.reverted;

            let orders: utils.OrderStruct[] = utils.getUsdcWithUniAndKncOrders(context, baseUniBought, baseKncBought);
            await context.nested.nestedFactory.connect(context.wallets.user1).destroy(1, context.tokens.mockUSDC.address, orders);

            // Not reverting after burn
            await expect(context.nested.nestedAssetBatcher.requireTokenHoldings(1)).to.not.be.reverted;
        });
    });
});
