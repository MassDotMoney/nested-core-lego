import { BigNumber, Wallet } from "ethers";
import { BeefyVaultOperator, BeefyVaultStorage, FeeSplitter, FlatOperator, NestedAsset, NestedAssetBatcher, NestedFactory, NestedRecords, NestedReserve, OperatorResolver, WETH9, Withdrawer, ZeroExOperator } from "../../../../../typechain";


export type FactoryAndOperatorsForkingBSCFixture = {
    WBNB: WETH9;
    shareholder1: Wallet;
    shareholder2: Wallet;
    feeSplitter: FeeSplitter;
    royaltieWeigth: BigNumber;
    nestedAsset: NestedAsset;
    nestedRecords: NestedRecords;
    maxHoldingsCount: BigNumber;
    operatorResolver: OperatorResolver;
    swapTargetAddress: string;
    zeroExOperator: ZeroExOperator;
    zeroExOperatorNameBytes32: string;
    flatOperator: FlatOperator;
    flatOperatorNameBytes32: string;
    beefyVenusBNBVaultAddress: string;
    beefyVaultOperator: BeefyVaultOperator;
    beefyVaultStorage: BeefyVaultStorage;
    beefyVaultDepositOperatorNameBytes32: string;
    beefyVaultWithdrawOperatorNameBytes32: string;
    withdrawer: Withdrawer;
    nestedFactory: NestedFactory;
    nestedReserve: NestedReserve;
    masterDeployer: Wallet;
    user1: Wallet;
    proxyAdmin: Wallet;
    baseAmount: BigNumber;
    nestedAssetBatcher: NestedAssetBatcher;
};