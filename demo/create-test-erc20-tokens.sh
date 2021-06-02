#!/bin/bash


SYMBOL=MKR NAME=Maker npx hardhat run --network ropsten ./demo/deploy-testnet-tokens.ts
SYMBOL=BAT NAME="Basic Attention Token" npx hardhat run --network ropsten ./demo/deploy-testnet-tokens.ts
SYMBOL=WBTC NAME="Wrapped BTC" npx hardhat run --network ropsten ./demo/deploy-testnet-tokens.ts
SYMBOL=KNC NAME="Kyber Network Crystar v2" npx hardhat run --network ropsten ./demo/deploy-testnet-tokens.ts
SYMBOL=REP NAME=Reputation npx hardhat run --network ropsten ./demo/deploy-testnet-tokens.ts
SYMBOL=USDC NAME="USD Coin" npx hardhat run --network ropsten ./demo/deploy-testnet-tokens.ts
SYMBOL=cZRX NAME="Compound 0x" npx hardhat run --network ropsten ./demo/deploy-testnet-tokens.ts
SYMBOL=ZRX NAME="0x Protocol Token" npx hardhat run --network ropsten ./demo/deploy-testnet-tokens.ts
SYMBOL=SAI NAME="Sai Stablecoin" npx hardhat run --network ropsten ./demo/deploy-testnet-tokens.ts
SYMBOL=cREP NAME="Compound Augur" npx hardhat run --network ropsten ./demo/deploy-testnet-tokens.ts
SYMBOL=ADAI NAME="yearn Curve.fi aDAI/aUSDC/aUSDT" npx hardhat run --network ropsten ./demo/deploy-testnet-tokens.ts
SYMBOL=POLY NAME="Polymath" npx hardhat run --network ropsten ./demo/deploy-testnet-tokens.ts
SYMBOL=LINK NAME="ChainLink Token" npx hardhat run --network ropsten ./demo/deploy-testnet-tokens.ts