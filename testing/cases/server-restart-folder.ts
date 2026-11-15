import { HttpStatus, ServerFolderCheck, ServerFolderFixture } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const serverRestartFolderCases = {
  positive: [
    positive(
      "same home and same run after the restart",
      [ServerFolderCheck.Home],
      ServerFolderFixture.Both,
    ),
    positive(
      "server really started from two different folders",
      [ServerFolderCheck.Moved],
      ServerFolderFixture.Both,
    ),
    positive(
      "run keeps its recorded project folder, not the new folder",
      [ServerFolderCheck.Project],
      ServerFolderFixture.Both,
    ),
    positive("run keeps its resolved backends", [ServerFolderCheck.Backends], true),
    positive("run keeps its kept result", [ServerFolderCheck.Result], true),
    positive(
      "kept result's agent does not run again: board journal is unchanged",
      [ServerFolderCheck.Journal],
      true,
    ),
  ],
  negative: [
    rejected(
      "unknown run id is refused after the restart",
      [ServerFolderCheck.Missing],
      HttpStatus.BadRequest,
    ),
    rejected(
      "run is not known to another home",
      [ServerFolderCheck.OtherHome],
      HttpStatus.BadRequest,
    ),
  ],
};
