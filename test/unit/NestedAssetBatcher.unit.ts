import { LoadFixtureFunction } from "../types";
import { factoryAndOperatorsFixture, FactoryAndOperatorsFixture } from "../shared/fixtures";
import { createFixtureLoader, describeWithoutFork, expect, provider } from "../shared/provider";
import { BigNumber } from "ethers";
import { appendDecimals, getExpectedFees } from "../helpers";
import * as utils from "../../scripts/utils";

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
            await context.nestedFactory
                .connect(context.user1)
                .create(0, [
                    { inputToken: context.mockDAI.address, amount: baseTotalToSpend, orders, fromReserve: true },
                ]);
        });

        it("get all ids", async () => {
            expect(await (await context.nestedAssetBatcher.getIds(context.user1.address)).toString()).to.equal(
                [BigNumber.from(1)].toString(),
            );
        });

        it("get all NFTs", async () => {
            const expectedNfts = [
                {
                    id: BigNumber.from(1),
                    assets: [
                        { token: context.mockUNI.address, qty: baseUniBought },
                        { token: context.mockKNC.address, qty: baseKncBought },
                    ],
                },
            ];

            const nfts = await context.nestedAssetBatcher.getNfts(context.user1.address);

            expect(JSON.stringify(utils.cleanResult(nfts))).to.equal(JSON.stringify(utils.cleanResult(expectedNfts)));
        });

        it("require and get TokenHoldings", async () => {
            await expect(context.nestedAssetBatcher.requireTokenHoldings(2)).to.be.revertedWith("NAB: NEVER_CREATED");
            await expect(context.nestedAssetBatcher.requireTokenHoldings(1)).to.not.be.reverted;

            let orders: utils.OrderStruct[] = utils.getUsdcWithUniAndKncOrders(context, baseUniBought, baseKncBought);
            await context.nestedFactory.connect(context.user1).destroy(1, context.mockUSDC.address, orders);

            // Not reverting after burn
            await expect(context.nestedAssetBatcher.requireTokenHoldings(1)).to.not.be.reverted;
        });
    });
});
