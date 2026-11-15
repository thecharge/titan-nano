import { unit } from "@titan/test-factories";
import { promiseSyntaxCases } from "../cases/promises.ts";
import { promiseSyntax } from "../factories/promises.ts";

unit(promiseSyntax, promiseSyntaxCases);
