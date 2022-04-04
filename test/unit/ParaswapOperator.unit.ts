import { LoadFixtureFunction } from "../types";
import { paraswapOperatorFixture, ParaswapOperatorFixture } from "../shared/fixtures";
import { ActorFixture } from "../shared/actors";
import { createFixtureLoader, describeWithoutFork, expect, provider } from "../shared/provider";
import { BigNumber, Wallet } from "ethers";

let loadFixture: LoadFixtureFunction;

/*
 * The operator's in-depth tests are in the factory tests.
 */
describeWithoutFork("ParaswapOperator", () => {
    let context: ParaswapOperatorFixture;
    const actors = new ActorFixture(provider.getWallets() as Wallet[], provider);

    before("loader", async () => {
        loadFixture = createFixtureLoader(provider.getWallets(), provider);
    });

    beforeEach("create fixture loader", async () => {
        context = await loadFixture(paraswapOperatorFixture);
    });

    it("deploys and has an address", async () => {
        expect(context.paraswapOperator.address).to.be.a.string;
        expect(context.augustusSwapper.address).to.be.a.string;
    });

    it("has proxy and swapper", async () => {
        expect(context.paraswapOperator.tokenTransferProxy()).to.be.a.string;
        expect(context.paraswapOperator.augustusSwapper()).to.be.a.string;
    });

    describe("performSwap()", () => {
        it("Swap tokens", async () => {
            let initDaiBalance = await context.mockDAI.balanceOf(context.testableOperatorCaller.address);
            let initUniBalance = await context.mockUNI.balanceOf(context.testableOperatorCaller.address);
            const amount = 1000;
            // Calldata swap 1000 DAI against 1000 UNI
            let calldata = context.augustusSwapperInterface.encodeFunctionData("dummyswapToken", [
                context.mockDAI.address,
                context.mockUNI.address,
                amount,
            ]);

            // Run swap
            await context.testableOperatorCaller
                .connect(actors.user1())
                .performSwap(
                    context.paraswapOperator.address,
                    context.mockDAI.address,
                    context.mockUNI.address,
                    calldata,
                );

            expect(await context.mockDAI.balanceOf(context.testableOperatorCaller.address)).to.be.equal(
                initDaiBalance.sub(BigNumber.from(amount)),
            );
            expect(await context.mockUNI.balanceOf(context.testableOperatorCaller.address)).to.be.equal(
                initUniBalance.add(BigNumber.from(amount)),
            );
        });

        it("Can't swap 0 tokens", async () => {
            const amount = 0;

            // Calldata swap 1000 DAI against 1000 UNI
            let calldata = context.augustusSwapperInterface.encodeFunctionData("dummyswapToken", [
                context.mockDAI.address,
                context.mockUNI.address,
                amount,
            ]);

            // Run swap
            await expect(
                context.testableOperatorCaller
                    .connect(actors.user1())
                    .performSwap(
                        context.paraswapOperator.address,
                        context.mockDAI.address,
                        context.mockUNI.address,
                        calldata,
                    ),
            ).to.be.revertedWith("TestableOperatorCaller::performSwap: Error");
        });
    });
});
