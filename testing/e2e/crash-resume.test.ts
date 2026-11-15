import { SdkProcessFixture, TestSchedule } from "@titan/constants";
import { unit } from "@titan/test-factories";
import { crashResumeCases } from "../cases/crash-resume.ts";
import { crashResume } from "../factories/crash-resume.ts";

unit(crashResume, crashResumeCases, SdkProcessFixture.CaseTimeout, TestSchedule.Concurrent);
