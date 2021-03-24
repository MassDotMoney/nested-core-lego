async function main() {
    // Get the list of accounts
    const accounts = await ethers.getSigners();

    // Get the Factory contract to deploy
    const NestedFactory = await hre.ethers.getContractFactory("NestedFactory");

    // Deploy the Nested factory, and allow the first account to choose which address will collect fees
    const nestedFactory = await NestedFactory.deploy(accounts[0].address);

    const CJT_CONTRACT_ADDRESS = '0x3abdff32f76b42e7635bdb7e425f0231a5f3ab17';

    // Wait until the contract is deployed
    await nestedFactory.deployed();

    const tokens = [
        '0x9e19c82033881119be1b0aac434cf54acd525f97',
        '0xaa5fe8f9178125df33c28dd0ff39393422f5aa3e',
        '0xc098b2a3aa256d2140208c3de6543aaef5cd3a94'
    ]
    const amounts = [10, 0.0001, 0.1].map((e) => ethers.BigNumber.from(ethers.utils.parseEther(e.toString())))
    const owned = [true, true, false]

    // CJT TOKEN ABI (ERC20)
    const abi = [{"constant":true,"inputs":[],"name":"name","outputs":[{"name":"","type":"string"}],"payable":false,"type":"function"},{"constant":false,"inputs":[{"name":"_spender","type":"address"},{"name":"_value","type":"uint256"}],"name":"approve","outputs":[{"name":"","type":"bool"}],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"totalSupply","outputs":[{"name":"","type":"uint256"}],"payable":false,"type":"function"},{"constant":false,"inputs":[{"name":"_from","type":"address"},{"name":"_to","type":"address"},{"name":"_value","type":"uint256"}],"name":"transferFrom","outputs":[{"name":"","type":"bool"}],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"decimals","outputs":[{"name":"","type":"uint256"}],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"initialSupply","outputs":[{"name":"","type":"uint256"}],"payable":false,"type":"function"},{"constant":false,"inputs":[{"name":"_value","type":"uint256"}],"name":"burn","outputs":[],"payable":false,"type":"function"},{"constant":false,"inputs":[{"name":"_spender","type":"address"},{"name":"_subtractedValue","type":"uint256"}],"name":"decreaseApproval","outputs":[{"name":"success","type":"bool"}],"payable":false,"type":"function"},{"constant":true,"inputs":[{"name":"_owner","type":"address"}],"name":"balanceOf","outputs":[{"name":"balance","type":"uint256"}],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"owner","outputs":[{"name":"","type":"address"}],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"symbol","outputs":[{"name":"","type":"string"}],"payable":false,"type":"function"},{"constant":false,"inputs":[{"name":"_to","type":"address"},{"name":"_value","type":"uint256"}],"name":"transfer","outputs":[{"name":"","type":"bool"}],"payable":false,"type":"function"},{"constant":false,"inputs":[{"name":"_spender","type":"address"},{"name":"_addedValue","type":"uint256"}],"name":"increaseApproval","outputs":[{"name":"success","type":"bool"}],"payable":false,"type":"function"},{"constant":true,"inputs":[{"name":"_owner","type":"address"},{"name":"_spender","type":"address"}],"name":"allowance","outputs":[{"name":"remaining","type":"uint256"}],"payable":false,"type":"function"},{"constant":false,"inputs":[{"name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"payable":false,"type":"function"},{"inputs":[],"payable":false,"type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"name":"previousOwner","type":"address"},{"indexed":true,"name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"burner","type":"address"},{"indexed":false,"name":"value","type":"uint256"}],"name":"Burn","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"owner","type":"address"},{"indexed":true,"name":"spender","type":"address"},{"indexed":false,"name":"value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"from","type":"address"},{"indexed":true,"name":"to","type":"address"},{"indexed":false,"name":"value","type":"uint256"}],"name":"Transfer","type":"event"}];
    const provider = ethers.getDefaultProvider();

    const cjtAlice = new ethers.Contract(CJT_CONTRACT_ADDRESS, abi, accounts[0]);
    const cjtBob = new ethers.Contract(CJT_CONTRACT_ADDRESS, abi, accounts[1]);

    // alice approve bob to transfer 1 CJT from her wallet
    const approve = await cjtAlice.approve(accounts[1].address, ethers.BigNumber.from(ethers.utils.parseEther("1")));
    console.log('alice balance is', ethers.utils.formatEther(await cjtAlice.balanceOf(accounts[0].address)));
    console.log('account 3 balance is', ethers.utils.formatEther(await cjtBob.balanceOf(accounts[3].address)));

    // Bob now transfer 1 CJT from alice account to accounts[3]
    await cjtBob.transferFrom(accounts[0].address, accounts[3].address, ethers.BigNumber.from(ethers.utils.parseEther("1")))
    console.log('bob transferFrom alice');
    console.log('alice balance is', ethers.utils.formatEther(await cjtAlice.balanceOf(accounts[0].address)));
    console.log('account 3 balance is', ethers.utils.formatEther(await cjtBob.balanceOf(accounts[3].address)));

    //await nestedFactory.create(tokens, amounts, owned);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });