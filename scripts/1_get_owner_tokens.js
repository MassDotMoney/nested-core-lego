async function main() {

  // Get the list of accounts
  const accounts = await ethers.getSigners();

  // Get the Factory contract to deploy
  const NestedFactory = await hre.ethers.getContractFactory("NestedFactory");

  // Deploy the Nested factory, and allow the first account to choose which address will collect fees
  const nestedFactory = await NestedFactory.deploy(accounts[0].address);

  // Wait that the contract is deployed
  await nestedFactory.deployed();

  // Set the first address as the fee collector
  await nestedFactory.setFeeTo(accounts[0].address);

  // Get the Asset contract to deploy
  const NestedAsset = await hre.ethers.getContractFactory("NestedAsset");

  // Deploy the asset contract, specify the deployed factory address
  const nestedAsset = await NestedAsset.deploy(nestedFactory.address);

  // Wait that the contract is deployed
  await nestedAsset.deployed();

  // Mint an NFT
  await nestedAsset.mint();
  await nestedAsset.mint();
  await nestedAsset.mint();

  const tokenCount = await nestedAsset.balanceOf(accounts[0].address);

  let tokenIds = [];

  for(i= 0; i < tokenCount.toNumber(); i++) {
    tokenIds.push((await nestedAsset.tokenOfOwnerByIndex(accounts[0].address, i)).toNumber());
  }

    console.log('Owner tokens: ', tokenIds)
    for(i= 0; i < tokenIds.length; i++) {
      const tokenid = tokenIds[i];
      await nestedAsset.destroy(tokenid);
      console.log("Tokenid "+ tokenid + " destroyed");

//      tokenIds.push((await nestedAsset.tokenOfOwnerByIndex(accounts[0].address, i)).toNumber());
    }
}

const getOwnerTokens = async (ownerAddress) => {
  const tokenCount = await nestedAsset.balanceOf(ownerAddress);

  let tokenIds = [];

  for(i= 0; i < tokenCount.toNumber(); i++) {
    tokenIds.push((await nestedAsset.tokenOfOwnerByIndex(ownerAddress, i)).toNumber());
  }

  return tokenIds;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
