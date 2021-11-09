![logo](https://nested.finance/6b89dd383bb976eeffb280c852b52cca.png)

_https://nested.finance_

## Introduction

Nested Finance is a decentralized protocol providing customizable financial products in the form of NFTs. 
The platform allows users to put several digital assets, i.e. ERC20 tokens, inside an NFT (abbreviated as `NestedNFT`).
<br/>

Each NestedNFT is backed by underlying assets:
- Purchased or sold on a decentralized exchange (AMM).
- Collected/earned after adding liquidity or staking.
- Exchanged/Minted on a protocol that is not a decentralized exchange.
- (...)

The main idea is to allow adding modules (**operators**) to interact with new protocols 
and enable new assets, without re-deploying.

> The tokens are stored on a self-custodian smart contract.

At the end of the creation process, the user receives the NFT which allows to control all underlying assets of the portfolio.
Furthermore, we allow users to copy other users’ NestedNFTs. The creator of the initial NestedNFT earns royalties.

#### _Further documentation and details can be found here: https://docs.nested.finance/_

## Architecture

![diagram](https://user-images.githubusercontent.com/22816913/140886706-ee9e18f8-de84-4bcf-af20-5847b79cc508.png)

### Core contracts

| Name             | Purpose  |
|------------------|----------|
| **NestedFactory**    | Entry point to the protocol. Holds the business logic. Responsible for interactions with operators (submit orders). |
| **NestedAsset**      | Collection of ERC721 tokens. Called NestedNFT across the codebase. |
| **NestedReserve**    | Holds funds for the user. Transferred from the NestedFactory. |
| **NestedRecords**    | Tracks underlying assets of NestedNFTs. (Amount, NestedReserve). |
| **FeeSplitter**      | Receives payments in ERC20 tokens from the factory when fees are sent. Allows each party to claim the amount they are due. |
| **NestedBuyBacker**  | Pulls tokens from the FeeSplitter, buys back NST tokens on the market, and burns a part of it. |

### Operators (modularization)

#### What is an operator?

`NestedFactory` is the main smart contract, but it can't work without the Operators.

As mentioned in the introduction, we designed the protocol to be **modular**.
We want to be able to interact with any protocol in exchange for an ERC20 token.

So, we had to deal with two issues :
- How to interact with 5, 10, or 20 protocols without blowing up the bytecode size and having too much logic?
- How to add new interactions without redeploying the `NestedFactory` contract?

Our solution is called the "**Operator**"... A new interaction is a new operator and can be added on the fly.
They kind of work like [libraries](https://docs.soliditylang.org/en/v0.8.9/contracts.html#libraries), but since we don't want to redeploy the factory, 
they are contracts that are called via `delegatecall` and referenced by the `OperatorResolver`.

#### One language
To interact with new operators on the fly, they must speak the same language.
Let's define the "interactions" common to all operators: `commit` and `revert`.

An operator allows performing a precise action, like _"swap my token A for a token B"_. When we want to perform this action, we will "**commit**".
On the other hand, all the actions in DeFi can be carried out in the opposite direction, like "_swap my token B against a token A_".
When we want to "reverse" an action that we have "committed", we will "**revert**".

**Some examples:**

| Name     | Commit  |  Revert  |
|----------|---------|----------|
| Swap     | Swap token A for token B | Swap token B for token A |
| Add Liquidity | - Swap half of token A for token B. <br> - Add liquidity to A-B pool. | - Remove liquidity from A-B pool. <br>- Swap (all) token B for token A. |
| Liquidity Mining | - Swap half of token A for token B. <br>- Add liquidity to A-B pool. <br>- Stake LP token (for token C reward). | - Unstake LP Token. <br>- **(optional)** Swap token C for token A. <br>- Remove liquidity from A-B Pool. <br>- Swap (all) token B for token A. |

#### Storage

Since the operators are called via `delegatecall`: _how can we store/retrieve useful data?_
<br>In fact, we cannot trust the Factory to provide all the data, like the address of the protocol. It must be stored and managed by the owner.

When deploying an operator, it will also deploy the storage contract using `CREATE2` and transfer the ownership to `msgSender()`.

This way, the operator can retrieve the storage address (without storing it) and get the data.

#### Diagram

![image](https://user-images.githubusercontent.com/22816913/140764920-42418305-c919-4194-9891-52f2f33122f2.png)

#### Contracts

| Name                  | Purpose  |
|-----------------------|----------|
| OperatorResolver      | Allows the factory to identify which operator to interact with. |
| MixinOperatorResolver | Abstract contract to load authorized operators in cache (instead of calling `OperatorResolver`). |
| ZeroExOperator        | Performs token swaps through 0x ([read more](contracts/operators/ZeroEx/README.md)). |
| ZeroExStorage         | ZeroExOperator storage contract. Must store the 0x `swapTarget`. |
| FlatOperator          | Handles deposits and withdraws. No interaction with any third parties ([read more](contracts/operators/Flat/README.md)). |

_More operators will be added. e.g. CurveOperator or SynthetixOperator_

### Ownership & Governance
Some functions of the protocol require admin rights (`onlyOwner`).

The contracts are owned by the [TimelockController](https://docs.openzeppelin.com/contracts/4.x/api/governance#TimelockController) contract from OpenZeppelin, set with a **7-days** delay.
This ensures the community has time to review any changes made to the protocol.

The owner of the TimelockController is a three-party multisignature wallet.
> During the next phase of the protocol, the ownership will be transferred to a fully decentralized DAO.

## Development & Testing

### Setup
- Install Node > 12
- Install Yarn
- `yarn install`
- Copy `.env.example` to a new file `.env` and insert a dummy mnemonic and a mainnet api key

### Commands

- Start a local blockchain
`yarn run`

- Start a hardhat console
`yarn console`

- Compile
`yarn compile`

- Generate typechain files
`yarn typechain`

- Run tests
`yarn test`

## License
[GNU General Public License v3](https://www.gnu.org/licenses/gpl-3.0.html)
