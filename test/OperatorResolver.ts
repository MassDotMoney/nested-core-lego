import { LoadFixtureFunction } from "./types";
import { OperatorResolverFixture, operatorResolverFixture } from "./shared/fixtures";
import { createFixtureLoader, provider } from "./shared/provider";
import { expect } from "chai";

let loadFixture: LoadFixtureFunction;

describe('OperatorResolver', () => {
    let context: OperatorResolverFixture;

    before('loader', async () => {
        loadFixture = createFixtureLoader(provider.getWallets(), provider)
    });

    beforeEach('create fixture loader', async () => {
        context = await loadFixture(operatorResolverFixture);
    });

    it('deploys and has an address', async () => {
        expect(context.operatorResolver.address).to.be.a.string;
    });
});
