import { ethers, network } from "hardhat";

import { NetworkName } from "./demo-types";
import addresses from "./addresses.json";
import fs from "fs";

export async function main(timelockMinDelay: number, saveAddresses = false) {
    const env = network.name as NetworkName;
    const accounts = await ethers.getSigners();

    const dev = accounts[0].address;
    const nestedTreasury = accounts[1].address;
    const nestedBuyBacker = accounts[2].address;
    const weth = addresses[env].tokens.WETH;

    const nestedTreasuryPart = ethers.BigNumber.from("50");
    const nestedBuyBackerPart = ethers.BigNumber.from("30");
    const royaltiesPartPart = ethers.BigNumber.from("20");

    const maxHoldingsCount = 15

    const FeeSplitter = await ethers.getContractFactory("FeeSplitter")
    const NestedAsset = await ethers.getContractFactory("NestedAsset")
    const NestedRecords = await ethers.getContractFactory("NestedRecords")
    const NestedFactory = await ethers.getContractFactory("NestedFactory")
    const NestedReserve = await ethers.getContractFactory("NestedReserve")

    const feeSplitter = await FeeSplitter.deploy(
        [nestedTreasury, nestedBuyBacker],
        [nestedTreasuryPart, nestedBuyBackerPart],
        royaltiesPartPart,
        weth,
    );
    await feeSplitter.deployed();
    const asset = await NestedAsset.deploy();
    await asset.deployed();
    const records = await NestedRecords.deploy(maxHoldingsCount);
    await records.deployed();

    const factory = await NestedFactory.deploy(asset.address, records.address, feeSplitter.address, ethers.constants.AddressZero, weth);
    await factory.deployed();
    const tx0 = await asset.setFactory(factory.address);
    await tx0.wait();

    const tx1 = await records.setFactory(factory.address);
    await tx1.wait();

    const reserve = await NestedReserve.deploy(factory.address);
    await reserve.deployed();

    await factory.setReserve(reserve.address);

    addresses[env].factory = factory.address;
    addresses[env].nestedAsset = asset.address;
    addresses[env].nestedRecords = records.address;
    addresses[env].feeSplitter = feeSplitter.address;

    const timelock = await configureTimelock(addresses[env], dev, timelockMinDelay);

    const tx2 = await factory.transferOwnership(timelock);
    const tx3 = await records.transferOwnership(timelock);
    const tx4 = await asset.transferOwnership(timelock);
    const tx5 = await feeSplitter.transferOwnership(timelock);

    await Promise.all([tx2.wait(), tx3.wait(), tx4.wait(), tx5.wait()]);

    // write factory address to addresses.json
    if (saveAddresses) fs.writeFileSync("./demo/addresses.json", JSON.stringify(addresses, null, 4));
    return addresses[env];
}

const configureTimelock = async (addr: any, dev: string, timelockMinDelay: number) => {
    const TimelockControllerBytecode = require("@openzeppelin/contracts/build/contracts/TimelockController.json").bytecode;
    const TimelockControllerFactory = await ethers.getContractFactory(
        [
            "constructor(uint256 minDelay, address[] memory proposers, address[] memory executors)",
            "function schedule(address target, uint256 value, bytes calldata data, bytes32 predecessor, bytes32 salt, uint256 delay) public",
            "function execute(address target, uint256 value, bytes calldata data, bytes32 predecessor, bytes32 salt) public payable",
        ],
        TimelockControllerBytecode
    );

    // add dev team multisig wallet here
    const timelock = await TimelockControllerFactory.deploy(timelockMinDelay, [dev], [dev]);
    addr.timelock = timelock.address;
    return timelock.address;
};

export const isCallingScript = (filename: string) => {
    return filename === process.argv?.[1];
};

if (isCallingScript(__filename))
    main(48 * 60 * 60, true)
        .then(addresses => {
            console.log("Factory address:", addresses.factory);
            process.exit(0);
        })
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
