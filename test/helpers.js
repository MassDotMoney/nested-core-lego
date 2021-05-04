"use strict";
exports.__esModule = true;
exports.appendDecimals = void 0;
var hardhat_1 = require("hardhat");
var appendDecimals = function (amount) { return hardhat_1.ethers.utils.parseEther(amount.toString()); };
exports.appendDecimals = appendDecimals;
