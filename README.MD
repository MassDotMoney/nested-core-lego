# NESTED
https://nested.finance

# DOCUMENTATION
Further focumentation and details can be found here: https://docs.nested.finance/
## Architecture of the nested protocol

Smart Contracts:
- NestedFactory: Entry point to the protocol. Holds the business logic. Responsible for interactions with other contracts or 3rd parties.
- NestedAsset: Collection of ERC721 tokens. Called NestedNFT accross the codebase.
- NestedReserve: Holds funds for the user. Transfered from the NestedFactory.
- NestedRecords: Tracks underlying assets of NestedNFTs. (Amount, NestedReserve) 
- FeeSplitter: Receives payment in ERC20 tokens from the factory when fees are taken. Allows each party to claim the amount they are due.
- NestedBuyBacker: Pulls tokens from the FeeSplitter, buys back NST tokens on the market, and burn a part of it.

nb: NST token and staking pools contract can be found here: https://github.com/NestedFinance/nested-token

Use case: creation of a NestedNFT
![image](https://user-images.githubusercontent.com/32484870/117845076-857c3580-b280-11eb-9bc7-8422b856ed92.png)

Fee Distribution (step 10):
![image](https://user-images.githubusercontent.com/32484870/117845162-962cab80-b280-11eb-9903-be91ccb41e2b.png)

## Deployment process:
V1 release: 
![image](https://user-images.githubusercontent.com/32484870/117845460-d9871a00-b280-11eb-985b-8a8243ce9ddb.png)

Update process:
![image](https://user-images.githubusercontent.com/32484870/117845522-ec99ea00-b280-11eb-85b3-e5e80451529f.png)

# Contracts:

# SETUP
- Install Node > 12
- Install Yarn
- `yarn install`
- Copy `.env.example` to a new file `.env` and insert a dummy mnemonic

# COMMANDS
Start a local blockchain
`yarn run`

Start a hardhat console
`yarn console`

Compile
`yarn compile`

Run tests
`yarn test`

Run linter
`yarn lint`

## License
UNLICENSED
