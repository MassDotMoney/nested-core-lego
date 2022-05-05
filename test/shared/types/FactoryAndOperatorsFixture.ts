import { BigNumber, Wallet } from "ethers";
import {
    AugustusSwapper,
    DummyRouter,
    FeeSplitter,
    FlatOperator,
    MockERC20,
    NestedAsset,
    NestedAssetBatcher,
    NestedFactory,
    NestedRecords,
    NestedReserve,
    OperatorResolver,
    ParaswapOperator,
    WETH9,
    Withdrawer,
    ZeroExOperator
} from "../../../typechain";

export type FactoryAndOperatorsFixture = {
    WETH: WETH9;
    tokens: {
        mockUNI: MockERC20;
        mockKNC: MockERC20;
        mockDAI: MockERC20;
        mockUSDC: MockERC20;
    }
    wallets: {
        shareholder1: Wallet;
        shareholder2: Wallet;
        masterDeployer: Wallet;
        user1: Wallet;
        proxyAdmin: Wallet;
    }
    nested: {
        nestedAsset: NestedAsset;
        nestedRecords: NestedRecords;
        nestedFactory: NestedFactory;
        nestedReserve: NestedReserve;
        nestedAssetBatcher: NestedAssetBatcher;
        feeSplitter: FeeSplitter;
        operatorResolver: OperatorResolver;
        withdrawer: Withdrawer;
        dummyRouter: DummyRouter;
        augustusSwapper: AugustusSwapper;
    }
    constants: {
        royaltieWeigth: BigNumber;
        maxHoldingsCount: BigNumber;
        baseAmount: BigNumber;
    }
    operators: {
        zeroEx: {
            zeroExOperator: ZeroExOperator;
            zeroExOperatorNameBytes32: string;
        }
        paraswap: {
            paraswapOperator: ParaswapOperator;
            paraswapOperatorNameBytes32: string;
        }
        flat: {
            flatOperator: FlatOperator;
            flatOperatorNameBytes32: string;
        }
    }
};
