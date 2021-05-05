async function main() {
  const accounts = await ethers.getSigners();

  const FeeSplitter = await hre.ethers.getContractFactory("FeeSplitter");
  const NestedFactory = await hre.ethers.getContractFactory("NestedFactory");
  const NestedAsset = await hre.ethers.getContractFactory("NestedAsset");
  const NestedReserve = await hre.ethers.getContractFactory("NestedReserve");
  
  const wethContract = await hre.ethers.getContractFactory("IWETH");
  const weth = wethContract.attach("<address WETH>");
  
  const feeSplitter = await FeeSplitter.deploy(["<address Nested Treasury>"], [80], 20, weth);
  const nestedFactory = await NestedFactory.deploy(accounts[O].address, feeSplitter.address, weth);
  const nestedAsset = await NestedAsset.deploy(nestedFactory.address);
  const nestedReserve = await NestedReserve.deploy(nestedFactory.address);
  
  await feeSplitter.deployed();
  await nestedFactory.deployed();
  await nestedAsset.deployed();
  await nestedReserve.deployed();
  
  // TODO: uncomment once the contract is merged:
  // const NestedRecords = await hre.ethers.getContractFactory("NestedRecords");
  // const nestedRecords = await NestedRecords.deploy(nestedFactory.address);
  // await nestedRecords.deployed();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
