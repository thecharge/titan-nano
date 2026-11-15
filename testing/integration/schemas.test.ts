import { unit } from "@titan/test-factories";
import { dataShapeNamesCases, dataShapeTreeCases, ownedDataShapeCases } from "../cases/schemas.ts";
import { dataShapeNames, dataShapeTree, ownedDataShape } from "../factories/schemas.ts";

unit(dataShapeNames, dataShapeNamesCases);
unit(dataShapeTree, dataShapeTreeCases);

unit(ownedDataShape, ownedDataShapeCases);
