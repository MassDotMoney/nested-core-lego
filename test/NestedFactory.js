"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var chai_1 = require("chai");
//import ierc20Abi from "./../mocks/IERC20.json"
//import wethAbi from "./../mocks/IWETH.json"
var hardhat_1 = require("hardhat");
var abi_1 = require("@ethersproject/abi");
var helpers_1 = require("./helpers");
describe("NestedFactory", function () {
    var nestedFactory, factory;
    var alice, bob, feeToSetter, feeTo;
    var mockWETH, mockUNI, mockKNC;
    var dummyRouter;
    var metadataUri = "ipfs://bafybeiam5u4xc5527tv6ghlwamd6azfthmcuoa6uwnbbvqbtsyne4p7khq/metadata.json";
    before(function () { return __awaiter(void 0, void 0, void 0, function () {
        var signers, dummyRouterFactory;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, hardhat_1.ethers.getContractFactory("NestedFactory")];
                case 1:
                    nestedFactory = _a.sent();
                    return [4 /*yield*/, hardhat_1.ethers.getSigners()
                        // All transactions will be sent from Alice unless explicity specified
                    ];
                case 2:
                    signers = _a.sent();
                    // All transactions will be sent from Alice unless explicity specified
                    alice = signers[0];
                    bob = signers[1];
                    feeToSetter = signers[2];
                    feeTo = signers[2];
                    return [4 /*yield*/, hardhat_1.ethers.getContractFactory("DummyRouter")];
                case 3:
                    dummyRouterFactory = _a.sent();
                    return [4 /*yield*/, dummyRouterFactory.deploy()];
                case 4:
                    dummyRouter = _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    beforeEach(function () { return __awaiter(void 0, void 0, void 0, function () {
        var MockWETHFactory;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, nestedFactory.deploy(feeToSetter.address)];
                case 1:
                    factory = _a.sent();
                    return [4 /*yield*/, factory.deployed()];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, hardhat_1.ethers.getContractFactory("WETH9")];
                case 3:
                    MockWETHFactory = _a.sent();
                    return [4 /*yield*/, MockWETHFactory.deploy()];
                case 4:
                    mockWETH = _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    describe("#initialization", function () {
        it("deploys a reserve contract", function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/];
            });
        }); });
    });
    describe("#setFeeToSetter", function () {
        it("set feeToSetter state variable", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, factory.connect(feeToSetter).setFeeToSetter(bob.address)];
                    case 1:
                        _b.sent();
                        _a = chai_1.expect;
                        return [4 /*yield*/, factory.feeToSetter()];
                    case 2:
                        _a.apply(void 0, [_b.sent()]).to.equal(bob.address);
                        return [2 /*return*/];
                }
            });
        }); });
        it("reverts if unauthorized", function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, chai_1.expect(factory.connect(alice).setFeeToSetter(bob.address)).to.be.revertedWith("NestedFactory: FORBIDDEN")];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it("reverts if the address is invalid", function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, chai_1.expect(factory.connect(feeToSetter).setFeeToSetter("0x0000000000000000000000000000000000000000")).to.be.revertedWith("NestedFactory: INVALID_ADDRESS")];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe("#setFeeTo", function () {
        it("sets feeTo state variable", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, factory.connect(feeToSetter).setFeeTo(bob.address)];
                    case 1:
                        _b.sent();
                        _a = chai_1.expect;
                        return [4 /*yield*/, factory.feeTo()];
                    case 2:
                        _a.apply(void 0, [_b.sent()]).to.equal(bob.address);
                        return [2 /*return*/];
                }
            });
        }); });
        it("reverts if unauthorized", function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, chai_1.expect(factory.connect(alice).setFeeTo(bob.address)).to.be.revertedWith("NestedFactory: FORBIDDEN")];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it("reverts if the address is invalid", function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, chai_1.expect(factory.connect(feeToSetter).setFeeTo("0x0000000000000000000000000000000000000000")).to.be.revertedWith("NestedFactory: INVALID_ADDRESS")];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe("#create", function () {
        var totalSellAmount = helpers_1.appendDecimals(10);
        var tokensToBuy = [];
        var tokenOrders = [];
        var expectedFee = totalSellAmount.div(100);
        beforeEach(function () { return __awaiter(void 0, void 0, void 0, function () {
            var mockWETHFactory, mockERC20Factory, abi, iface;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, hardhat_1.ethers.getContractFactory("WETH9")];
                    case 1:
                        mockWETHFactory = _a.sent();
                        return [4 /*yield*/, mockWETHFactory.deploy()];
                    case 2:
                        mockWETH = _a.sent();
                        return [4 /*yield*/, hardhat_1.ethers.getContractFactory("MockERC20")];
                    case 3:
                        mockERC20Factory = _a.sent();
                        return [4 /*yield*/, mockERC20Factory.deploy("Mocked UNI", "INU", helpers_1.appendDecimals(3000000))];
                    case 4:
                        mockUNI = _a.sent();
                        return [4 /*yield*/, mockERC20Factory.deploy("Mcoked KNC", "CNK", helpers_1.appendDecimals(3000000))];
                    case 5:
                        mockKNC = _a.sent();
                        mockUNI.transfer(dummyRouter.address, helpers_1.appendDecimals(1000));
                        mockKNC.transfer(dummyRouter.address, helpers_1.appendDecimals(1000));
                        tokensToBuy = [mockUNI.address, mockKNC.address];
                        mockWETH.approve(factory.address, helpers_1.appendDecimals(10.1));
                        return [4 /*yield*/, mockWETH.deposit({ value: helpers_1.appendDecimals(10.1) })];
                    case 6:
                        _a.sent();
                        abi = ["function dummyswapToken(address _inputToken, address _outputToken, uint256 _amount)"];
                        iface = new abi_1.Interface(abi);
                        tokenOrders = [
                            {
                                token: tokensToBuy[0],
                                callData: iface.encodeFunctionData("dummyswapToken", [
                                    mockWETH.address,
                                    tokensToBuy[0],
                                    helpers_1.appendDecimals(4),
                                ])
                            },
                            {
                                token: tokensToBuy[1],
                                callData: iface.encodeFunctionData("dummyswapToken", [
                                    mockWETH.address,
                                    tokensToBuy[1],
                                    helpers_1.appendDecimals(6),
                                ])
                            },
                        ];
                        return [2 /*return*/];
                }
            });
        }); });
        it("reverts if tokenOrders list is empty", function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, chai_1.expect(factory.create(0, metadataUri, mockWETH.address, totalSellAmount.add(expectedFee), dummyRouter.address, [])).to.be.revertedWith("BUY_ARG_MISSING")];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        //     it("reverts if user had no allowance for sellToken", async () => {
        //         await tokenToSellContract
        //             .connect(bob)
        //             .deposit({ value: ethers.utils.parseEther("10").toString() })
        //         await expect(
        //             factory
        //                 .connect(bob)
        //                 .create(
        //                     0,
        //                     metadataUri,
        //                     tokenToSell,
        //                     totalSellAmount.add(expectedFee),
        //                     responses[0].data.to,
        //                     tokensToBuy,
        //                     swapCallData,
        //                 ),
        //         ).to.be.revertedWith("FUNDS_TRANSFER_ERROR")
        //     })
        it.only("reverts if the user does not have enough funds", function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, mockWETH.withdraw(1)];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, chai_1.expect(createNFTFromERC20(tokenOrders, totalSellAmount)).to.be.revertedWith("INSUFFICIENT_BALANCE")];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it.only("reverts if the sell amount is less than total sum of token sales", function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, chai_1.expect(createNFTFromERC20(tokenOrders, totalSellAmount.sub(1))).to.be.revertedWith("OVERSPENT_ERROR")];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        describe("creating from ERC20 tokens", function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                it("creates the NFT", function () { return __awaiter(void 0, void 0, void 0, function () {
                    var initialWethBalance, expectedAliceWethBalance, _a, _b, buyUNIAmount, buyKNCAmount, _c, _d, aliceTokens, result;
                    return __generator(this, function (_e) {
                        switch (_e.label) {
                            case 0: return [4 /*yield*/, mockWETH.balanceOf(alice.address)];
                            case 1:
                                initialWethBalance = _e.sent();
                                return [4 /*yield*/, createNFTFromERC20(tokenOrders, totalSellAmount)];
                            case 2:
                                _e.sent();
                                expectedAliceWethBalance = initialWethBalance.sub(totalSellAmount).sub(expectedFee);
                                _a = chai_1.expect;
                                return [4 /*yield*/, mockWETH.balanceOf(alice.address)];
                            case 3:
                                _a.apply(void 0, [_e.sent()]).to.equal(expectedAliceWethBalance.toString());
                                _b = chai_1.expect;
                                return [4 /*yield*/, mockWETH.balanceOf(factory.feeTo())];
                            case 4:
                                _b.apply(void 0, [_e.sent()]).to.equal(expectedFee.toString());
                                buyUNIAmount = helpers_1.appendDecimals(4);
                                buyKNCAmount = helpers_1.appendDecimals(6);
                                _c = chai_1.expect;
                                return [4 /*yield*/, mockUNI.balanceOf(factory.reserve())];
                            case 5:
                                _c.apply(void 0, [_e.sent()]).to.equal(buyUNIAmount);
                                _d = chai_1.expect;
                                return [4 /*yield*/, mockKNC.balanceOf(factory.reserve())];
                            case 6:
                                _d.apply(void 0, [_e.sent()]).to.equal(buyKNCAmount);
                                return [4 /*yield*/, factory.tokensOf(alice.address)];
                            case 7:
                                aliceTokens = _e.sent();
                                chai_1.expect(aliceTokens.length).to.equal(1);
                                return [4 /*yield*/, factory.tokenHoldings(aliceTokens[0])];
                            case 8:
                                result = _e.sent();
                                chai_1.expect(result.length).to.equal(tokenOrders.length);
                                return [2 /*return*/];
                        }
                    });
                }); });
                return [2 /*return*/];
            });
        }); });
        //     describe("creating from ETH", async () => {
        //         it("reverts if insufficient funds sent in the transaction", async () => {
        //             await expect(
        //                 factory.create(
        //                     0,
        //                     metadataUri,
        //                     tokenToSell,
        //                     0,
        //                     responses[0].data.to,
        //                     tokensToBuy,
        //                     swapCallData,
        //                     { value: totalSellAmount },
        //                 ),
        //             ).to.be.revertedWith("INSUFFICIENT_FUNDS")
        //         })
        //         it("creates the NFT", async () => {
        //             const feeToInitialBalance = await tokenToSellContract.balanceOf(feeTo.address)
        //             await tokenToSellContract.approve(factory.address, ethers.utils.parseEther("100").toString())
        //             await factory.create(
        //                 0,
        //                 metadataUri,
        //                 tokenToSell,
        //                 totalSellAmount.add(expectedFee),
        //                 responses[0].data.to,
        //                 tokensToBuy,
        //                 swapCallData,
        //                 { value: totalSellAmount.add(expectedFee) },
        //             )
        //             const uni = new ethers.Contract(orders[0].buyToken, abi, alice)
        //             const link = new ethers.Contract(orders[1].buyToken, abi, alice)
        //             const expectedAliceWethBalance = initialWethBalance.sub(totalSellAmount).sub(expectedFee)
        //             expect(await tokenToSellContract.balanceOf(alice.address)).to.equal(
        //                 expectedAliceWethBalance.toString(),
        //             )
        //             expect(await tokenToSellContract.balanceOf(factory.feeTo())).to.equal(
        //                 expectedFee.toString(),
        //             )
        //             let buyUniAmount = ethers.BigNumber.from(responses[0].data.buyAmount)
        //             let buyLinkAmount = ethers.BigNumber.from(responses[1].data.buyAmount)
        //             expect(await uni.balanceOf(factory.reserve())).to.be.closeTo(buyUniAmount, buyUniAmount.div(100))
        //             expect(await link.balanceOf(factory.reserve())).to.be.closeTo(
        //                 buyLinkAmount,
        //                 buyLinkAmount.div(100),
        //             )
        //             const feeToFinalBalance = await tokenToSellContract.balanceOf(feeTo.address)
        //             expect(feeToFinalBalance.sub(feeToInitialBalance)).to.be.equal(expectedFee)
        //             // check if NFT was created
        //             let aliceTokens = await factory.tokensOf(alice.address)
        //             expect(aliceTokens.length).to.equal(1)
        //             // check that Bob's balance did not increase
        //             let bobTokens = await factory.tokensOf(bob.address)
        //             expect(bobTokens.length).to.equal(0)
        //             // check number of assets in NFT token
        //             let result = await factory.tokenHoldings(aliceTokens[0])
        //             expect(result.length).to.equal(tokensToBuy.length)
        //         })
        //     })
        // })
        // describe("#destroy", () => {
        //     beforeEach(async () => {
        //         await factory.create(
        //             0,
        //             metadataUri,
        //             tokenToSell,
        //             totalSellAmount.add(expectedFee),
        //             responses[0].data.to,
        //             tokensToBuy,
        //             swapCallData,
        //             { value: totalSellAmount.add(expectedFee) },
        //         )
        //     })
        //     it("reverts if token id is invalid", async () => {
        //         await expect(factory.destroy(ethers.utils.parseEther("999").toString())).to.be.revertedWith(
        //             "revert ERC721: owner query for nonexistent token",
        //         )
        //     })
        //     it("reverts if not owner", async () => {
        //         let aliceTokens = await factory.tokensOf(alice.address)
        //         await expect(factory.connect(bob).destroy(aliceTokens[0])).to.be.revertedWith(
        //             "revert NestedFactory: Only Owner",
        //         )
        //     })
        //     it("destroys NFT and send tokens to user", async () => {
        //         let aliceTokens = await factory.tokensOf(alice.address)
        //         factory.destroy(aliceTokens[0])
        //         aliceTokens = await factory.tokensOf(alice.address)
        //         expect(aliceTokens.length).to.equal(0)
        //     })
        // })
        // describe("#destroyForERC20", () => {
        //     beforeEach(async () => {
        //         console.log(expectedFee)
        //         console.log(totalSellAmount)
        //         console.log(totalSellAmount.add(expectedFee))
        //         await factory.create(
        //             0,
        //             metadataUri,
        //             tokenToSell,
        //             totalSellAmount.add(expectedFee),
        //             responses[0].data.to,
        //             tokensToBuy,
        //             swapCallData,
        //             { value: totalSellAmount.add(expectedFee) },
        //         )
        //         assets = await factory.tokensOf(alice.address)
        //         let holdings = []
        //         for (let i = 0; i < assets.length; i++) {
        //             holdings = await factory.tokenHoldings(assets[i])
        //         }
        //         // getting 0x quote for each of the tokens
        //         quotes = []
        //         for (let i = 0; i < holdings.length; i++) {
        //             let holding = holdings[i]
        //             let order = {
        //                 sellToken: holding.token,
        //                 buyToken: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", // WETH
        //                 sellAmount: holding.amount.toString(),
        //                 slippagePercentage: 0.05,
        //             }
        //             let quote = await axios.get(`https://api.0x.org/swap/v1/quote?${qs.stringify(order)}`)
        //             quotes.push(quote)
        //         }
        //         tokensToSell = []
        //         swapData = []
        //         for (let i = 0; i < quotes.length; i++) {
        //             tokensToSell.push(quotes[i].data.sellTokenAddress)
        //             swapData.push(quotes[i].data.data)
        //         }
        //     })
        //     it("reverts if token id is invalid", async () => {
        //         await expect(
        //             factory.destroyForERC20(
        //                 ethers.utils.parseEther("999").toString(),
        //                 "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", // or quotes[0].data.buyTokenAddress -> WETH
        //                 quotes[0].data.to,
        //                 tokensToSell,
        //                 swapData,
        //             ),
        //         ).to.be.revertedWith("revert ERC721: owner query for nonexistent token")
        //     })
        //     it("reverts if not owner", async () => {
        //         await expect(
        //             factory.connect(bob).destroyForERC20(
        //                 assets[0],
        //                 "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", // or quotes[0].data.buyTokenAddress -> WETH
        //                 quotes[0].data.to,
        //                 tokensToSell,
        //                 swapData,
        //             ),
        //         ).to.be.revertedWith("revert NestedFactory: Only Owner")
        //     })
        //     it("reverts if sell args missing", async () => {
        //         await expect(
        //             factory.destroyForERC20(
        //                 assets[0],
        //                 "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", // or quotes[0].data.buyTokenAddress -> WETH
        //                 quotes[0].data.to,
        //                 [],
        //                 swapData,
        //             ),
        //         ).to.be.revertedWith("MISSING_SELL_ARGS")
        //     })
        //     it("destroys NFT and send ERC20 to user", async () => {
        //         let aliceTokens = await factory.tokensOf(alice.address)
        //         factory.destroyForERC20(
        //             assets[0],
        //             "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", // or quotes[0].data.buyTokenAddress -> WETH
        //             quotes[0].data.to,
        //             tokensToSell,
        //             swapData,
        //         )
        //         aliceTokens = await factory.tokensOf(alice.address)
        //         expect(aliceTokens.length).to.equal(0)
        //     })
        // })
        // describe("#destroyForETH", () => {
        //     beforeEach(async () => {
        //         await factory.create(
        //             0,
        //             metadataUri,
        //             tokenToSell,
        //             totalSellAmount.add(expectedFee),
        //             responses[0].data.to,
        //             tokensToBuy,
        //             swapCallData,
        //             { value: totalSellAmount.add(expectedFee) },
        //         )
        //         assets = await factory.tokensOf(alice.address)
        //         let holdings = []
        //         for (let i = 0; i < assets.length; i++) {
        //             holdings = await factory.tokenHoldings(assets[i])
        //         }
        //         // getting 0x quote for each of the tokens
        //         quotes = []
        //         for (let i = 0; i < holdings.length; i++) {
        //             let order = {
        //                 sellToken: holdings[i].token,
        //                 buyToken: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", // WETH
        //                 sellAmount: holdings[i].amount.toString(),
        //                 slippagePercentage: 0.05,
        //             }
        //             let quote = await axios.get(`https://api.0x.org/swap/v1/quote?${qs.stringify(order)}`)
        //             quotes.push(quote)
        //         }
        //         tokensToSell = []
        //         swapData = []
        //         for (let i = 0; i < quotes.length; i++) {
        //             tokensToSell.push(quotes[i].data.sellTokenAddress)
        //             swapData.push(quotes[i].data.data)
        //         }
        //     })
        //     it("reverts if token id is invalid", async () => {
        //         await expect(
        //             factory.destroyForETH(
        //                 ethers.utils.parseEther("999").toString(),
        //                 quotes[0].data.to,
        //                 tokensToSell,
        //                 swapData,
        //             ),
        //         ).to.be.revertedWith("revert ERC721: owner query for nonexistent token")
        //     })
        //     it("reverts if not owner", async () => {
        //         await expect(
        //             factory
        //                 .connect(bob)
        //                 .destroyForETH(assets[0], quotes[0].data.to, tokensToSell, swapData),
        //         ).to.be.revertedWith("revert NestedFactory: Only Owner")
        //     })
        //     it("reverts if sell args missing", async () => {
        //         await expect(
        //             factory.destroyForETH(assets[0], quotes[0].data.to, [], swapData),
        //         ).to.be.revertedWith("MISSING_SELL_ARGS")
        //     })
        //     it("destroys NFT and send ETH to user", async () => {
        //         let aliceTokens = await factory.tokensOf(alice.address)
        //         factory.destroyForETH(assets[0], quotes[0].data.to, tokensToSell, swapData)
        //         aliceTokens = await factory.tokensOf(alice.address)
        //         expect(aliceTokens.length).to.equal(0)
        //         // TODO: also check user and reserve balance
        //     })
    });
    var createNFTFromERC20 = function (tokenOrders, totalSellAmount, signer) {
        if (signer === void 0) { signer = alice; }
        return factory
            .connect(signer)
            .create(0, metadataUri, mockWETH.address, totalSellAmount, dummyRouter.address, tokenOrders);
    };
    var createNFTFromETH = function () { };
});
