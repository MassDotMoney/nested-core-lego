import { LoadFixtureFunction } from "../types";
import { factoryAndOperatorsFixture, FactoryAndOperatorsFixture } from "../shared/fixtures";
import { createFixtureLoader, expect, provider, describeWithoutFork } from "../shared/provider";
import { appendDecimals, getExpectedFees } from "../helpers";
import * as utils from "../../scripts/utils";

let loadFixture: LoadFixtureFunction;

interface Order {
    operator: string;
    token: string;
    callData: string | [];
}

describeWithoutFork("FlatOperator", () => {
    let context: FactoryAndOperatorsFixture;

    before("loader", async () => {
        loadFixture = createFixtureLoader(provider.getWallets(), provider);
    });

    beforeEach("create fixture loader", async () => {
        context = await loadFixture(factoryAndOperatorsFixture);
    });

    it("deploys and has an address", async () => {
        expect(context.flatOperator.address).to.be.a.string;
    });

    it("Can't use amount zero", async () => {
        // The user add 10 UNI to the portfolio
        const totalToBought = appendDecimals(10);
        const expectedFee = getExpectedFees(totalToBought);
        const totalToSpend = totalToBought.add(expectedFee);

        // Add 0 UNI with FlatOperator
        let orders: Order[] = [
            {
                operator: context.flatOperatorNameBytes32,
                token: context.mockUNI.address,
                callData: utils.abiCoder.encode(["address", "uint256"], [context.mockUNI.address, 0]),
            },
        ];

        await expect(
            context.nestedFactory.connect(context.user1).create(0, [
                {
                    inputToken: context.mockUNI.address,
                    amount: totalToSpend,
                    orders,
                    fromReserve: false,
                },
            ]),
        ).to.revertedWith("NF: OPERATOR_CALL_FAILED");
    });

    it("Can't use with different input", async () => {
        // The user add 10 UNI to the portfolio
        const totalToBought = appendDecimals(10);
        const expectedFee = getExpectedFees(totalToBought);
        const totalToSpend = totalToBought.add(expectedFee);

        // Add 10 DAI with FlatOperator, but input UNI
        let orders: Order[] = [
            {
                operator: context.flatOperatorNameBytes32,
                token: context.mockUNI.address,
                callData: utils.abiCoder.encode(["address", "uint256"], [context.mockDAI.address, 10]),
            },
        ];

        // The error is "OUTPUT" because the token in Order is considered as the "right token" (UNI)
        // Therefore, the DAI token (output) is considered as invalid.
        await expect(
            context.nestedFactory.connect(context.user1).create(0, [
                {
                    inputToken: context.mockUNI.address,
                    amount: totalToSpend,
                    orders,
                    fromReserve: false,
                },
            ]),
        ).to.revertedWith("MOR: INVALID_OUTPUT_TOKEN");
    });

    it("Adds token to portfolio when create()", async () => {
        // The user add 10 UNI to the portfolio
        const uniBought = appendDecimals(10);
        const totalToBought = uniBought;
        const expectedFee = getExpectedFees(totalToBought);
        const totalToSpend = totalToBought.add(expectedFee);

        // Add 10 UNI with FlatOperator
        let orders: Order[] = [
            {
                operator: context.flatOperatorNameBytes32,
                token: context.mockUNI.address,
                callData: utils.abiCoder.encode(["address", "uint256"], [context.mockUNI.address, totalToBought]),
            },
        ];

        // User1 creates the portfolio/NFT and emit event NftCreated
        await expect(
            context.nestedFactory.connect(context.user1).create(0, [
                {
                    inputToken: context.mockUNI.address,
                    amount: totalToSpend,
                    orders,
                    fromReserve: false,
                },
            ]),
        )
            .to.emit(context.nestedFactory, "NftCreated")
            .withArgs(1, 0);

        // User1 must be the owner of NFT n°1
        expect(await context.nestedAsset.ownerOf(1)).to.be.equal(context.user1.address);

        // 10 UNI must be in the reserve
        expect(await context.mockUNI.balanceOf(context.nestedReserve.address)).to.be.equal(uniBought);

        /*
         * User1 must have the right UNI amount :
         * baseAmount - amount spent
         */
        expect(await context.mockUNI.balanceOf(context.user1.address)).to.be.equal(
            context.baseAmount.sub(totalToSpend),
        );

        // The FeeSplitter must receive the right fee amount
        expect(await context.mockUNI.balanceOf(context.feeSplitter.address)).to.be.equal(expectedFee);

        // Must store UNI in the records of the NFT
        expect(await context.nestedRecords.getAssetTokens(1).then(value => value.toString())).to.be.equal(
            [context.mockUNI.address].toString(),
        );

        // Must have the right amount in the holdings
        const holdingsUNIAmount = await context.nestedRecords.getAssetHolding(1, context.mockUNI.address);
        expect(holdingsUNIAmount).to.be.equal(uniBought);
    });

    it("remove token from portfolio when destroy()", async () => {
        // The user add 10 UNI to the portfolio
        const uniBought = appendDecimals(10);
        const totalToBought = uniBought;
        const expectedFee = getExpectedFees(totalToBought);
        const totalToSpend = totalToBought.add(expectedFee);

        // Add 10 UNI with FlatOperator
        let orders: Order[] = [
            {
                operator: context.flatOperatorNameBytes32,
                token: context.mockUNI.address,
                callData: utils.abiCoder.encode(["address", "uint256"], [context.mockUNI.address, totalToBought]),
            },
        ];

        // User1 creates the portfolio/NFT and emit event NftCreated
        await expect(
            context.nestedFactory.connect(context.user1).create(0, [
                {
                    inputToken: context.mockUNI.address,
                    amount: totalToSpend,
                    orders,
                    fromReserve: false,
                },
            ]),
        )
            .to.emit(context.nestedFactory, "NftCreated")
            .withArgs(1, 0);

        // Remove 10 UNI (with same order)
        await context.nestedFactory.connect(context.user1).destroy(1, context.mockUNI.address, orders);

        // UNI from create and from destroy to FeeSplitter (so, two times 1% of 10 UNI)
        expect(await context.mockUNI.balanceOf(context.feeSplitter.address)).to.be.equal(
            getExpectedFees(uniBought).mul(2),
        );

        // No holdings for NFT 1
        expect(await context.nestedRecords.getAssetTokens(1).then(value => value.toString())).to.be.equal(
            [].toString(),
        );

        // The NFT is burned
        await expect(context.nestedAsset.ownerOf(1)).to.be.revertedWith("ERC721: owner query for nonexistent token");
    });

    it("remove token from portfolio when destroy() with underspend amount", async () => {
        // The user add 10 UNI to the portfolio
        const uniBought = appendDecimals(10);
        const expectedFee = getExpectedFees(uniBought);
        const totalToSpend = uniBought.add(expectedFee);

        // Add 10 UNI with FlatOperator
        let orders: Order[] = [
            {
                operator: context.flatOperatorNameBytes32,
                token: context.mockUNI.address,
                callData: utils.abiCoder.encode(["address", "uint256"], [context.mockUNI.address, uniBought]),
            },
        ];

        // User1 creates the portfolio/NFT and emit event NftCreated
        await expect(
            context.nestedFactory.connect(context.user1).create(0, [
                {
                    inputToken: context.mockUNI.address,
                    amount: totalToSpend,
                    orders,
                    fromReserve: false,
                },
            ]),
        )
            .to.emit(context.nestedFactory, "NftCreated")
            .withArgs(1, 0);

        // Remove only 1 UNI in the order, hence there is still holdings leading to underspend amount
        let orders_underspend: Order[] = [
            {
                operator: context.flatOperatorNameBytes32,
                token: context.mockUNI.address,
                callData: utils.abiCoder.encode(["address", "uint256"], [context.mockUNI.address, appendDecimals(1)]),
            },
        ];
        await context.nestedFactory.connect(context.user1).destroy(1, context.mockUNI.address, orders_underspend);

        // UNI from create and from destroy to FeeSplitter (so, two times 1% of 10 UNI)
        expect(await context.mockUNI.balanceOf(context.feeSplitter.address)).to.be.equal(
            getExpectedFees(uniBought).mul(2),
        );

        // No holdings for NFT 1
        expect(await context.nestedRecords.getAssetTokens(1).then(value => value.toString())).to.be.equal(
            [].toString(),
        );

        // The NFT is burned
        await expect(context.nestedAsset.ownerOf(1)).to.be.revertedWith("ERC721: owner query for nonexistent token");
    });
});
