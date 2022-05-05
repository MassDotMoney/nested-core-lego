import { Interface } from "@ethersproject/abi";
import { AugustusSwapper, MockERC20, ParaswapOperator, TestableOperatorCaller } from "../../../../../typechain";

export type ParaswapOperatorFixture = {
    paraswapOperator: ParaswapOperator;
    augustusSwapper: AugustusSwapper;
    augustusSwapperInterface: Interface;
    mockUNI: MockERC20;
    mockDAI: MockERC20;
    testableOperatorCaller: TestableOperatorCaller;
};