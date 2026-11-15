import { SdkProcessFixture, TestSchedule } from "@titan/constants";
import { unit } from "@titan/test-factories";
import { operationalPeerCases } from "../cases/operational-peer.ts";
import { operationalPeer } from "../factories/operational-peer.ts";

unit(operationalPeer, operationalPeerCases, SdkProcessFixture.CaseTimeout, TestSchedule.Concurrent);
