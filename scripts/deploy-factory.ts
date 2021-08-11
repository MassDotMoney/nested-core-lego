import { ethers, network } from 'hardhat';

import { NetworkName } from '../demo/demo-types';
import allAddresses from "../demo/addresses.json";
import fs from 'fs';

const main = async () => {
	const env = network.name as NetworkName;
	const addresses = allAddresses[env];
	const weth = addresses.tokens.WETH;

	const NestedFactory = await ethers.getContractFactory("NestedFactory");
	const factory = await NestedFactory.deploy(addresses.nestedAsset, addresses.nestedRecords, addresses.feeSplitter, weth, 0, 0);

	allAddresses[env].factory = factory.address;
	console.log("New factory at", factory.address);
	fs.writeFileSync("./demo/addresses.json", JSON.stringify(allAddresses, null, 4));
}

main().then(() => process.exit(0)).catch((err) => {
	console.error(err);
	process.exit(1);
});