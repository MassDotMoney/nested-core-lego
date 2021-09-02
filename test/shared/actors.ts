import { MockProvider } from "ethereum-waffle";
import { Wallet } from "ethers";

export const WALLET_USER_INDEXES = {
    ADDRESS_RESOLVER_OWNER: 1,
    USER_1: 2,
    OWNABLE_OPERATOR_OWNER: 3,
};

export class ActorFixture {
    wallets: Array<Wallet>;
    provider: MockProvider;

    constructor(wallets: Wallet[], provider: MockProvider) {
        this.wallets = wallets;
        this.provider = provider;
    }

    addressResolverOwner() {
        return this._getActor(WALLET_USER_INDEXES.ADDRESS_RESOLVER_OWNER);
    }

    user1() {
        return this._getActor(WALLET_USER_INDEXES.USER_1);
    }

    ownableOperatorOwner() {
        return this._getActor(WALLET_USER_INDEXES.OWNABLE_OPERATOR_OWNER);
    }

    private _getActor(index: number): Wallet {
        /* Actual logic for fetching the wallet */
        if (!index) {
            throw new Error(`Invalid index: ${index}`);
        }
        const account = this.wallets[index];
        if (!account) {
            throw new Error(`Account ID ${index} could not be loaded`);
        }
        return account;
    }
}
