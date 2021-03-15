async function main() {

  const accounts = await ethers.getSigners();
  // We get the contract to deploy
  const NestedFactory = await hre.ethers.getContractFactory("NestedFactory");
  // Deploy the Nested factory, and allow the first account to choose which address will collect fees
  const nestedFactory = await NestedFactory.deploy(accounts[0].address);

  await nestedFactory.deployed();
  console.log("nestedFactory deployed to:", nestedFactory.address);

  console.log("Attempt to set ", accounts[1].address, " as the fee collector.");
  await nestedFactory.setFeeTo(accounts[1].address);

}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
