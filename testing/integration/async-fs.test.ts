import { unit } from "@titan/test-factories";
import { asyncFileSystemRepositoryCases } from "../cases/async-fs.ts";
import { asyncFileSystemRepository } from "../factories/async-fs.ts";

unit(asyncFileSystemRepository, asyncFileSystemRepositoryCases);
