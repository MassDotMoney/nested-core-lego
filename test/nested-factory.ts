import { Contract, ContractFactory } from "@ethersproject/contracts";
import { appendDecimals, getETHSpentOnGas } from "./helpers";
import { ethers, network } from "hardhat";

import { BigNumber } from "@ethersproject/bignumber";
import { Interface } from "@ethersproject/abi";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";

describe("NestedFactory", () => {
    let nestedFactory: ContractFactory, factory: Contract;
    let alice: SignerWithAddress,
        bob: SignerWithAddress,
        wallet3: SignerWithAddress,
        wallet4: SignerWithAddress,
        newReserve: SignerWithAddress;
    let mockWETH: Contract, mockUNI: Contract, mockKNC: Contract, mockDAI: Contract, feeTo: Contract;
    let nestedReserve: ContractFactory, reserve: Contract;
    let nestedAsset: ContractFactory, asset: Contract;
    let nestedRecords: ContractFactory, records: Contract;
    let dummyRouter: Contract;

    before(async () => {
        nestedFactory = await ethers.getContractFactory("NestedFactory");
        nestedReserve = await ethers.getContractFactory("NestedReserve");
        nestedAsset = await ethers.getContractFactory("NestedAsset");
        nestedRecords = await ethers.getContractFactory("NestedRecords");

        const signers = await ethers.getSigners();
        // All transactions will be sent from Alice unless explicity specified
        alice = signers[0] as any;
        bob = signers[1] as any;
        wallet3 = signers[3] as any;
        wallet4 = signers[4] as any;
        feeTo = signers[5] as any;
        newReserve = signers[6] as any;

        const dummyRouterFactory = await ethers.getContractFactory("DummyRouter");
        dummyRouter = await dummyRouterFactory.deploy();
    });

    beforeEach(async () => {
        // reset alice's balance
        await network.provider.send("hardhat_setBalance", [alice.address, appendDecimals(1000).toHexString()]);

        const MockWETHFactory = await ethers.getContractFactory("WETH9");
        mockWETH = await MockWETHFactory.deploy();

        const feeSplitterFactory = await ethers.getContractFactory("FeeSplitter");
        feeTo = await feeSplitterFactory.deploy(
            [wallet3.address, wallet4.address],
            [1000, 1700],
            300,
            mockWETH.address,
        );

        asset = await nestedAsset.deploy();
        await asset.deployed();

        records = await nestedRecords.deploy();
        await records.deployed();

        factory = await nestedFactory.deploy(
            asset.address,
            records.address,
            feeTo.address,
            mockWETH.address,
            500,
            appendDecimals(500),
        );
        await factory.deployed();

        reserve = await nestedReserve.deploy(factory.address);
        await reserve.deployed();
        await factory.setReserve(reserve.address);

        await asset.setFactory(factory.address);
        await records.setFactory(factory.address);
    });

    describe("#initialization", () => {
        it("sets the state variables", async () => {
            expect(await factory.feeTo()).to.eq(feeTo.address);
            expect(await factory.nestedAsset()).to.eq(asset.address);
            expect(await factory.weth()).to.eq(mockWETH.address);
        });
    });

    describe("#setFeeTo", () => {
        it("sets feeTo state variable", async () => {
            await factory.setFeeTo(bob.address);
            expect(await factory.feeTo()).to.equal(bob.address);
        });

        it("reverts if unauthorized", async () => {
            await expect(factory.connect(bob).setFeeTo(bob.address)).to.be.revertedWith(
                "Ownable: caller is not the owner",
            );
        });

        it("reverts if the address is invalid", async () => {
            await expect(factory.setFeeTo("0x0000000000000000000000000000000000000000")).to.be.revertedWith(
                "INVALID_ADDRESS",
            );
        });
    });

    describe("#create", () => {
        const totalSellAmount = appendDecimals(10);
        let tokensToBuy: string[] = [];
        let buyTokenOrders: TokenOrder[] = [];
        const expectedFee = totalSellAmount.div(100);

        beforeEach(async () => {
            const mockERC20Factory = await ethers.getContractFactory("MockERC20");
            mockUNI = await mockERC20Factory.deploy("Mocked UNI", "INU", appendDecimals(3000000));
            mockKNC = await mockERC20Factory.deploy("Mocked KNC", "CNK", appendDecimals(3000000));

            mockUNI.transfer(dummyRouter.address, appendDecimals(1000));
            mockKNC.transfer(dummyRouter.address, appendDecimals(1000));

            tokensToBuy = [mockUNI.address, mockKNC.address];

            const abi = ["function dummyswapToken(address _inputToken, address _outputToken, uint256 _amount)"];
            const iface = new Interface(abi);

            buyTokenOrders = [
                {
                    token: tokensToBuy[0],
                    callData: iface.encodeFunctionData("dummyswapToken", [
                        mockWETH.address,
                        tokensToBuy[0],
                        appendDecimals(4),
                    ]),
                },
                {
                    token: tokensToBuy[1],
                    callData: iface.encodeFunctionData("dummyswapToken", [
                        mockWETH.address,
                        tokensToBuy[1],
                        appendDecimals(6),
                    ]),
                },
            ];
        });

        describe("creating from ERC20 tokens", async () => {
            beforeEach(async () => {
                mockWETH.approve(factory.address, totalSellAmount.add(expectedFee));
                await mockWETH.deposit({ value: totalSellAmount.add(expectedFee) });
            });

            it("reverts if the sell amount is less than total sum of token sales", async () => {
                await expect(createNFTFromERC20(buyTokenOrders, totalSellAmount.sub(1))).to.be.revertedWith(
                    "OVERSPENT_ERROR",
                );
            });

            it("reverts if tokenOrders list is empty", async () => {
                await expect(createNFTFromERC20([], totalSellAmount)).to.be.revertedWith("BUY_ARG_MISSING");
            });
            it("reverts if the user does not have enough funds", async () => {
                await mockWETH.withdraw(1);
                await expect(createNFTFromERC20(buyTokenOrders, totalSellAmount)).to.be.revertedWith(
                    "INSUFFICIENT_BALANCE",
                );
            });

            it("reverts if a swap fails", async () => {
                // corrupt swap call to make it fail
                const abi = ["function missing()"];
                const iface = new Interface(abi);
                buyTokenOrders[1].callData = iface.encodeFunctionData("missing");
                await expect(createNFTFromERC20(buyTokenOrders, totalSellAmount)).to.be.revertedWith(
                    "SWAP_CALL_FAILED",
                );
            });

            it("reverts if a swap target isn't allowed", async () => {
                // corrupt swap call to make it fail
                const abi = ["function removeNFT(uint256)"];
                const iface = new Interface(abi);
                buyTokenOrders[1].callData = iface.encodeFunctionData("removeNFT", [0]);
                await expect(
                    factory.create(0, mockWETH.address, totalSellAmount, records.address, buyTokenOrders),
                ).to.be.revertedWith("INVALID_SWAP_TARGET");
            });

            it("reverts if nothing was bought during the swap", async () => {
                await expect(createNFTFromERC20([
                    {
                        token: tokensToBuy[0],
                        callData: [],
                    },
                ], totalSellAmount)).to.be.revertedWith(
                    "NOTHING_BOUGHT",
                );
            });

            it("creates the NFT", async () => {
                const initialWethBalance = await mockWETH.balanceOf(alice.address);

                await createNFTFromERC20(buyTokenOrders, totalSellAmount);

                // bob also buys an NFT
                mockWETH.connect(bob).approve(factory.address, totalSellAmount.add(expectedFee));
                await mockWETH.connect(bob).deposit({ value: totalSellAmount.add(expectedFee) });
                await createNFTFromERC20(buyTokenOrders, totalSellAmount, bob);

                const expectedAliceWethBalance = initialWethBalance.sub(totalSellAmount).sub(expectedFee);

                expect(await mockWETH.balanceOf(alice.address)).to.equal(expectedAliceWethBalance);
                // fee x2 because bob and alice each bought a NFT
                expect(await mockWETH.balanceOf(factory.feeTo())).to.equal(expectedFee.mul(2));

                const buyUNIAmount = appendDecimals(4);
                const buyKNCAmount = appendDecimals(6);

                expect(await mockUNI.balanceOf(factory.reserve())).to.equal(buyUNIAmount.mul(2));
                expect(await mockKNC.balanceOf(factory.reserve())).to.equal(buyKNCAmount.mul(2));

                // check if NFT was created
                const aliceTokens = await factory.tokensOf(alice.address);
                expect(aliceTokens.length).to.equal(1);

                // check number of assets in NFT token
                const result = await factory.tokenHoldings(aliceTokens[0]);
                expect(result.length).to.equal(buyTokenOrders.length);
                expect(result[0].isActive).to.equal(true);

                // check that fees were taken
                expect(await mockWETH.balanceOf(feeTo.address)).to.equal(expectedFee.mul(2));
            });

            it("creates the NFT with an original token ID", async () => {
                await createNFTFromERC20(buyTokenOrders, totalSellAmount);
                const aliceTokens = await factory.tokensOf(alice.address);

                // bob buys WETH to purchase the NFT
                mockWETH.connect(bob).approve(factory.address, totalSellAmount.add(expectedFee));
                await mockWETH.connect(bob).deposit({ value: totalSellAmount.add(expectedFee) });

                await createNFTFromERC20(buyTokenOrders, totalSellAmount, bob, aliceTokens[0]);

                // check if NFT was created
                const bobTokens = await factory.tokensOf(bob.address);
                expect(bobTokens.length).to.equal(1);

                // check that fees were taken (2 NFT bought = 2x expectedFee)
                expect(await mockWETH.balanceOf(feeTo.address)).to.equal(expectedFee.mul(2));

                // check that alice has been assigned royalties.
                // Should be 10% of the fee based on weights given to FeeSplitter
                expect(await feeTo.getAmountDue(alice.address, mockWETH.address)).to.equal(expectedFee.div(10));
            });

            it("creates a NFT where sellToken is one of the assets", async () => {
                const abi = ["function transferFromFactory(address _token, uint256 _amount)"];
                const iface = new Interface(abi);

                const wethBuyAmount = appendDecimals(1);
                const expectedFee = totalSellAmount.add(wethBuyAmount).div(100);
                const totalSpending = totalSellAmount.add(wethBuyAmount).add(expectedFee);
                mockWETH.approve(factory.address, totalSpending);
                await mockWETH.deposit({ value: totalSpending });

                const _buyTokenOrders = [
                    ...buyTokenOrders,
                    {
                        token: mockWETH.address,
                        callData: iface.encodeFunctionData("transferFromFactory", [mockWETH.address, wethBuyAmount]),
                    },
                ];

                const tx = await createNFTFromERC20(_buyTokenOrders, totalSellAmount.add(wethBuyAmount));
                await tx.wait();

                const [nftId] = await factory.tokensOf(alice.address);
                const holdings = await factory.tokenHoldings(nftId);
                expect(holdings[2].token).to.equal(mockWETH.address);
                expect(holdings[2].amount).to.equal(appendDecimals(1));
            });

            describe("VIP tiers", () => {
                it("should revert when setting invalid VIP discount", async () => {
                    await expect(factory.setVipDiscount(1000, 0)).to.be.revertedWith("DISCOUNT_TOO_HIGH");
                    await expect(factory.setVipDiscount(1001, 0)).to.be.revertedWith("DISCOUNT_TOO_HIGH");
                });

                it("sets the discount and min vip amount", async () => {
                    await factory.setVipDiscount(250, 10);
                    expect(await factory.vipDiscount()).to.equal(250);
                    expect(await factory.vipMinAmount()).to.equal(10);
                });

                it("should revert when setting an invalid smart chef contract", async () => {
                    await expect(factory.setSmartChef(ethers.constants.AddressZero)).to.be.revertedWith(
                        "INVALID_SMARTCHEF_ADDRESS",
                    );
                });

                it("should emit VipDiscountChanged event", async () => {
                    await expect(factory.setVipDiscount(250, 10))
                        .to
                        .emit(factory, "VipDiscountChanged")
                        .withArgs(250, 10);
                })

                it("should set the SmartChef address", async () => {
                    await factory.setSmartChef(alice.address);
                    expect(await factory.smartChef()).to.equal(alice.address);
                });

                it("applies a discount to a VIP user", async () => {
                    const mockSmartChefFactory = await ethers.getContractFactory("MockSmartChef");
                    const mockSmartChefVIP = await mockSmartChefFactory.deploy(appendDecimals(500));

                    await mockWETH.deposit({ value: totalSellAmount.add(totalSellAmount.div(100)) });
                    await mockWETH.approve(factory.address, totalSellAmount.add(totalSellAmount.div(100)));

                    await factory.setSmartChef(mockSmartChefVIP.address);
                    const balanceBefore = await mockWETH.balanceOf(alice.address);
                    await createNFTFromERC20(buyTokenOrders, totalSellAmount);
                    const balanceAfter = await mockWETH.balanceOf(alice.address);

                    // 50% discount applied. Fee 0.5% instead of 1%
                    expect(balanceBefore.sub(balanceAfter)).to.equal(totalSellAmount.add(totalSellAmount.div(200)));
                });
            });
        });

        describe("creating from ETH", async () => {
            it("reverts if insufficient funds sent in the transaction", async () => {
                await expect(
                    createNFTFromETH(buyTokenOrders, totalSellAmount, totalSellAmount.add(expectedFee).sub(1)),
                ).to.be.revertedWith("INSUFFICIENT_AMOUNT_IN");
            });

            // TODO: figure out why we can't calculate gas spending for alice
            it("creates the NFT", async () => {
                const initialBobBalance = await bob.getBalance();
                const tx = await createNFTFromETH(
                    buyTokenOrders,
                    totalSellAmount,
                    totalSellAmount.add(expectedFee),
                    bob,
                );

                const expectedBobBalance = initialBobBalance
                    .sub(totalSellAmount)
                    .sub(expectedFee)
                    .sub(await getETHSpentOnGas(tx));

                expect(await bob.getBalance()).to.equal(expectedBobBalance);
                expect(await mockWETH.balanceOf(factory.feeTo())).to.equal(expectedFee.toString());

                // check if NFT was created
                const bobTokens = await factory.tokensOf(bob.address);
                expect(bobTokens.length).to.equal(1);

                // check number of assets in NFT token
                const result = await factory.tokenHoldings(bobTokens[0]);
                expect(result.length).to.equal(buyTokenOrders.length);
                expect(result[0].isActive).to.equal(true);

                // check that fees were taken
                expect(await mockWETH.balanceOf(feeTo.address)).to.equal(expectedFee);
            });
        });
    });


    // ⚠️⚠️⚠️ TODO Refactor this file ⚠️⚠️⚠️ 
    // We need to build a test factory to create NFTs easily.  -> DRY

    describe("#update", () => {
        const totalSellAmount = appendDecimals(10);
        let tokensToBuy: string[] = [];
        let tokensToAdd: string[] = [];
        let buyTokenOrders: TokenOrder[] = [];
        let addTokenOrders: TokenOrder[] = [];
        const expectedFee = totalSellAmount.div(100);
        let assets: string[] = [];

        beforeEach(async () => {
            const mockERC20Factory = await ethers.getContractFactory("MockERC20");
            mockUNI = await mockERC20Factory.deploy("Mocked UNI", "INU", appendDecimals(3000000));
            mockKNC = await mockERC20Factory.deploy("Mocked KNC", "CNK", appendDecimals(3000000));
            mockDAI = await mockERC20Factory.deploy("Mocked DAI", "IAD", appendDecimals(3000000));

            mockUNI.transfer(dummyRouter.address, appendDecimals(1000));
            mockKNC.transfer(dummyRouter.address, appendDecimals(1000));
            mockDAI.transfer(dummyRouter.address, appendDecimals(1000));

            tokensToBuy = [mockUNI.address, mockKNC.address];
            tokensToAdd = [mockUNI.address, mockDAI.address];

            mockWETH.approve(factory.address, totalSellAmount.add(expectedFee));
            await mockWETH.deposit({ value: totalSellAmount.add(expectedFee) });

            const abi = ["function dummyswapToken(address _inputToken, address _outputToken, uint256 _amount)"];
            const iface = new Interface(abi);

            addTokenOrders = [
                {
                    token: tokensToAdd[0],
                    callData: iface.encodeFunctionData("dummyswapToken", [
                        mockWETH.address,
                        tokensToAdd[0],
                        appendDecimals(4),
                    ]),
                },
                {
                    token: tokensToAdd[1],
                    callData: iface.encodeFunctionData("dummyswapToken", [
                        mockWETH.address,
                        tokensToAdd[1],
                        appendDecimals(6),
                    ]),
                },
            ];

            buyTokenOrders = [
                {
                    token: tokensToBuy[0],
                    callData: iface.encodeFunctionData("dummyswapToken", [
                        mockWETH.address,
                        tokensToBuy[0],
                        appendDecimals(4),
                    ]),
                },
                {
                    token: tokensToBuy[1],
                    callData: iface.encodeFunctionData("dummyswapToken", [
                        mockWETH.address,
                        tokensToBuy[1],
                        appendDecimals(6),
                    ]),
                },
            ];

            await mockWETH.deposit({ value: appendDecimals(10.1) });
            await createNFTFromETH(buyTokenOrders, totalSellAmount, totalSellAmount.add(expectedFee));
            assets = await factory.tokensOf(alice.address);
        });

        it("doesn't extract reserve funds with transfer", async () => {
            // The reserve has 1000 INU
            await mockUNI.transfer(reserve.address, appendDecimals(1000));

            await mockDAI.approve(factory.address, 10000);
            let inuBalanceBefore = await mockUNI.balanceOf(alice.address);

            const abi = ["function transfer(address _recipient, address _token, uint256 _amount)"];
            const iface = new Interface(abi);

            let exploitAddTokens: TokenOrder[] = [
                {
                    token: mockDAI.address,
                    callData: iface.encodeFunctionData("transfer", [alice.address, mockUNI.address, 1000]),
                },
            ];

            await expect(
                factory.addTokens(assets[0], mockDAI.address, 1, dummyRouter.address, exploitAddTokens),
            ).to.be.revertedWith("NOTHING_DEPOSITED");

            let inuBalanceAfter = await mockUNI.balanceOf(alice.address);
            let aliceExploit = inuBalanceAfter.sub(inuBalanceBefore);

            expect(aliceExploit).to.be.equal(BigNumber.from(0));
        });

        it("doesn't disrupt the protocol using withdraw", async () => {
            // The reserve has 1000 INU
            await mockUNI.transfer(reserve.address, appendDecimals(1000));

            await mockDAI.approve(factory.address, 10000);
            let inuBalanceBefore = await mockUNI.balanceOf(factory.address);

            const abi = ["function withdraw(address _token, uint256 _amount)"];
            const iface = new Interface(abi);

            let exploitAddTokens: TokenOrder[] = [
                {
                    token: mockDAI.address,
                    callData: iface.encodeFunctionData("withdraw", [mockUNI.address, 1000]),
                },
            ];

            await expect(
                factory.addTokens(assets[0], mockDAI.address, 1, dummyRouter.address, exploitAddTokens),
            ).to.be.revertedWith("NOTHING_DEPOSITED");

            let inuBalanceAfter = await mockUNI.balanceOf(factory.address);
            let aliceExploit = inuBalanceAfter.sub(inuBalanceBefore);

            // Alice moved INU in the factory... Funds are lost
            expect(aliceExploit).to.be.equal(BigNumber.from(0));
        });

        it("reverts if token id is invalid", async () => {
            await expect(
                factory.addTokens(
                    ethers.utils.parseEther("999").toString(),
                    mockWETH.address,
                    totalSellAmount,
                    dummyRouter.address,
                    addTokenOrders,
                ),
            ).to.be.revertedWith("ERC721: owner query for nonexistent token");
        });

        it("reverts if insufficient amount", async () => {
            await expect(
                factory.addTokens(
                    assets[0],
                    mockWETH.address,
                    totalSellAmount.sub(1),
                    dummyRouter.address,
                    addTokenOrders,
                ),
            ).to.be.revertedWith("OVERSPENT_ERROR");
        });

        it("reverts if not owner", async () => {
            await expect(
                factory
                    .connect(bob)
                    .addTokens(assets[0], mockWETH.address, totalSellAmount, dummyRouter.address, addTokenOrders),
            ).to.be.revertedWith("NOT_TOKEN_OWNER");
        });

        it("updates NFT", async () => {
            const initialWethBalance = await mockWETH.balanceOf(alice.address);
            const initialFeeBalance = await mockWETH.balanceOf(factory.feeTo());

            await factory.addTokens(assets[0], mockWETH.address, totalSellAmount, dummyRouter.address, addTokenOrders);

            const expectedAliceWethBalance = initialWethBalance.sub(totalSellAmount).sub(expectedFee);
            const expectedFeeWethBalance = initialFeeBalance.add(expectedFee);

            expect(await mockWETH.balanceOf(alice.address)).to.equal(expectedAliceWethBalance);
            expect(await mockWETH.balanceOf(factory.feeTo())).to.equal(expectedFeeWethBalance);

            let tokenHoldings = await factory.tokenHoldings(assets[0]);
            expect(tokenHoldings[0].amount).to.equal(appendDecimals(8));
        });

        it("adds a token without doing a swap", async () => {
            const initialAliceBalance = await alice.getBalance();

            const abi = ["function transferFromFactory(address _token, uint256 _amount)"];
            const iface = new Interface(abi);

            const tx = await factory.addTokens(
                assets[0],
                mockWETH.address,
                appendDecimals(1),
                ethers.constants.AddressZero,
                [
                    {
                        token: mockWETH.address,
                        callData: iface.encodeFunctionData("transferFromFactory", [
                            mockWETH.address,
                            appendDecimals(1),
                        ]),
                    },
                ],
                {
                    value: appendDecimals(1 + 0.01), // Buy 1 WETH + 1% fee
                },
            );
            await tx.wait();

            const expectedAliceBalance = initialAliceBalance
                .sub(appendDecimals(1 + 0.01))
                .sub(await getETHSpentOnGas(tx));
            expect(await alice.getBalance()).to.equal(expectedAliceBalance);

            let tokenHoldings = await factory.tokenHoldings(assets[0]);
            expect(tokenHoldings[2].amount).to.equal(appendDecimals(1));
            expect(await mockWETH.balanceOf(reserve.address)).to.equal(appendDecimals(1));
        });

        it("updates NFT with ETH", async () => {
            const initialWethBalance = await mockWETH.balanceOf(alice.address);
            const initialFeeBalance = await mockWETH.balanceOf(factory.feeTo());
            const initialAliceBalance = await alice.getBalance();

            const tx = await factory.addTokens(
                assets[0],
                "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
                appendDecimals(10),
                dummyRouter.address,
                addTokenOrders,
                {
                    value: totalSellAmount.add(expectedFee),
                },
            );

            const expectedAliceBalance = initialAliceBalance
                .sub(totalSellAmount.add(expectedFee))
                .sub(await getETHSpentOnGas(tx));

            expect(await alice.getBalance()).to.equal(expectedAliceBalance);

            const expectedFeeWethBalance = initialFeeBalance.add(expectedFee);
            expect(await mockWETH.balanceOf(factory.feeTo())).to.equal(expectedFeeWethBalance);

            let tokenHoldings = await factory.tokenHoldings(assets[0]);
            expect(tokenHoldings[0].amount).to.equal(appendDecimals(8));
        });
    });

    describe("#swapTokenForTokens", () => {
        const totalSellAmount = appendDecimals(10);
        let tokensToBuy: string[] = [];
        let tokensToSwap: string[] = [];
        let buyTokenOrders: TokenOrder[] = [];
        let swapTokenOrders: TokenOrder[] = [];
        const expectedFee = totalSellAmount.div(100);
        let assets: string[] = [];

        beforeEach(async () => {
            const mockERC20Factory = await ethers.getContractFactory("MockERC20");
            mockUNI = await mockERC20Factory.deploy("Mocked UNI", "INU", appendDecimals(3000000));
            mockKNC = await mockERC20Factory.deploy("Mocked KNC", "CNK", appendDecimals(3000000));
            mockDAI = await mockERC20Factory.deploy("Mocked DAI", "IAD", appendDecimals(3000000));

            mockUNI.transfer(dummyRouter.address, appendDecimals(1000));
            mockKNC.transfer(dummyRouter.address, appendDecimals(1000));
            mockDAI.transfer(dummyRouter.address, appendDecimals(1000));

            tokensToBuy = [mockUNI.address, mockKNC.address];
            tokensToSwap = [mockDAI.address];

            mockWETH.approve(factory.address, appendDecimals(10.1));
            await mockWETH.deposit({ value: appendDecimals(10.1) });

            const abi = ["function dummyswapToken(address _inputToken, address _outputToken, uint256 _amount)"];
            const iface = new Interface(abi);

            swapTokenOrders = [
                {
                    token: tokensToSwap[0],
                    callData: iface.encodeFunctionData("dummyswapToken", [
                        tokensToBuy[0],
                        tokensToSwap[0],
                        appendDecimals(2).sub(appendDecimals(2).div(100)),
                    ]),
                },
            ];

            buyTokenOrders = [
                {
                    token: tokensToBuy[0],
                    callData: iface.encodeFunctionData("dummyswapToken", [
                        mockWETH.address,
                        tokensToBuy[0],
                        appendDecimals(4),
                    ]),
                },
                {
                    token: tokensToBuy[1],
                    callData: iface.encodeFunctionData("dummyswapToken", [
                        mockWETH.address,
                        tokensToBuy[1],
                        appendDecimals(6),
                    ]),
                },
            ];

            await mockWETH.deposit({ value: totalSellAmount.add(expectedFee) });
            await createNFTFromETH(buyTokenOrders, totalSellAmount, totalSellAmount.add(expectedFee));
            assets = await factory.tokensOf(alice.address);
        });

        it("reverts if token id is invalid", async () => {
            await expect(
                factory.swapTokenForTokens(
                    ethers.utils.parseEther("999").toString(),
                    tokensToBuy[0],
                    appendDecimals(2),
                    dummyRouter.address,
                    swapTokenOrders,
                ),
            ).to.be.revertedWith("ERC721: owner query for nonexistent token");
        });

        it("reverts if not owner", async () => {
            await expect(
                factory
                    .connect(bob)
                    .swapTokenForTokens(
                        assets[0],
                        tokensToBuy[0],
                        appendDecimals(2),
                        dummyRouter.address,
                        swapTokenOrders,
                    ),
            ).to.be.revertedWith("NOT_TOKEN_OWNER");
        });

        it("reverts if insufficient amount", async () => {
            await expect(
                factory.swapTokenForTokens(
                    assets[0],
                    tokensToBuy[0],
                    appendDecimals(50),
                    dummyRouter.address,
                    swapTokenOrders,
                ),
            ).to.be.revertedWith("INSUFFICIENT_AMOUNT");
        });

        it("swap an NFT asset", async () => {
            let tokenHoldings = await factory.tokenHoldings(assets[0]);
            let initialUNI = tokenHoldings[0].amount;
            let swapAmount = appendDecimals(2);

            await factory.swapTokenForTokens(
                assets[0],
                tokensToBuy[0],
                swapAmount,
                dummyRouter.address,
                swapTokenOrders,
            );

            tokenHoldings = await factory.tokenHoldings(assets[0]);
            let currentUNI = tokenHoldings[0].amount;

            expect(currentUNI).to.equal(initialUNI.sub(swapAmount));
        });
    });

    describe("#sellTokensToNft", () => {
        const totalSellAmount = appendDecimals(10);
        let tokenToBuy: string;
        let tokensToSwap: string[] = [];
        let buyTokenOrders: TokenOrder[] = [];
        let swapTokenOrders: TokenOrder[] = [];
        const expectedFee = totalSellAmount.div(100);
        let assets: string[] = [];
        const swapAmountUNI = appendDecimals(2);
        const swapAmountKNC = appendDecimals(3);

        beforeEach(async () => {
            const mockERC20Factory = await ethers.getContractFactory("MockERC20");
            mockUNI = await mockERC20Factory.deploy("Mocked UNI", "INU", appendDecimals(3000000));
            mockKNC = await mockERC20Factory.deploy("Mocked KNC", "CNK", appendDecimals(3000000));
            mockDAI = await mockERC20Factory.deploy("Mocked DAI", "IAD", appendDecimals(3000000));

            mockUNI.transfer(dummyRouter.address, appendDecimals(1000));
            mockKNC.transfer(dummyRouter.address, appendDecimals(1000));
            mockDAI.transfer(dummyRouter.address, appendDecimals(1000));

            tokensToSwap = [mockUNI.address, mockKNC.address];
            tokenToBuy = mockWETH.address;

            mockWETH.approve(factory.address, appendDecimals(10.1));
            await mockWETH.deposit({ value: appendDecimals(10.1) });

            const abi = ["function dummyswapToken(address _inputToken, address _outputToken, uint256 _amount)"];
            const iface = new Interface(abi);

            swapTokenOrders = [
                {
                    token: tokensToSwap[0],
                    callData: iface.encodeFunctionData("dummyswapToken", [
                        tokensToSwap[0],
                        tokenToBuy,
                        swapAmountUNI,
                    ]),
                },
                {
                    token: tokensToSwap[1],
                    callData: iface.encodeFunctionData("dummyswapToken", [
                        tokensToSwap[1],
                        tokenToBuy,
                        swapAmountKNC,
                    ]),
                },
            ];

            // Buying two times more tokens than we will swap
            buyTokenOrders = [
                {
                    token: tokensToSwap[0],
                    callData: iface.encodeFunctionData("dummyswapToken", [
                        tokenToBuy,
                        tokensToSwap[0],
                        swapAmountUNI.mul(2),
                    ]),
                },
                {
                    token: tokensToSwap[1],
                    callData: iface.encodeFunctionData("dummyswapToken", [
                        tokenToBuy,
                        tokensToSwap[1],
                        swapAmountKNC.mul(2),
                    ]),
                },
            ];

            await mockWETH.deposit({ value: totalSellAmount.add(expectedFee) });
            await createNFTFromETH(buyTokenOrders, totalSellAmount, totalSellAmount.add(expectedFee));
            assets = await factory.tokensOf(alice.address);
        });

        it("reverts if token id is invalid", async () => {
            await expect(
                factory.sellTokensToNft(
                    ethers.utils.parseEther("999").toString(),
                    tokenToBuy,
                    [swapAmountUNI, swapAmountKNC],
                    dummyRouter.address,
                    swapTokenOrders,
                ),
            ).to.be.revertedWith("ERC721: owner query for nonexistent token");
        });

        it("reverts if not owner", async () => {
            await expect(
                factory
                    .connect(bob)
                    .sellTokensToNft(
                        assets[0],
                        tokenToBuy,
                        [swapAmountUNI, swapAmountKNC],
                        dummyRouter.address,
                        swapTokenOrders,
                    ),
            ).to.be.revertedWith("NOT_TOKEN_OWNER");
        });

        it("reverts if insufficient amount", async () => {
            await expect(
                factory.sellTokensToNft(
                    assets[0],
                    tokenToBuy,
                    [swapAmountUNI.mul(2).add(1), swapAmountKNC],
                    dummyRouter.address,
                    swapTokenOrders,
                ),
            ).to.be.revertedWith("INSUFFICIENT_AMOUNT");
        });

        it("swap the tokens", async () => {
            let tokenHoldings = await factory.tokenHoldings(assets[0]);

            await factory.sellTokensToNft(
                assets[0],
                tokenToBuy,
                [swapAmountUNI, swapAmountKNC],
                dummyRouter.address,
                swapTokenOrders,
            );

            tokenHoldings = await factory.tokenHoldings(assets[0]);
            expect(tokenHoldings.length).to.equal(3);
            let currentUNI = tokenHoldings[0].amount;
            let currentKNC = tokenHoldings[1].amount;
            let currentWETH = tokenHoldings[2].amount;

            expect(currentUNI).to.equal(swapAmountUNI);
            expect(currentKNC).to.equal(swapAmountKNC);
            expect(currentWETH).to.equal(swapAmountUNI.add(swapAmountKNC).mul(99).div(100));
        });
    });

    describe("#sellTokensToWallet", () => {
        const totalSellAmount = appendDecimals(11);
        let tokensToBuy: string[] = [];
        let tokensToSell: string[] = [];
        let buyTokenOrders: TokenOrder[] = [];
        let sellTokenOrders: TokenOrder[] = [];
        const expectedFee = totalSellAmount.div(100);
        let assets: string[] = [];

        beforeEach(async () => {
            const mockERC20Factory = await ethers.getContractFactory("MockERC20");
            mockUNI = await mockERC20Factory.deploy("Mocked UNI", "INU", appendDecimals(3000000));
            mockKNC = await mockERC20Factory.deploy("Mocked KNC", "CNK", appendDecimals(3000000));
            mockDAI = await mockERC20Factory.deploy("Mocked DAI", "IAD", appendDecimals(3000000));

            mockUNI.transfer(dummyRouter.address, appendDecimals(1000));
            mockKNC.transfer(dummyRouter.address, appendDecimals(1000));
            mockDAI.transfer(dummyRouter.address, appendDecimals(1000));

            tokensToBuy = [mockUNI.address, mockKNC.address, mockWETH.address];
            tokensToSell = [mockUNI.address, mockKNC.address, mockWETH.address];

            mockWETH.approve(factory.address, totalSellAmount.add(expectedFee));
            await mockWETH.deposit({ value: totalSellAmount.add(expectedFee) });

            const abi = [
                "function dummyswapToken(address _inputToken, address _outputToken, uint256 _amount)",
                "function transferFromFactory(address _token, uint256 _amount)",
            ];
            const iface = new Interface(abi);

            sellTokenOrders = [
                {
                    token: mockUNI.address,
                    callData: iface.encodeFunctionData("dummyswapToken", [
                        tokensToSell[0],
                        mockWETH.address,
                        appendDecimals(2),
                    ]),
                },
                {
                    token: mockKNC.address,
                    callData: iface.encodeFunctionData("dummyswapToken", [
                        tokensToSell[1],
                        mockWETH.address,
                        appendDecimals(3),
                    ]),
                },
                {
                    token: mockWETH.address,
                    callData: [],
                },
            ];

            buyTokenOrders = [
                {
                    token: tokensToBuy[0],
                    callData: iface.encodeFunctionData("dummyswapToken", [
                        mockWETH.address,
                        tokensToBuy[0],
                        appendDecimals(4),
                    ]),
                },
                {
                    token: tokensToBuy[1],
                    callData: iface.encodeFunctionData("dummyswapToken", [
                        mockWETH.address,
                        tokensToBuy[1],
                        appendDecimals(6),
                    ]),
                },
                {
                    token: mockWETH.address,
                    callData: iface.encodeFunctionData("transferFromFactory", [mockWETH.address, appendDecimals(1)]),
                },
            ];

            await mockWETH.deposit({ value: appendDecimals(11.1) });
            await createNFTFromETH(buyTokenOrders, totalSellAmount, totalSellAmount.add(expectedFee));
            assets = await factory.tokensOf(alice.address);
        });

        it("reverts if token id is invalid", async () => {
            await expect(
                factory.sellTokensToWallet(
                    ethers.utils.parseEther("999").toString(),
                    mockWETH.address,
                    [appendDecimals(4), appendDecimals(2), appendDecimals(1)],
                    dummyRouter.address,
                    sellTokenOrders,
                ),
            ).to.be.revertedWith("ERC721: owner query for nonexistent token");
        });

        it("reverts if not owner", async () => {
            await expect(
                factory
                    .connect(bob)
                    .sellTokensToWallet(
                        assets[0],
                        mockWETH.address,
                        [appendDecimals(4), appendDecimals(2), appendDecimals(1)],
                        dummyRouter.address,
                        sellTokenOrders,
                    ),
            ).to.be.revertedWith("NOT_TOKEN_OWNER");
        });

        it("reverts if insufficient amount", async () => {
            await expect(
                factory.sellTokensToWallet(
                    assets[0],
                    mockWETH.address,
                    [appendDecimals(50), appendDecimals(50), appendDecimals(1)],
                    dummyRouter.address,
                    sellTokenOrders,
                ),
            ).to.be.revertedWith("INSUFFICIENT_AMOUNT");
        });

        it("sell NFT assets", async () => {
            const prevTokenHoldings = await factory.tokenHoldings(assets[0]);
            const initialUNI = prevTokenHoldings[0].amount;
            const initialKNC = prevTokenHoldings[1].amount;
            const initialWETH = prevTokenHoldings[2].amount;

            await factory.sellTokensToWallet(
                assets[0],
                mockWETH.address,
                [appendDecimals(2), appendDecimals(3), appendDecimals(1)],
                dummyRouter.address,
                sellTokenOrders,
            );

            const nextTokenHoldings = await factory.tokenHoldings(assets[0]);
            const currentUNI = nextTokenHoldings[0].amount;
            const currentKNC = nextTokenHoldings[1].amount;

            expect(currentUNI).to.equal(initialUNI.sub(appendDecimals(2)));
            expect(currentKNC).to.equal(initialKNC.sub(appendDecimals(3)));
            expect(nextTokenHoldings[2]).to.be.undefined;
        });

        it("sell NFT assets with currency different than WETH", async () => {
            const abi = ["function dummyswapToken(address _inputToken, address _outputToken, uint256 _amount)"];
            const iface = new Interface(abi);

            const _sellTokenOrders = [
                {
                    token: mockUNI.address,
                    callData: iface.encodeFunctionData("dummyswapToken", [
                        tokensToSell[0],
                        mockKNC.address,
                        appendDecimals(2),
                    ]),
                },
                {
                    token: mockKNC.address,
                    callData: [] as [],
                },
                {
                    token: mockWETH.address,
                    callData: iface.encodeFunctionData("dummyswapToken", [
                        tokensToSell[2],
                        mockKNC.address,
                        appendDecimals(1),
                    ]),
                },
            ];

            await factory.sellTokensToWallet(
                assets[0],
                mockKNC.address,
                [appendDecimals(4), appendDecimals(6), appendDecimals(1)],
                dummyRouter.address,
                _sellTokenOrders,
            );
            const holdings = await factory.tokenHoldings(assets[0]);
            expect(holdings).to.be.empty;
        });

        it("sell NFT assets including automatically unwrapped WETH", async () => {
            const abi = ["function transferFromFactory(address _token, uint256 _amount)"];
            const iface = new Interface(abi);

            const wethBuyAmount = appendDecimals(1);

            await factory.addTokens(assets[0], mockWETH.address, appendDecimals(1), dummyRouter.address, [
                {
                    token: mockWETH.address,
                    callData: iface.encodeFunctionData("transferFromFactory", [mockWETH.address, wethBuyAmount]),
                },
            ]);
            const initialEthBalance = await alice.getBalance();

            const tx = await factory.sellTokensToWallet(
                assets[0],
                mockWETH.address,
                [appendDecimals(2), appendDecimals(3), wethBuyAmount],
                dummyRouter.address,
                sellTokenOrders,
            );
            const txSpent = await getETHSpentOnGas(tx);

            // sale amount should be 2ETH + 3ETH + 1ETH - 1% Fee
            expect(await alice.getBalance()).to.equal(
                initialEthBalance.add(appendDecimals(6).sub(appendDecimals(6).div(100))).sub(txSpent),
            );
        });
    });

    describe("#destroy", () => {
        const amountUni = 4;
        const amountKnc = 6;
        const totalSellAmount = appendDecimals(amountUni + amountKnc);
        let tokensToBuy: string[] = [];
        let sellTokenOrders: TokenOrder[] = [];
        let buyTokenOrders: TokenOrder[] = [];
        const expectedFee = totalSellAmount.div(100);
        let assets: string[] = [];

        beforeEach(async () => {
            const mockERC20Factory = await ethers.getContractFactory("MockERC20");
            mockUNI = await mockERC20Factory.deploy("Mocked UNI", "INU", appendDecimals(3000000));
            mockKNC = await mockERC20Factory.deploy("Mcoked KNC", "CNK", appendDecimals(3000000));

            mockUNI.transfer(dummyRouter.address, appendDecimals(1000));
            mockKNC.transfer(dummyRouter.address, appendDecimals(1000));

            tokensToBuy = [mockUNI.address, mockKNC.address];

            const abi = ["function dummyswapToken(address _inputToken, address _outputToken, uint256 _amount)"];
            const iface = new Interface(abi);

            sellTokenOrders = [
                {
                    token: tokensToBuy[0],
                    callData: iface.encodeFunctionData("dummyswapToken", [
                        tokensToBuy[0],
                        mockWETH.address,
                        appendDecimals(amountUni),
                    ]),
                },
                {
                    token: tokensToBuy[1],
                    callData: iface.encodeFunctionData("dummyswapToken", [
                        tokensToBuy[1],
                        mockWETH.address,
                        appendDecimals(amountKnc),
                    ]),
                },
            ];

            buyTokenOrders = [
                {
                    token: tokensToBuy[0],
                    callData: iface.encodeFunctionData("dummyswapToken", [
                        mockWETH.address,
                        tokensToBuy[0],
                        appendDecimals(amountUni),
                    ]),
                },
                {
                    token: tokensToBuy[1],
                    callData: iface.encodeFunctionData("dummyswapToken", [
                        mockWETH.address,
                        tokensToBuy[1],
                        appendDecimals(amountKnc),
                    ]),
                },
            ];

            await mockWETH.deposit({ value: totalSellAmount.add(expectedFee) });
            await createNFTFromETH(buyTokenOrders, totalSellAmount, totalSellAmount.add(expectedFee));
            assets = await factory.tokensOf(alice.address);
        });

        it("reverts preventing reentrancy", async () => {
            const abi = ["function reentrancyAttackForDestroy(uint256)"];
            const iface = new Interface(abi);

            const attackOrder = {
                token: tokensToBuy[0],
                callData: iface.encodeFunctionData("reentrancyAttackForDestroy", [2]),
            };
            const attackOrders = [attackOrder, attackOrder];
            await dummyRouter.prepareAttack(factory.address, mockWETH.address, buyTokenOrders, attackOrders, {
                value: appendDecimals(11),
            });
            // reentrancy guard will activate and tokens will be failsafe withdrawn automatically
            dummyRouter.reentrancyAttackForDestroy(2);

            const feeInKNC = appendDecimals(6).div(100);
            expect(await mockKNC.balanceOf(dummyRouter.address)).to.equal(
                appendDecimals(1000).sub(appendDecimals(6)).sub(feeInKNC),
            );
            expect((await factory.tokensOf(dummyRouter.address)).length).to.equal(0);
        });

        describe("#destroyForERC20", () => {
            it("reverts if sell args missing", async () => {
                await expect(
                    factory.destroyForERC20(assets[0], mockWETH.address, dummyRouter.address, []),
                ).to.be.revertedWith("MISSING_SELL_ARGS");
            });

            it("destroys NFT and send ERC20 to user", async () => {
                const aliceTokensBefore = await factory.tokensOf(alice.address);
                expect(aliceTokensBefore.length).to.equal(1);
                await factory.destroyForERC20(assets[0], mockWETH.address, dummyRouter.address, sellTokenOrders);
                const aliceTokensAfter = await factory.tokensOf(alice.address);
                expect(aliceTokensAfter.length).to.equal(0);
            });

            it("destroys a NFT with an original token ID", async () => {
                const aliceTokens = await factory.tokensOf(alice.address);

                // bob buys WETH to purchase the NFT
                mockWETH.connect(bob).approve(factory.address, totalSellAmount.add(expectedFee));
                await mockWETH.connect(bob).deposit({ value: totalSellAmount.add(expectedFee) });

                await createNFTFromERC20(buyTokenOrders, totalSellAmount, bob, aliceTokens[0]);

                const [bobTokenId] = await factory.tokensOf(bob.address);
                await factory
                    .connect(bob)
                    .destroyForERC20(bobTokenId, mockWETH.address, dummyRouter.address, sellTokenOrders);

                // check that alice has been assigned royalties.
                // Should be twice 10% (createNFT + destroyNFT)
                expect(await feeTo.getAmountDue(alice.address, mockWETH.address)).to.equal(expectedFee.div(5));
            });
        });

        describe("#destroyForETH", () => {
            it("destroys NFT and send ETH to user", async () => {
                const balanceAliceBefore = await alice.getBalance();
                const tx = await factory.destroyForETH(assets[0], dummyRouter.address, sellTokenOrders);
                const txSpent = await getETHSpentOnGas(tx);
                const aliceTokens = await factory.tokensOf(alice.address);
                expect(aliceTokens.length).to.equal(0);
                const expectedBalance = balanceAliceBefore
                    .add(totalSellAmount)
                    .sub(totalSellAmount.div(100))
                    .sub(txSpent);
                expect(await alice.getBalance()).to.equal(expectedBalance);
            });
        });

        describe("#withdraw", () => {
            it("reverts if token index is invalid", async () => {
                // token address doesn't match
                await expect(factory.withdraw(assets[0], 1, mockUNI.address)).be.revertedWith("INVALID_TOKEN_INDEX");
                // index is out of bounds
                await expect(factory.withdraw(assets[0], 9, mockUNI.address)).be.revertedWith("INVALID_TOKEN_INDEX");
            });

            it("reverts if NFT has only one asset", async () => {
                await factory.withdraw(assets[0], 0, mockUNI.address);
                await expect(factory.withdraw(assets[0], 0, mockKNC.address)).be.revertedWith("ERR_EMPTY_NFT");
            });

            it("uses failsafe withdraw when swap fails", async () => {
                // corrupt swap call to make it fail
                const abi = ["function missing()"];
                const iface = new Interface(abi);
                sellTokenOrders[1].callData = iface.encodeFunctionData("missing");
                await factory.destroyForERC20(assets[0], mockWETH.address, dummyRouter.address, sellTokenOrders);
                const feeInKNC = appendDecimals(6).div(100);
                const initialKNCBalance = appendDecimals(3000000).sub(appendDecimals(1000));
                expect(await mockKNC.balanceOf(feeTo.address)).to.equal(feeInKNC);
                expect(await mockKNC.balanceOf(alice.address)).to.equal(
                    initialKNCBalance.add(appendDecimals(6).sub(feeInKNC)),
                );
                expect((await factory.tokensOf(alice.address)).length).to.equal(0);
            });
        });
    });

    describe("#setReserve", () => {
        it("sets the reserve", async () => {
            expect(await factory.reserve()).to.equal(reserve.address);
        });

        it("revers if the reserve is already set", async () => {
            await expect(factory.connect(alice).setReserve(newReserve.address)).to.be.revertedWith("RESERVE_IMMUTABLE");
        });

        it("reverts if the address is invalid", async () => {
            await expect(factory.setReserve("0x0000000000000000000000000000000000000000")).to.be.revertedWith(
                "INVALID_ADDRESS",
            );
        });
    });

    const createNFTFromERC20 = (
        tokenOrders: TokenOrder[],
        totalSellAmount: BigNumber,
        signer: SignerWithAddress = alice,
        originalTokenId: number = 0,
    ) =>
        factory
            .connect(signer)
            .create(originalTokenId, mockWETH.address, totalSellAmount, dummyRouter.address, tokenOrders);

    const createNFTFromETH = (
        tokenOrders: TokenOrder[],
        totalSellAmount: BigNumber,
        ethValue: BigNumber,
        signer: SignerWithAddress = alice,
    ) =>
        factory
            .connect(signer)
            .create(
                0,
                "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
                totalSellAmount,
                dummyRouter.address,
                tokenOrders,
                {
                    value: ethValue,
                },
            );

    interface TokenOrder {
        token: string;
        callData: string | [];
    }
});
