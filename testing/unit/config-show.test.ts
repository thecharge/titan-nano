import { unit } from "@titan/test-factories";
import { configShowInvocationCases } from "../cases/config-show.ts";
import { checkedInvocation } from "../factories/cli.ts";

unit(checkedInvocation, configShowInvocationCases);
