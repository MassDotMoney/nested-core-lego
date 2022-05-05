import { Contract, Wallet } from "ethers";
import { ethers } from "hardhat";
import { TransparentUpgradeableProxy } from "../../../typechain";

export class Deployer {
    constructor() { }

    public deploy(
        factoryName: string,
        signer: Wallet,
        params: any[]
    ): Promise<any> {
        return new Promise(async (resolve, reject) => {
            try {
                const factory = await ethers.getContractFactory(factoryName);
                const contract = await factory.connect(signer).deploy(...params);
                await contract.deployed();
                resolve(contract);
            }
            catch (err) {
                reject(err)
            }
        })
    }

    public async addFactoryToAssets(factoryProxy: TransparentUpgradeableProxy, assets: Contract[]) {
        for (let asset of assets) {
            let tx = await asset.addFactory(factoryProxy.address);
            await tx.wait();
        }
    }
}

export const deployer: Deployer = new Deployer()