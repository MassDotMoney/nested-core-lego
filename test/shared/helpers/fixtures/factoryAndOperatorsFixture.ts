import { deployer } from "../deployer";
import { Fixture } from "ethereum-waffle";
import { ethers, network } from "hardhat";
import { BigNumber, Wallet } from "ethers";
import { ActorFixture } from "../actors";
import { appendDecimals } from "../../../helpers";
import { OperatorResolver, ZeroExOperator } from "../../../../typechain";
import { FactoryAndOperatorsFixture } from "../../types/FactoryAndOperatorsFixture";
import { importOperatorsWithSigner, registerFlat, registerParaswap, registerZeroEx, toBytes32 } from "../../../../scripts/utils";

export const factoryAndOperatorsFixture: Fixture<FactoryAndOperatorsFixture> = async (wallets, provider) => {
    const masterDeployer = new ActorFixture(wallets as Wallet[], provider).masterDeployer();

    // Deploy WETH
    const WETHFactory = await ethers.getContractFactory("WETH9");
    const WETH = await WETHFactory.connect(masterDeployer).deploy();
    await WETH.deployed();

    // Deploy ERC20 mocks
    const mockUNI = await deployer.deploy("MockERC20", masterDeployer, ["Mocked UNI", "UNI", appendDecimals(3000000)])
    const mockKNC = await deployer.deploy("MockERC20", masterDeployer, ["Mocked KNC", "KNC", appendDecimals(3000000)])
    const mockDAI = await deployer.deploy("MockERC20", masterDeployer, ["Mocked DAI", "DAI", appendDecimals(3000000)])
    const mockUSDC = await deployer.deploy("MockERC20", masterDeployer, ["Mocked USDC", "USDC", appendDecimals(3000000)])

    // Get the Fee shareholders (two actors)
    const shareholder1 = new ActorFixture(wallets as Wallet[], provider).shareHolder1();
    const shareholder2 = new ActorFixture(wallets as Wallet[], provider).shareHolder2();

    // Define the royaltie weight value (used in FeeSplitter)
    const royaltieWeigth = BigNumber.from(300);

    // Deploy the FeeSplitter
    const feeSplitter = await deployer.deploy("FeeSplitter", masterDeployer, [
        [shareholder1.address, shareholder2.address], [1000, 1700], royaltieWeigth, WETH.address
    ])

    // Deploy NestedAsset
    const nestedAsset = await deployer.deploy("NestedAsset", masterDeployer, [])

    // Define maxHoldingsCount value (used in NestedRecords)
    const maxHoldingsCount = BigNumber.from(15);

    // Deploy NestedRecords
    const nestedRecords = await deployer.deploy("NestedRecords", masterDeployer, [])

    // Deploy Reserve
    const nestedReserve = await deployer.deploy("NestedReserve", masterDeployer, [])

    // Deploy OperatorResolver
    const operatorResolver = await deployer.deploy("OperatorResolver", masterDeployer, [])

    // Deploy DummyRouter (fake 0x)
    const dummyRouter = await deployer.deploy("DummyRouter", masterDeployer, [])

    // Deploy ZeroExOperator
    const zeroExOperator = await deployer.deploy("ZeroExOperator", masterDeployer, [])

    // Deploy AugustusSwapper (Fake Paraswap)
    const augustusSwapper = await deployer.deploy("AugustusSwapper", masterDeployer, [])


    // Deploy ParaswapOperator
    const paraswapOperator = await deployer.deploy("ParaswapOperator", masterDeployer, [
        await augustusSwapper.proxy(), augustusSwapper.address
    ])

    // Deploy FlatOperator
    const flatOperator = await deployer.deploy("FlatOperator", masterDeployer, [])

    // Deploy Withdrawer
    const withdrawer = await deployer.deploy("Withdrawer", masterDeployer, [])

    // Deploy NestedFactory
    const nestedFactoryImpl = await deployer.deploy("NestedFactory", masterDeployer, [
        nestedAsset.address,
        nestedRecords.address,
        nestedReserve.address,
        feeSplitter.address,
        WETH.address,
        operatorResolver.address,
        withdrawer.address
    ])


    // Get the user1 actor
    const user1 = new ActorFixture(wallets as Wallet[], provider).user1();

    // add ether to wallets
    await network.provider.send("hardhat_setBalance", [
        masterDeployer.address,
        appendDecimals(100000000000000000).toHexString(),
    ]);
    await network.provider.send("hardhat_setBalance", [
        user1.address,
        appendDecimals(100000000000000000).toHexString(),
    ]);

    // Deploy FactoryProxy
    const factoryProxy = await deployer.deploy("TransparentUpgradeableProxy", masterDeployer, [
        nestedFactoryImpl.address,
        masterDeployer.address,
        []
    ])


    // Set factory to asset, records and reserve
    let tx = await nestedAsset.addFactory(factoryProxy.address);
    await tx.wait();
    tx = await nestedRecords.addFactory(factoryProxy.address);
    await tx.wait();
    tx = await nestedReserve.addFactory(factoryProxy.address);
    await tx.wait();

    deployer.addFactoryToAssets(
        factoryProxy,
        [
            nestedAsset,
            nestedRecords,
            nestedReserve
        ]
    )

    // Initialize the owner in proxy storage by calling upgradeToAndCall
    // It will upgrade with the same address (no side effects)
    const initData = await nestedFactoryImpl.interface.encodeFunctionData("initialize", [masterDeployer.address]);
    tx = await factoryProxy.connect(masterDeployer).upgradeToAndCall(nestedFactoryImpl.address, initData);
    await tx.wait();

    // Set multisig as admin of proxy, so we can call the implementation as owner
    const proxyAdmin = new ActorFixture(wallets as Wallet[], provider).proxyAdmin();
    tx = await factoryProxy.connect(masterDeployer).changeAdmin(proxyAdmin.address);
    await tx.wait();

    // Attach factory impl to proxy address
    const nestedFactory = await nestedFactoryFactory.attach(factoryProxy.address);

    // Reset feeSplitter in proxy storage
    tx = await nestedFactory.connect(masterDeployer).setFeeSplitter(feeSplitter.address);
    await tx.wait();

    // Set entry fees in proxy storage
    tx = await nestedFactory.connect(masterDeployer).setEntryFees(100);
    await tx.wait();

    // Set exit fees in proxy storage
    tx = await nestedFactory.connect(masterDeployer).setExitFees(100);
    await tx.wait();

    await importOperatorsWithSigner(
        operatorResolver as OperatorResolver,
        [registerZeroEx(zeroExOperator as ZeroExOperator), registerFlat(flatOperator), registerParaswap(paraswapOperator)],
        nestedFactory,
        masterDeployer,
    );

    // Set factory to asset, records and reserve
    await nestedAsset.connect(masterDeployer).addFactory(nestedFactory.address);
    await nestedRecords.connect(masterDeployer).addFactory(nestedFactory.address);
    await nestedReserve.connect(masterDeployer).addFactory(nestedFactory.address);

    // Define the base amount
    const baseAmount = appendDecimals(1000);

    // Send funds to User and router
    await mockUNI.connect(masterDeployer).transfer(dummyRouter.address, baseAmount);
    await mockKNC.connect(masterDeployer).transfer(dummyRouter.address, baseAmount);
    await mockDAI.connect(masterDeployer).transfer(dummyRouter.address, baseAmount);
    await mockUSDC.connect(masterDeployer).transfer(dummyRouter.address, baseAmount);
    await mockUNI.connect(masterDeployer).transfer(augustusSwapper.address, baseAmount);
    await mockKNC.connect(masterDeployer).transfer(augustusSwapper.address, baseAmount);
    await mockDAI.connect(masterDeployer).transfer(augustusSwapper.address, baseAmount);
    await mockUSDC.connect(masterDeployer).transfer(augustusSwapper.address, baseAmount);
    await mockUNI.connect(masterDeployer).transfer(user1.address, baseAmount);
    await mockKNC.connect(masterDeployer).transfer(user1.address, baseAmount);
    await mockDAI.connect(masterDeployer).transfer(user1.address, baseAmount);
    await mockUSDC.connect(masterDeployer).transfer(user1.address, baseAmount);

    // User1 approves factory to spend all his tokens (UNI, KNC, and DAI)
    await mockUNI.connect(user1).approve(nestedFactory.address, baseAmount);
    await mockKNC.connect(user1).approve(nestedFactory.address, baseAmount);
    await mockDAI.connect(user1).approve(nestedFactory.address, baseAmount);
    await mockUSDC.connect(user1).approve(nestedFactory.address, baseAmount);

    // Wrap some ETH and send them to the dummy router
    await WETH.connect(masterDeployer).deposit({ value: appendDecimals(200) });
    await WETH.connect(masterDeployer).transfer(dummyRouter.address, appendDecimals(100));
    await WETH.connect(masterDeployer).transfer(augustusSwapper.address, appendDecimals(100));

    // Deploy NestedAssetBatcher
    const nestedAssetBatcherFactory = await ethers.getContractFactory("NestedAssetBatcher");
    const nestedAssetBatcher = await nestedAssetBatcherFactory
        .connect(masterDeployer)
        .deploy(nestedAsset.address, nestedRecords.address);
    await nestedAssetBatcher.deployed();

    return {
        WETH,
        tokens: {
            mockUNI,
            mockKNC,
            mockDAI,
            mockUSDC,
        },
        wallets: {
            shareholder1,
            shareholder2,
            masterDeployer,
            user1,
            proxyAdmin,
        },
        nested: {
            nestedAsset,
            nestedRecords,
            nestedFactory,
            nestedReserve,
            nestedAssetBatcher,
            feeSplitter,
            operatorResolver,
            withdrawer,
            dummyRouter,
            augustusSwapper,
        },
        constants: {
            royaltieWeigth,
            maxHoldingsCount,
            baseAmount,
        },
        operators: {
            zeroEx: {
                zeroExOperator,
                zeroExOperatorNameBytes32: toBytes32("ZeroEx")
            },
            paraswap: {
                paraswapOperator,
                paraswapOperatorNameBytes32: toBytes32("Paraswap")
            },
            flat: {
                flatOperator,
                flatOperatorNameBytes32: toBytes32("Flat")
            }
        }
    };
};