
<div align="center"><img width="600" src="https://user-images.githubusercontent.com/22816913/169259395-a7386302-2d32-4159-bc53-11ce9da2ca87.png"></div>
<br/>
<div align="center"><a href="https://nested.fi" > https://nested.fi </a></div>

# Introduction

Nested is a decentralized protocol providing customizable financial products in the form of NFTs. 
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
Furthermore, we allow users to copy other users NestedNFTs. The creator of the initial NestedNFT earns royalties.

### _Further documentation and details can be found here: https://docs.nested.finance/_

# Architecture

![image](https://user-images.githubusercontent.com/22816913/152804262-e8879475-8873-43a9-9a53-18da1517b3fd.png)

## Core contracts

| Name             | Purpose  |
|------------------|----------|
| **NestedFactory**    | Entry point to the protocol. Holds the business logic. Responsible for interactions with operators (submit orders). |
| **NestedAsset**      | Collection of ERC721 tokens. Called NestedNFT across the codebase. |
| **NestedReserve**    | Holds funds for the user. Transferred from the NestedFactory. |
| **NestedRecords**    | Tracks underlying assets of NestedNFTs. (Amount, NestedReserve). |
| **FeeSplitter**      | Receives payments in ERC20 tokens from the factory when fees are sent. Allows each party to claim the amount they are due. |
| **NestedBuyBacker**  | Pulls tokens from the FeeSplitter, buys back NST tokens on the market, and burns a part of it. |

## Upgradability

The contracts `NestedAsset`, `NestedReserve`, and `NestedRecords` are whitelisting multiple factories (to create NFTs, update records, withdraw from reserve,...).

However, we are also using the [TransparentUpgradeableProxy](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/proxy/transparent/TransparentUpgradeableProxy.sol) for `NestedFactory`. Then, the users doesn't have to approve multiple times.

We have kept both mechanisms to get the best flexibility.

## Lock

The users can lock their NFTs until a certain date (timestamp) by calling `updateLockTimestamp`. This feature allows the "hold by design".

## Operators (modularization)

### What is an operator?

`NestedFactory` is the main smart contract, but it can't work without the Operators.

As mentioned in the introduction, we designed the protocol to be **modular**.
We want to be able to interact with any protocol in exchange for an ERC20 token.

So, we had to deal with two issues :
- How to interact with 5, 10, or 20 protocols without blowing up the bytecode size and having too much logic?
- How to add new interactions without redeploying the `NestedFactory` contract?

Our solution is called the "**Operator**"... A new interaction is a new operator and can be added on the fly.
They kind of work like [libraries](https://docs.soliditylang.org/en/v0.8.9/contracts.html#libraries), but since we don't want to redeploy the factory, 
they are contracts that are called via `delegatecall` and referenced by the `OperatorResolver`.

### Operator Resolver

An operator allows performing a precise action, like _"swap my token A for a token B"_ with a specific function, but the operator/interface will change depending on the action/context. To interact with new operators on the fly, we must expose new interfaces to the Factory.
The `OperatorResolver` will whitelist all the Operator (`address`) with the selectors (`bytes4`) since we can't trust the caller to provide these informations.

```javascript
struct Operator {
    address implementation;
    bytes4 selector;
}
```

The caller will send the (imported) `bytes32` name of the Operator/Function, for example "ZeroEx::performSwap".

The `OperatorResolver` will return the `address` + `selector` if the call is whitelisted and revert if not.

### Storage

Since the operators are called via `delegatecall`: _how can we store/retrieve useful data?_
<br>In fact, we cannot trust the Factory to provide all the data, like the address of the protocol. It must be stored and managed by the owner.

When deploying an operator, it will also deploy the storage contract and transfer the ownership to `msgSender()`.

### Diagram

![image](https://user-images.githubusercontent.com/22816913/152804758-98de74eb-e09c-44ac-8504-32b40c3624ae.png)

### Contracts

| Name                  | Purpose  |
|-----------------------|----------|
| OperatorResolver      | Allows the factory to identify which operator to interact with. |
| MixinOperatorResolver | Abstract contract to load authorized operators in cache (instead of calling `OperatorResolver`). |
| ZeroExOperator        | Performs token swaps through 0x ([read more](contracts/operators/ZeroEx/README.md)). |
| ZeroExStorage         | ZeroExOperator storage contract. Must store the 0x `swapTarget`. |
| FlatOperator          | Handles deposits and withdraws. No interaction with any third parties ([read more](contracts/operators/Flat/README.md)). |

_More operators will be added. e.g. CurveOperator or SynthetixOperator_

### Orders

The `NestedFactory` is using the operators to interact with other protocols. The call from the Factory to an Operator is an "Order".

An Order has several information:
- The operator/selector to use
- The token processed (swapped, stacked,...) by the operator (from the portfolio or wallet).
- The calldatas (without the selector).

```javascript
struct Order {
    bytes32 operator;
    address token;
    bytes callData;
}
```

It help us to make **one** interaction, but we want to make multiple interactions. For example, to create a portfolio with multiple tokens, we need to "batch" these orders. 

**There are two types of "Batched Orders" processed by the Factory to create or edit Portfolios :**

#### Batched Input Orders

<div align="center"><img width="650" src="https://user-images.githubusercontent.com/22816913/152816454-467afbf1-62a1-4d81-9cc3-e86403ab2e8f.png"></div>

- One same input for every orders but multiple outputs.
- 1% Fee on the input.
- The input (*source*) is from a wallet **or** a porfolio owned by the transactions signer.
- The ouput (*destination*) is the portfolio owned by the transactions signer (**only**). 

```javascript
struct BatchedInputOrders {
    IERC20 inputToken;
    uint256 amount;
    Order[] orders;
    bool fromReserve;
}
```

#### Batched Output Orders

<div align="center"><img width="650" src="https://user-images.githubusercontent.com/22816913/152816552-f48f1a68-e8c2-44d3-b709-5f2ef17e9fb1.png"></div>

- Multiple inputs for every orders but one output.
- 1% Fee on the output.
- The input (*source*) is the portfolio owned by the transactions signer (**only**). 
- The ouput (*destination*) is from a wallet **or** a portfolio owned by the transactions signer.

```javascript
struct BatchedOutputOrders {
    IERC20 outputToken;
    uint256[] amounts;
    Order[] orders;
    bool toReserve;
}
```

# Ownership & Governance

Some functions of the protocol require admin rights (`onlyOwner`).

The contracts are owned by the [TimelockController](https://docs.openzeppelin.com/contracts/4.x/api/governance#TimelockController) contract from OpenZeppelin, set with a **7-days** delay.
This ensures the community has time to review any changes made to the protocol.

The owner of the TimelockController is a three-party multisignature wallet.
> During the next phase of the protocol, the ownership will be transferred to a fully decentralized DAO.

# Development & Testing

## Setup
- Install Node > 12
- Install Yarn
- `yarn install`
- Copy `.env.example` to a new file `.env` and insert a dummy mnemonic and a mainnet api key

## Commands

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

# License
[GNU General Public License v3](https://www.gnu.org/licenses/gpl-3.0.html)
