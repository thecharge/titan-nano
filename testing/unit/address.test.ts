import { unit } from "@titan/test-factories";
import { AddressSchema } from "@titan/types";
import { addressCases } from "../cases/address.ts";

unit(AddressSchema.parse.bind(AddressSchema), addressCases);
