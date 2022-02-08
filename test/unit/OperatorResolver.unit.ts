import { LoadFixtureFunction } from "../types";
import { OperatorResolverFixture, operatorResolverFixture } from "../shared/fixtures";
import { createFixtureLoader, provider, expect } from "../shared/provider";
import { toBytes32 } from "../helpers";
import { ActorFixture } from "../shared/actors";
import { Wallet } from "ethers";
import { ethers } from "hardhat";
import { FakeContract, smock } from "@defi-wonderland/smock";
import { TestableMixinResolver } from "../../typechain";
import { computeSelector } from "../../scripts/utils";

let loadFixture: LoadFixtureFunction;

describe("OperatorResolver", () => {
    let context: OperatorResolverFixture;
    const actors = new ActorFixture(provider.getWallets() as Wallet[], provider);

    const randomDestination1: Wallet = Wallet.createRandom();
    const randomDestination2: Wallet = Wallet.createRandom();
    const randomDestination3: Wallet = Wallet.createRandom();
    const randomDestination4: Wallet = Wallet.createRandom();

    function dummyOperatorDef(
        implementation: string,
        selector?: string,
    ): { implementation: string; selector: string } & [string, string] {
        // build something that will match both the array definition of a tuple, and its object defintion
        // (required for deep equality tests)
        selector ??= computeSelector(`function handle${implementation}()`);
        const ret: any = [implementation, selector];
        Object.assign(ret, { implementation, selector });
        return ret;
    }

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
                    .importOperators([toBytes32("something")], [dummyOperatorDef(randomDestination1.address)], []),
            ).to.not.be.reverted;
        });

        it("cant be invoked by an user", async () => {
            await expect(
                context.operatorResolver
                    .connect(actors.user1())
                    .importOperators([toBytes32("something")], [dummyOperatorDef(randomDestination1.address)], []),
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        describe("when a different number of names are given to addresses", () => {
            it("then it reverts", async () => {
                const revertReason: string = "OR: INPUTS_LENGTH_MUST_MATCH";
                await expect(
                    context.operatorResolver
                        .connect(actors.addressResolverOwner())
                        .importOperators([], [dummyOperatorDef(randomDestination1.address)], []),
                ).to.be.revertedWith(revertReason);

                await expect(
                    context.operatorResolver
                        .connect(actors.addressResolverOwner())
                        .importOperators([toBytes32("something")], [], []),
                ).to.be.revertedWith(revertReason);

                await expect(
                    context.operatorResolver
                        .connect(actors.addressResolverOwner())
                        .importOperators(
                            [toBytes32("something")],
                            [
                                dummyOperatorDef(randomDestination1.address),
                                dummyOperatorDef(randomDestination2.address),
                            ],
                            [],
                        ),
                ).to.be.revertedWith(revertReason);
            });
        });

        describe("when three separate addresses are given", () => {
            beforeEach(async () => {
                await context.operatorResolver.connect(actors.addressResolverOwner()).importOperators(
                    ["first", "second", "third"].map(toBytes32),
                    [randomDestination1.address, randomDestination2.address, randomDestination3.address].map(a =>
                        dummyOperatorDef(a),
                    ),
                    [],
                );
            });
            it("then it can verify the imported set of addresses", async () => {
                expect(
                    await context.operatorResolver.areOperatorsImported(
                        ["first", "second", "third"].map(toBytes32),
                        [randomDestination1.address, randomDestination2.address, randomDestination3.address].map(a =>
                            dummyOperatorDef(a),
                        ),
                    ),
                ).to.be.true;

                expect(
                    await context.operatorResolver.areOperatorsImported(
                        ["first", "second", "third"].map(toBytes32),
                        [randomDestination2.address, randomDestination1.address, randomDestination3.address].map(a =>
                            dummyOperatorDef(a),
                        ),
                    ),
                ).to.be.false;
            });
            it("then each can be looked up in turn", async () => {
                expect(await context.operatorResolver.getOperator(toBytes32("first"))).to.deep.equal(
                    dummyOperatorDef(randomDestination1.address),
                );
                expect(await context.operatorResolver.getOperator(toBytes32("second"))).to.deep.equal(
                    dummyOperatorDef(randomDestination2.address),
                );
                expect(await context.operatorResolver.getOperator(toBytes32("third"))).to.deep.equal(
                    dummyOperatorDef(randomDestination3.address),
                );
            });

            describe("when two are overridden", () => {
                beforeEach(async () => {
                    await context.operatorResolver.connect(actors.addressResolverOwner()).importOperators(
                        ["second", "third"].map(toBytes32),
                        [randomDestination3.address, randomDestination4.address].map(a => dummyOperatorDef(a)),
                        [],
                    );
                });
                it("then the first remains the same while the other two are updated", async () => {
                    expect(await context.operatorResolver.getOperator(toBytes32("first"))).to.deep.equal(
                        dummyOperatorDef(randomDestination1.address),
                    );
                    expect(await context.operatorResolver.getOperator(toBytes32("second"))).to.deep.equal(
                        dummyOperatorDef(randomDestination3.address),
                    );
                    expect(await context.operatorResolver.getOperator(toBytes32("third"))).to.deep.equal(
                        dummyOperatorDef(randomDestination4.address),
                    );
                });
            });
        });
    });

    describe("getAddress()", () => {
        it("when invoked with no entries, returns 0 address", async () => {
            expect(await context.operatorResolver.getOperator(toBytes32("first"))).to.deep.equal(
                dummyOperatorDef(ethers.constants.AddressZero, "0x00000000"),
            );
        });
        describe("when three separate addresses are given", () => {
            beforeEach(async () => {
                await context.operatorResolver.connect(actors.addressResolverOwner()).importOperators(
                    ["first", "second", "third"].map(toBytes32),
                    [randomDestination1.address, randomDestination2.address, randomDestination3.address].map(a =>
                        dummyOperatorDef(a),
                    ),
                    [],
                );
            });
            it("then getAddress returns the same as the public mapping", async () => {
                expect(await context.operatorResolver.getOperator(toBytes32("third"))).to.deep.equal(
                    dummyOperatorDef(randomDestination3.address),
                );
                expect(await context.operatorResolver.operators(toBytes32("first"))).to.deep.equal(
                    dummyOperatorDef(randomDestination1.address),
                );
                expect(await context.operatorResolver.operators(toBytes32("third"))).to.deep.equal(
                    dummyOperatorDef(randomDestination3.address),
                );
            });
        });
    });

    describe("requireAndGetAddress()", () => {
        const errorMessage: string = "Error !";
        it("when invoked with no entries, reverts", async () => {
            await expect(
                context.operatorResolver.requireAndGetOperator(toBytes32("first"), errorMessage),
            ).to.be.revertedWith(errorMessage);
        });
        describe("when three separate addresses are given", () => {
            beforeEach(async () => {
                await context.operatorResolver.connect(actors.addressResolverOwner()).importOperators(
                    ["first", "second", "third"].map(toBytes32),
                    [randomDestination1.address, randomDestination2.address, randomDestination3.address].map(a =>
                        dummyOperatorDef(a),
                    ),
                    [],
                );
            });
            it("then requireAndGetAddress() returns the same as the public mapping", async () => {
                expect(
                    await context.operatorResolver.requireAndGetOperator(toBytes32("second"), errorMessage),
                ).to.deep.equal(dummyOperatorDef(randomDestination2.address));
                expect(
                    await context.operatorResolver.requireAndGetOperator(toBytes32("third"), errorMessage),
                ).to.deep.equal(dummyOperatorDef(randomDestination3.address));
            });
            it("when invoked with an unknown entry, reverts", async () => {
                await expect(
                    context.operatorResolver.requireAndGetOperator(toBytes32("other"), errorMessage),
                ).to.be.revertedWith(errorMessage);
            });
        });
    });

    describe("rebuildCaches()", () => {
        describe("when some MixinResolver contracts exist", () => {
            let mixinResolver1: FakeContract<TestableMixinResolver>;

            beforeEach("smock some MixinResolver contracts", async () => {
                mixinResolver1 = await smock.fake<TestableMixinResolver>("TestableMixinResolver");
            });

            describe("when some of these contracts are imported and caches are rebuilt", () => {
                beforeEach("import contracts and rebuild caches", async () => {
                    await context.operatorResolver.connect(actors.addressResolverOwner()).importOperators(
                        ["first", "second", "third"].map(toBytes32),
                        [mixinResolver1.address, mixinResolver1.address, mixinResolver1.address].map(a =>
                            dummyOperatorDef(a),
                        ),
                        [],
                    );

                    await context.operatorResolver.rebuildCaches([mixinResolver1.address, mixinResolver1.address]);
                });

                it("shows that rebuildCache() was called on imported addresses", async () => {
                    expect(mixinResolver1.rebuildCache).to.have.been.calledTwice;
                });
            });
        });
    });
});
