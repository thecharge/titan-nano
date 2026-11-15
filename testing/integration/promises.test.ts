import { unit } from "@titan/test-factories";
import { promiseRepositoryCases } from "../cases/promises.ts";
import { promiseRepository } from "../factories/promises.ts";

unit(promiseRepository, promiseRepositoryCases);
