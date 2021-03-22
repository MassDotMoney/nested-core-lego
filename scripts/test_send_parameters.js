async function main() {
    // Get the list of accounts
    const accounts = await ethers.getSigners();

    // Get the Factory contract to deploy
    const NestedFactory = await hre.ethers.getContractFactory("NestedFactory");

    // Deploy the Nested factory, and allow the first account to choose which address will collect fees
    const nestedFactory = await NestedFactory.deploy(accounts[0].address);

    // Wait that the contract is deployed
    await nestedFactory.deployed();

    const tokens = [
        '0xC70296d26Fc964D2dA32AD9dd24a5B7f74035D63',
        '0xC70296d26Fc964D2dA32AD9dd24a5B7f74035D63',
        '0xC70296d26Fc964D2dA32AD9dd24a5B7f74035D63'
    ]
    const amounts = [10, 0.0001, 0.1].map((e) => ethers.BigNumber.from(ethers.utils.parseUnits(e.toString(), 18)))
    const owned = [true, true, false]

    await nestedFactory.create(tokens, amounts, owned);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });