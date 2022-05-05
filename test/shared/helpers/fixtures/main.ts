import { AppFixtures } from "../../types/appFixture";
import { zeroExOperatorFixture } from "./zeroExOperatorFixture";
import { operatorResolverFixture } from "./operatorResolverFixture";
import { paraswapOperatorFixture } from "./paraswapOperatorFixture";
import { factoryAndOperatorsFixture } from "./factoryAndOperatorsFixture";
import { factoryAndOperatorsForkingBSCFixture } from "./factoryAndOperatorsForkingBSCFixture";

export const fixtures: AppFixtures = {
    operatorResolverFixture: operatorResolverFixture,
    zeroExOperatorFixture: zeroExOperatorFixture,
    paraswapOperatorFixture: paraswapOperatorFixture,
    factoryAndOperatorsFixture: factoryAndOperatorsFixture,
    factoryAndOperatorsForkingBSCFixture: factoryAndOperatorsForkingBSCFixture,
}