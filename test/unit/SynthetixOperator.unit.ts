import { LoadFixtureFunction } from "../types";
import { synthetixOperatorFixture, SynthetixOperatorFixture } from "../shared/fixtures";
import { ActorFixture } from "../shared/actors";
import { createFixtureLoader, expect, provider } from "../shared/provider";
import { Wallet } from "ethers";

let loadFixture: LoadFixtureFunction;

describe("SynthetixOperator", () => {
    let context: SynthetixOperatorFixture;
    const actors = new ActorFixture(provider.getWallets() as Wallet[], provider);

    before("loader", async () => {
        loadFixture = createFixtureLoader(provider.getWallets(), provider);
    });

    beforeEach("create fixture loader", async () => {
        context = await loadFixture(synthetixOperatorFixture);
    });

    it("deploys and has an address", async () => {
        expect(context.synthetixOperator.address).to.be.a.string;
        expect(context.synthetix.address).to.be.a.string;
        expect(context.testableOperatorCaller.address).to.be.a.string;
    });
});
