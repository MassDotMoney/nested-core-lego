# NESTED
https://nested.finance

# DOCUMENTATION
Further documentation and details can be found here: https://docs.nested.finance/

## Architecture of the nested protocol

Smart Contracts:
- NestedFactory: Entry point to the protocol. Holds the business logic. Responsible for interactions with other contracts or 3rd parties.
- NestedAsset: Collection of ERC721 tokens. Called NestedNFT accross the codebase.
- NestedReserve: Holds funds for the user. Transfered from the NestedFactory.
- NestedRecords: Tracks underlying assets of NestedNFTs. (Amount, NestedReserve)
- FeeSplitter: Receives payment in ERC20 tokens from the factory when fees are taken. Allows each party to claim the amount they are due.
- NestedBuyBacker: Pulls tokens from the FeeSplitter, buys back NST tokens on the market, and burn a part of it.

nb: NST token and staking pools contract can be found here: https://github.com/NestedFinance/nested-token

3rd parties:
- Nested Finance brings decentralized liquidity to the protocol through 0x. It's a protocol that creates off-chain orders, and settles on chain. This way, the NestedFactory expects to receive calldata to forwarded to 0x contracts. The route used to get such information follows this pattern: `https://api.0x.org/swap/v1/quote?buyToken=SNX&sellToken=LINK&buyAmount=7160000000000000000000`

**Have a look at the `/demo/` folder. Scripts describe all use cases and usage of the smart contracts.**

Use case: creation of a NestedNFT
![image](https://user-images.githubusercontent.com/32484870/117845076-857c3580-b280-11eb-9bc7-8422b856ed92.png)

Fee Distribution (step 10):
![image](https://user-images.githubusercontent.com/32484870/117845162-962cab80-b280-11eb-9903-be91ccb41e2b.png)

## Deployment process:
V1 release:
![image](https://user-images.githubusercontent.com/32484870/117945404-94a9c480-b30e-11eb-9c83-c769f3370bbe.png)

Update process:
![image](https://user-images.githubusercontent.com/32484870/117845522-ec99ea00-b280-11eb-85b3-e5e80451529f.png)

# Contracts:

# SETUP
- Install Node > 12
- Install Yarn
- `yarn install`
- Copy `.env.example` to a new file `.env` and insert a dummy mnemonic and a mainnet api key

# COMMANDS
Start a local blockchain
`yarn run`

Start a local fork of ropsten (works with mainnet too)
`npx hardhat node --network ropsten`

Start a hardhat console
`yarn console`

Compile
`yarn compile`

Run tests
`yarn test`

Run coverage
`yarn test:coverage`

Run gas profiler
`yarn test:gas`

# Local testing


## Create an NFT from Eth

```bash
npx hardhat run --network localhost ./demo/2_create_nft_from_eth.ts
```

## License
UNLICENSED
