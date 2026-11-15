import {
  Backend,
  ErrorCode,
  ProgramCheck,
  ProgramFault,
  ProgramRun,
  RunStatus,
} from "@titan/constants";
import { ProgramMessage } from "@titan/messages";
import { positive, rejected } from "@titan/test-factories";

export const programWorkflowCases = {
  positive: [
    positive(
      "program with a persona backend gets the events and run record of the command line",
      [{ [ProgramRun.Persona]: Backend.Claude }, ProgramFault.None],
      "true true",
    ),
    positive(
      "program without a backend map gets the events and run record of the command line",
      [{}, ProgramFault.None],
      "true true",
    ),
    positive(
      "follow of a running program waits for the later events and finishes",
      [{}, ProgramFault.Follow],
      "true true",
    ),
    positive(
      "follow of a running program with a persona backend waits and finishes",
      [{ [ProgramRun.Persona]: Backend.Claude }, ProgramFault.Follow],
      "true true",
    ),
  ],
  negative: [
    rejected(
      "follow of an ended program returns without waiting and the run cannot resume",
      [{}, ProgramFault.Ended],
      ErrorCode.TerminalRun,
    ),
    rejected(
      "follow of an ended slow program returns without waiting and the run cannot resume",
      [{}, ProgramFault.EndedSlow],
      ErrorCode.TerminalRun,
    ),
    rejected(
      "an inherited constructor cannot receive a backend override",
      [{ [ProgramCheck.Constructor]: Backend.Claude }, ProgramFault.Persona],
      ErrorCode.Arguments,
    ),
    rejected(
      "an inherited method cannot receive a backend override",
      [{ [ProgramCheck.PrototypeMethod]: Backend.Codex }, ProgramFault.Persona],
      ErrorCode.Arguments,
    ),
    rejected(
      "backend naming a persona the workflow lacks is refused",
      [{ [ProgramCheck.Ghost]: Backend.Claude }, ProgramFault.Persona],
      ErrorCode.Arguments,
    ),
    rejected(
      "run with no backend given and no default in the settings is refused",
      [{}, ProgramFault.NoBackend],
      ErrorCode.Backend,
    ),
    rejected(
      "resume of a handle not made by runWorkflow is refused",
      [{}, ProgramFault.Handle],
      ErrorCode.RunNotFound,
    ),
    rejected(
      "resume of a run that has ended is refused",
      [{}, ProgramFault.Resume],
      ErrorCode.TerminalRun,
    ),
    rejected(
      "answer to a request the run never opened is refused",
      [{}, ProgramFault.Answer],
      ErrorCode.RequestNotFound,
    ),
  ],
};

export const backendNamingCases = {
  positive: [
    positive("a backend named for the run starts it", [{}, true], RunStatus.Passed),
    positive(
      "a backend named with a persona map starts the run",
      [{ [ProgramRun.Persona]: Backend.Claude }, true],
      RunStatus.Passed,
    ),
  ],
  negative: [
    rejected(
      "no backend named is refused and the message names the missing choice",
      [{}, false],
      ProgramMessage.BackendMissing,
    ),
    rejected(
      "a persona map alone is refused and the message names the missing choice",
      [{ [ProgramRun.Persona]: Backend.Claude }, false],
      ProgramMessage.BackendMissing,
    ),
  ],
};

export const programHttpCases = {
  positive: [
    positive(
      "events read page by page over HTTP match the command line events",
      [{}, ProgramFault.None],
      "true true",
    ),
    positive(
      "events over HTTP match the command line when a persona names a backend",
      [{ [ProgramRun.Persona]: Backend.Codex }, ProgramFault.None],
      "true true",
    ),
  ],
  negative: [
    rejected(
      "run started with an empty project is refused",
      [{}, ProgramFault.Submission],
      ErrorCode.InvalidSubmission,
    ),
    rejected(
      "events of a run that does not exist are refused",
      [{}, ProgramFault.Run],
      ErrorCode.RunNotFound,
    ),
  ],
};
