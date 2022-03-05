import { waffle } from "hardhat";
import { smock } from "@defi-wonderland/smock";
import { config } from "hardhat";
import process from "process";

export const provider = waffle.provider;
export const createFixtureLoader = waffle.createFixtureLoader;

const chai = require("chai");
chai.use(smock.matchers);
export const expect = chai.expect;
export const assert = chai.assert;

export const describeOnBscFork = !config.networks.hardhat.forking.enabled  && process.env.FORK_CHAINID === "56" ? describe.skip : describe;
export const describeWithoutFork = config.networks.hardhat.forking.enabled ? describe.skip : describe;
