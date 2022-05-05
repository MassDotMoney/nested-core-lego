import { Interface } from "@ethersproject/abi";
import { Fixture } from "ethereum-waffle";
import { Wallet } from "ethers";
import { ethers } from "hardhat";
import { AugustusSwapper, MockERC20, ParaswapOperator, TestableOperatorCaller } from "../../../typechain";
import { appendDecimals } from "../../helpers";
import { ActorFixture } from "../actors";

export type ParaswapOperatorFixture = {
    paraswapOperator: ParaswapOperator;
    augustusSwapper: AugustusSwapper;
    augustusSwapperInterface: Interface;
    mockUNI: MockERC20;
    mockDAI: MockERC20;
    testableOperatorCaller: TestableOperatorCaller;
};

export const paraswapOperatorFixture: Fixture<ParaswapOperatorFixture> = async (wallets, provider) => {
    const signer = new ActorFixture(wallets as Wallet[], provider).zeroExOperatorOwner();

    const augustusSwapperFactory = await ethers.getContractFactory("AugustusSwapper");
    const augustusSwapper = await augustusSwapperFactory.connect(signer).deploy();

    const augustusSwapperInterface = augustusSwapper.interface;

    const paraswapOperatorFactory = await ethers.getContractFactory("ParaswapOperator");
    const paraswapOperator = await paraswapOperatorFactory.connect(signer).deploy(await augustusSwapper.proxy(), augustusSwapper.address);

    const mockERC20Factory = await ethers.getContractFactory("MockERC20");
    const mockUNI = await mockERC20Factory.deploy("Mocked UNI", "UNI", appendDecimals(3000000));
    await mockUNI.deployed();
    const mockDAI = await mockERC20Factory.deploy("Mocked DAI", "DAI", appendDecimals(3000000));
    await mockDAI.deployed();

    await mockUNI.transfer(augustusSwapper.address, appendDecimals(1000));
    await mockDAI.transfer(augustusSwapper.address, appendDecimals(1000));

    const testableOperatorCallerFactory = await ethers.getContractFactory("TestableOperatorCaller");
    const testableOperatorCaller = await testableOperatorCallerFactory.connect(signer).deploy(paraswapOperator.address);

    await mockUNI.transfer(testableOperatorCaller.address, appendDecimals(1000));
    await mockDAI.transfer(testableOperatorCaller.address, appendDecimals(1000));

    return { paraswapOperator, augustusSwapper, augustusSwapperInterface, mockUNI, mockDAI, testableOperatorCaller };
};