import { unit } from "@titan/test-factories";
import { nativeActorRouteCases } from "../cases/native-actor-route.ts";
import { nativeActorRoute } from "../factories/native-actor-route.ts";

unit(nativeActorRoute, nativeActorRouteCases);
