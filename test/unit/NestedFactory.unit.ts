import { LoadFixtureFunction } from "../types";
import { factoryAndZeroExFixture, FactoryAndZeroExFixture } from "../shared/fixtures";
import { ActorFixture } from "../shared/actors";
import { createFixtureLoader, expect, provider } from "../shared/provider";
import { Wallet } from "ethers";

let loadFixture: LoadFixtureFunction;

describe("NestedFactory", () => {
    let context: FactoryAndZeroExFixture;
    const actors = new ActorFixture(provider.getWallets() as Wallet[], provider);

    before("loader", async () => {
        loadFixture = createFixtureLoader(provider.getWallets(), provider);
    });

    beforeEach("create fixture loader", async () => {
        context = await loadFixture(factoryAndZeroExFixture);
    });

    it("deploys and has an address", async () => {
        expect(context.nestedFactory.address).to.be.a.string;
    });
});
