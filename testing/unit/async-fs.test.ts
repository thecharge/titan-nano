import { unit } from "@titan/test-factories";
import { asyncFileSystemSyntaxCases } from "../cases/async-fs.ts";
import { asyncFileSystemSyntax } from "../factories/async-fs.ts";

unit(asyncFileSystemSyntax, asyncFileSystemSyntaxCases);
