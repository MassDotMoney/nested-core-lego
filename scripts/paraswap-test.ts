import hre, { ethers, network } from "hardhat";
import * as utils from "../scripts/utils";

import { ParaSwap, NetworkID } from "paraswap";
import BigNumber from "bignumber.js";
import { OptimalRate, SwapSide } from "paraswap-core";

const USER_ADDRESS = '0x67aed29A17dAd20e8d94123B82Ce015b1Cb55e9b';
const PARTNER = "nested";
const SLIPPAGE = 1; // 1%

enum Networks {
  POLYGON = 137
}

interface MinTokenData {
  decimals: number;
  symbol: string;
  address: string;
}

const web3ProvidersURLs: Partial<Record<number, string>> = {
  [Networks.POLYGON]: process.env.POLYGON_PROVIDER_URL
};

const tokens: Record<number, MinTokenData[]> = {
  [Networks.POLYGON]: [
    {
      decimals: 18,
      symbol: "MATIC",
      address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
    },
    {
      decimals: 6,
      symbol: "USDC",
      address: "0x2791bca1f2de4661ed88a30c99a7a9449aa84174"
    }
  ]
};

function getToken(address: Address, networkID = Networks.POLYGON): MinTokenData {
  const token = tokens[networkID]?.find((t) => t.address === address);

  if (!token)
    throw new Error(`Token ${address} not available on network ${networkID}`);
  return token;
}

/**
 * @type ethereum address
 */
type Address = string;
/**
 * @type Token symbol
 */
type Symbol = string;
/**
 * @type number as string
 */
type NumberAsString = string;

interface TransactionParams {
  to: Address;
  from: Address;
  value: NumberAsString;
  data: string;
  gasPrice: NumberAsString;
  gas?: NumberAsString;
  chainId: number;
}

interface Swapper {
  getRate(params: {
    srcToken: Pick<MinTokenData, "address" | "decimals">;
    destToken: Pick<MinTokenData, "address" | "decimals">;
    srcAmount: NumberAsString;
    userAddress: Address;
    partner?: string;
  }): Promise<OptimalRate>;
  buildSwap(params: {
    srcToken: Pick<MinTokenData, "address" | "decimals">;
    destToken: Pick<MinTokenData, "address" | "decimals">;
    srcAmount: NumberAsString;
    minAmount: NumberAsString;
    priceRoute: OptimalRate;
    userAddress: Address;
    receiver?: Address;
    partner?: string;
  }): Promise<TransactionParams>;
}

function createSwapper(networkID: number, apiURL?: string): Swapper {
  const paraswap = new ParaSwap(
    networkID as NetworkID,
    apiURL,
    web3ProvidersURLs[networkID]
  );

  const getRate: Swapper["getRate"] = async ({
    srcToken,
    destToken,
    srcAmount,
    userAddress,
    partner = PARTNER
  }) => {
    const priceRouteOrError = await paraswap.getRate(
      srcToken.address,
      destToken.address,
      srcAmount,
      userAddress,
      SwapSide.SELL,
      { partner },
      srcToken.decimals,
      destToken.decimals
    );
    console.log(priceRouteOrError)

    if ("message" in priceRouteOrError) {
      throw new Error(priceRouteOrError.message);
    }

    return priceRouteOrError;
  };

  const buildSwap: Swapper["buildSwap"] = async ({
    srcToken,
    destToken,
    srcAmount,
    minAmount,
    priceRoute,
    userAddress,
    receiver,
    partner
  }) => {
    const transactionRequestOrError = await paraswap.buildTx(
      srcToken.address,
      destToken.address,
      srcAmount,
      minAmount,
      priceRoute,
      userAddress,
      partner,
      undefined,
      undefined,
      receiver
    );

    if ("message" in transactionRequestOrError) {
      throw new Error(transactionRequestOrError.message);
    }

    return transactionRequestOrError as TransactionParams;
  };

  return { getRate, buildSwap };
}

interface GetSwapTxInput {
  srcToken: Symbol;
  destToken: Symbol;
  srcAmount: NumberAsString; // in srcToken denomination
  networkID: number;
  slippage?: number;
  partner?: string;
  userAddress: Address;
  receiver?: Address;
}

export async function getSwapTransaction({
  srcToken: srcTokenSymbol,
  destToken: destTokenSymbol,
  srcAmount: _srcAmount,
  networkID,
  slippage = SLIPPAGE,
  userAddress,
  ...rest
}: GetSwapTxInput): Promise<TransactionParams> {
  try {
    const srcToken = getToken(srcTokenSymbol, networkID);
    const destToken = getToken(destTokenSymbol, networkID);

    const srcAmount = new BigNumber(_srcAmount)
      .times(10 ** srcToken.decimals)
      .toFixed(0);

    const ps = createSwapper(networkID);

    const priceRoute = await ps.getRate({
      srcToken,
      destToken,
      srcAmount,
      userAddress
    });

    const minAmount = new BigNumber(priceRoute.destAmount)
      .times(1 - slippage / 100)
      .toFixed(0);

    const transactionRequest = await ps.buildSwap({
      srcToken,
      destToken,
      srcAmount,
      minAmount,
      priceRoute,
      userAddress,
      ...rest
    });

    console.log("TransactionRequest", transactionRequest);

    return transactionRequest;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

// Get proxy factory address
const factoryProxy = '0x53b89bab5a8d589e5c3be4642a7128c3f27da790';
// Get batcher address
const batcher = '0x08DAB63CF6839B4fB4Df48ddd50F03868431F2C9';


// URL format example: https://apiv5.paraswap.io/prices?network=137&srcToken=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE&srcDecimals=18&destToken=0x2791bca1f2de4661ed88a30c99a7a9449aa84174&destDecimals=6&amount=100000000&otherEschangePrices=true
async function main(): Promise<void> {
  const amount = '1';
  const srcToken = tokens[Networks.POLYGON][0]
  const destToken = tokens[Networks.POLYGON][1]
  const params = {
    srcToken: srcToken.address,
    destToken: destToken.address,
    srcAmount: amount,
    networkID: 137,
    userAddress: USER_ADDRESS,
  }
  
  const result = await getSwapTransaction(params);

  // Attach
  const nestedFactoryFactory = await ethers.getContractFactory("NestedFactory");
  const nestedFactory = nestedFactoryFactory.attach(factoryProxy);
  // build data
  const orders = [utils.buildOrderStruct(utils.toBytes32("Paraswap"), destToken.address, [
        ["address", srcToken.address],
        ["address", destToken.address],
        ["bytes", result.data],
    ])]

    const tx = await nestedFactory.create(0, [{ inputToken: srcToken.address, amount: ethers.utils.parseEther(amount), orders, fromReserve: false }], {
        value: ethers.utils.parseEther(amount).mul(12).div(10),
    });
    tx.wait()

  // Send tx - Create portfolio
  // Attach batcher address
  const nestedAssetBatcherFactory = await ethers.getContractFactory("NestedAssetBatcher");
  const nestedBatcher = nestedAssetBatcherFactory.attach(batcher);
  //   // Read holdings
    const nfts = await nestedBatcher.getNfts(USER_ADDRESS);
    console.log(nfts);
    console.log(JSON.stringify(utils.cleanResult(nfts)));
}

main()
    .then(() => process.exit(0))
    .catch((error: Error) => {
        console.error(error);
        process.exit(1);
    });
