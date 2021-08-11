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
	const targetAccount = '0xe9aA231C4b8f428acF93dBA896f10F6de669021b';
	const OLD_FACTORY = '0x360ceCc9CD587e99F71Ef49259EAc671A540D9A5';

	const asset = await attachToContract("NestedAsset", addresses.nestedAsset);
	const records = await attachToContract("NestedRecords", addresses.nestedRecords);
	const oldFactory = await attachToContract("NestedFactory", OLD_FACTORY)
	const reserveAddress = await oldFactory.reserve();
	const reserve = await attachToContract("NestedReserve", reserveAddress);
	const factory = await attachToContract("NestedReserve", reserveAddress);

	console.log("owner?", await records.owner());

	console.log("update asset...");
	await asset.transferOwnership(targetAccount);
	return;
	console.log("update records...");
	await records.transferOwnership(factory.address);

	console.log("update reserve...");
	await reserve.setFactory(factory.address);
}

main().then(() => process.exit(0)).catch((err) => {
	console.error(err);
	process.exit(1);
});