import { LoadFixtureFunction } from "./types";
import { OperatorResolverFixture, operatorResolverFixture } from "./shared/fixtures";
import { createFixtureLoader, provider } from "./shared/provider";
import { expect } from "chai";
import { toBytes32 } from "./helpers";
import { ActorFixture } from "./shared/actors";
import { Wallet } from "ethers";

let loadFixture: LoadFixtureFunction;

describe("OperatorResolver", () => {
    let context: OperatorResolverFixture;
    const actors = new ActorFixture(provider.getWallets() as Wallet[], provider);
    const randomDestination: string = "0x829bd824b016326a401d083b33d092293333a830";

    before("loader", async () => {
        loadFixture = createFixtureLoader(provider.getWallets(), provider);
    });

    beforeEach("create fixture loader", async () => {
        context = await loadFixture(operatorResolverFixture);
    });

    it("deploys and has an address", async () => {
        expect(context.operatorResolver.address).to.be.a.string;
    });

    describe("importAddresses()", () => {
        it("can only be invoked by the owner", async () => {
            await expect(
                context.operatorResolver
                    .connect(actors.addressResolverOwner())
                    .importOperators([toBytes32("something")], [randomDestination]),
            ).to.not.be.reverted;
        });

        it("cant be invoked by an user", async () => {
            await expect(
                context.operatorResolver
                    .connect(actors.user1())
                    .importOperators([toBytes32("something")], [randomDestination]),
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });
    });

    describe("", () => {});
});
