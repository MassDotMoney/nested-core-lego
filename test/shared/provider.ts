import { waffle } from "hardhat";
import { smock } from "@defi-wonderland/smock";
import { config } from "hardhat";

export const provider = waffle.provider;
export const createFixtureLoader = waffle.createFixtureLoader;

const chai = require("chai");
chai.use(smock.matchers);
export const expect = chai.expect;
export const assert = chai.assert;

export const describeOnFork = !config.networks.hardhat.forking.enabled ? describe.skip : describe;
export const describeWithoutFork = config.networks.hardhat.forking.enabled ? describe.skip : describe;
