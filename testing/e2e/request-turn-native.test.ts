import { SdkProcessFixture, TestSchedule } from "@titan/constants";
import { unit } from "@titan/test-factories";
import { nativeRequestTurnCases } from "../cases/request-turn-native.ts";
import { requestTurn } from "../factories/request-turn.ts";

unit(requestTurn, nativeRequestTurnCases, SdkProcessFixture.CaseTimeout, TestSchedule.Concurrent);
