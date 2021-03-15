async function main() {

  // Get the list of accounts
  const accounts = await ethers.getSigners();

  // Get the Factory contract to deploy
  const NestedFactory = await hre.ethers.getContractFactory("NestedFactory");

  // Deploy the Nested factory, and allow the first account to choose which address will collect fees
  const nestedFactory = await NestedFactory.deploy(accounts[0].address);

  // Wait that the contract is deployed
  await nestedFactory.deployed();

  // Set the second address as the fee collector
  await nestedFactory.setFeeTo(accounts[1].address);

  // Get the Asset contract to deploy
  const NestedAsset = await hre.ethers.getContractFactory("NestedAsset");

  // Deploy the asset contract, specify the deployed factory address
  const nestedAsset = await NestedAsset.deploy(nestedFactory.address);

  // Wait that the contract is deployed
  await nestedFactory.deployed();

  // Mint an NFT, it returns the TokenId
  const nftId = await nestedAsset.mint();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
