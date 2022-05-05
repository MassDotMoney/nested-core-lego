import { Interface } from "@ethersproject/abi";
import { DummyRouter, MockERC20, TestableOperatorCaller, ZeroExOperator } from "../../../../../typechain";

export type ZeroExOperatorFixture = {
    zeroExOperator: ZeroExOperator;
    dummyRouter: DummyRouter;
    dummyRouterInterface: Interface;
    mockUNI: MockERC20;
    mockDAI: MockERC20;
    testableOperatorCaller: TestableOperatorCaller;
};