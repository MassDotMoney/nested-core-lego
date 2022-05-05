import { Fixture } from "ethereum-waffle"
import { ZeroExOperatorFixture } from "../helpers/fixtures/zeroExOperatorFixture"
import { ParaswapOperatorFixture } from "../helpers/fixtures/paraswapOperatorFixture"
import { FactoryAndOperatorsFixture } from "./FactoryAndOperatorsFixture"
import { OperatorResolverFixture } from "./OperatorResolverFixture"
import { FactoryAndOperatorsForkingBSCFixture } from "./FactoryAndOperatorsForkingBSCFixture"


export type AppFixtures = {
    operatorResolverFixture: Fixture<OperatorResolverFixture>;
    zeroExOperatorFixture: Fixture<ZeroExOperatorFixture>;
    paraswapOperatorFixture: Fixture<ParaswapOperatorFixture>;
    factoryAndOperatorsFixture: Fixture<FactoryAndOperatorsFixture>;
    factoryAndOperatorsForkingBSCFixture: Fixture<FactoryAndOperatorsForkingBSCFixture>;
}