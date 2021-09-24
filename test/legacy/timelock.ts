import { Interface } from "ethers/lib/utils";
import { main as deployContracts } from "../../demo/0_deploy_contracts";
import { ethers } from "hardhat";
import { expect } from "chai";

export const getContract = async (name: string, address: string) => {
    const contract = await ethers.getContractFactory(name);
    return contract.attach(address);
};

type Unwrap<T> = T extends Promise<infer U>
    ? U
    : T extends (...args: any) => Promise<infer U>
    ? U
    : T extends (...args: any) => infer U
    ? U
    : T;

describe.skip("TimelockController", () => {
    let addresses: Unwrap<ReturnType<typeof deployContracts>>;

    before(async () => {
        addresses = await deployContracts(0, false);
    });

    it("reverts when calling functions the timelock should own", async () => {
        const nestedRecords = await getContract("NestedRecords", addresses.nestedRecords);
        const nestedAsset = await getContract("NestedAsset", addresses.nestedAsset);
        const nestedFactory = await getContract("NestedFactory", addresses.factory);
        const feeSplitter = await getContract("FeeSplitter", addresses.feeSplitter);

        await expect(nestedRecords.setFactory(addresses.feeSplitter)).to.be.revertedWith(
            "Ownable: caller is not the owner",
        );
        await expect(nestedAsset.setFactory(addresses.feeSplitter)).to.be.revertedWith(
            "Ownable: caller is not the owner",
        );
        await expect(nestedFactory.setReserve(addresses.uniswapRouter)).to.be.revertedWith(
            "Ownable: caller is not the owner",
        );
        await expect(feeSplitter.setRoyaltiesWeight(2)).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("schedules and executes a transaction to set a new factory", async () => {
        const [alice] = await ethers.getSigners();

        const TimelockControllerBytecode = require("@openzeppelin/contracts/build/contracts/TimelockController.json")
            .bytecode;
        const TimelockControllerFactory = await ethers.getContractFactory(
            [
                "function schedule(address target, uint256 value, bytes calldata data, bytes32 predecessor, bytes32 salt, uint256 delay) public",
                "function execute(address target, uint256 value, bytes calldata data, bytes32 predecessor, bytes32 salt) public payable",
            ],
            TimelockControllerBytecode,
        );

        const timelock = TimelockControllerFactory.attach(addresses.timelock);

        const records = await getContract("NestedRecords", addresses.nestedRecords);

        const abi = ["function setFactory(address)"];
        const iface = new Interface(abi);

        const callData = iface.encodeFunctionData("setFactory", [alice.address]);

        const tx = await timelock.schedule(
            addresses.nestedRecords,
            0,
            callData,
            "0x0000000000000000000000000000000000000000000000000000000000000000",
            "0x0000000000000000000000000000000000000000000000000000000000000000",
            0,
        );
        await tx.wait();

        await timelock.execute(
            addresses.nestedRecords,
            0,
            callData,
            "0x0000000000000000000000000000000000000000000000000000000000000000",
            "0x0000000000000000000000000000000000000000000000000000000000000000",
        );
        await tx.wait();

        expect(await records.supportedFactories(alice.address)).to.be.true;
    });
});
