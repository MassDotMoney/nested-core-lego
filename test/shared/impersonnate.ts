import { BigNumber, Wallet } from "ethers";
import { ethers, network } from "hardhat";

const abiCoder = new ethers.utils.AbiCoder();


export const impersonnate = async (address: string) => {
    await network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [address],
    })

    return await ethers.getSigner(address)
}

export const addBscUsdcBalanceTo = async (receiver: Wallet, amount: BigNumber) => {
    const usdcWhale: string = "0xf977814e90da44bfa03b6295a0616a897441acec"
    const usdcContract: string = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d"
    const signer = await impersonnate(usdcWhale)

    const data =
        ethers.utils.keccak256(
            ethers.utils.toUtf8Bytes("transfer(address,uint256)")
        ).slice(0, 10) +
        abiCoder.encode(
            ["address", "uint256"],
            [receiver.address, amount]
        ).slice(2, 130)

    await signer.sendTransaction({
        from: signer.address,
        to: usdcContract,
        data: data
    })
}

export const addEthEurtBalanceTo = async (receiver: Wallet, amount: BigNumber) => {
    const eurtWhale: string = "0x5754284f345afc66a98fbb0a0afe71e0f007b949"
    const eurtContract: string = "0xC581b735A1688071A1746c968e0798D642EDE491"
    const signer = await impersonnate(eurtWhale)

    const data =
        ethers.utils.keccak256(
            ethers.utils.toUtf8Bytes("transfer(address,uint256)")
        ).slice(0, 10) +
        abiCoder.encode(
            ["address", "uint256"],
            [receiver.address, amount]
        ).slice(2, 130)
    await signer.sendTransaction({
        from: signer.address,
        to: eurtContract,
        data: data
    })
}