require('dotenv').config()
require("@nomiclabs/hardhat-waffle");
require("hardhat-deploy");
require("hardhat-deploy-ethers");
//require("@nomiclabs/hardhat-solhint");

task("accounts", "Prints the list of accounts", async () => {
  const accounts = await ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

const accounts = {
  mnemonic: process.env.MNEMONIC,
  accountsBalance: "990000000000000000000",
};

/**
 * Go to https://hardhat.org/config/ to learn more
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      // Seems to be a bug with this, even when false it complains about being unauthenticated.
      // Sushiswap reported it to HardHat team and fix is incoming
      // forking: {
      //   enabled: process.env.FORKING === "true",
      //   url: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY}`,
      // },
      live: false,
      saveDeployments: true,
      tags: ["test", "local"],
    },
    ropsten: {
       url: `https://eth-ropsten.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY}`,
       accounts: [`0x${process.env.ACCOUNT_PRIVATE_KEY}`],
     },
  },
  solidity: "0.7.3",
};
