import { ethers, network } from 'hardhat';

import { NetworkName } from '../demo/demo-types';
import allAddresses from "../demo/addresses.json";
import fs from 'fs';

const attachToContract = async (name: string, address: string) => {
	const factory = await ethers.getContractFactory(name);
	return factory.attach(address);
}

const main = async () => {
	const env = network.name as NetworkName;

	const addresses = allAddresses[env];
	const OLD_FACTORY = '0x360ceCc9CD587e99F71Ef49259EAc671A540D9A5';

	const asset = await attachToContract("NestedAsset", addresses.nestedAsset);
	const records = await attachToContract("NestedRecords", addresses.nestedRecords);
	const oldFactory = await attachToContract("NestedFactory", OLD_FACTORY)
	const reserveAddress = await oldFactory.reserve();
	const reserve = await attachToContract("NestedReserve", reserveAddress);
	const factory = await attachToContract("NestedReserve", reserveAddress);

	const [dev] = await ethers.getSigners();
	console.log("Onwer is", await asset.owner(), "current account is", dev.address);

	console.log("update asset...");
	const tx0 = await asset.setFactory(factory.address);
	await tx0.wait();

	console.log("update records...");
	const tx1 = await records.setFactory(factory.address);
	await tx1.wait();

	console.log("update reserve...");
	await reserve.setFactory(factory.address);
}

main().then(() => process.exit(0)).catch((err) => {
	console.error(err);
	process.exit(1);
});