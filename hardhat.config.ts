import "dotenv/config"
import "solidity-coverage"
import "@nomiclabs/hardhat-waffle"
import "hardhat-deploy"
import "hardhat-deploy-ethers"
import "hardhat-gas-reporter"
import "@nomiclabs/hardhat-solhint"
import "hardhat-contract-sizer"

const treasuryAccountKey = "954df48893ad50c69349b2422e5e21f4a9992a79f983cac8035e3673f1836891"
const buybackerAccountKey = "1d44492875c0bae585e61ecb36e07a24cb27c300efea0ce9a4d1465d8d204a40"

const accounts = {
    mnemonic: process.env.MNEMONIC,
    initialIndex: 0,
    count: 20,
    accountsBalance: "990000000000000000000",
}

/**
 * Go to https://hardhat.org/config/ to learn more
 * @type import('hardhat/config').HardhatUserConfig
 */
export default {
    defaultNetwork: "hardhat",
    networks: {
        hardhat: {
            forking: {
                enabled: process.env.FORKING === "true",
                url: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_MAINNET_API_KEY}`,
            },
            live: false,
            saveDeployments: true,
            tags: ["test", "local"],
            accounts: accounts,
            // This is because MetaMask mistakenly assumes all networks in http://localhost:8545 to have a chain id of 1337
            // but Hardhat uses a different number by default. Please voice your support for MetaMask to fix this:
            // https://github.com/MetaMask/metamask-extension/issues/9827
            chainId: 1337,
        },
        ropsten: {
            url: `https://eth-ropsten.alchemyapi.io/v2/${process.env.ALCHEMY_ROPSTEN_API_KEY}`,
            accounts: accounts,
        },
        kovan: {
            url: `https://eth-kovan.alchemyapi.io/v2/${process.env.ALCHEMY_KOVAN_API_KEY}`,
            accounts: [process.env.KOVAN_WALLET_KEY, treasuryAccountKey, buybackerAccountKey].filter(k => k != null),
        },
        mainnet: {
            url: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_MAINNET_API_KEY}`,
            accounts: accounts,
        },
    },
    solidity: {
        version: "0.8.4",
        settings: {
            optimizer: {
                enabled: true,
                runs: 5000,
            },
        },
    },
    gasReporter: {
        coinmarketcap: process.env.COINMARKETCAP_API_KEY,
        currency: "USD",
        enabled: process.env.REPORT_GAS === "true",
        excludeContracts: ["contracts/mocks/", "contracts/libraries/", "contracts/interfaces/"],
    },
}
