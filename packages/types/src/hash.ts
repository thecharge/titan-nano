import { Sha256Pattern } from "@titan/constants";
import { z } from "zod";

export const Sha256Schema = z.string().regex(Sha256Pattern);
