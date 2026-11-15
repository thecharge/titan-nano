export const ImprovementMessage = {
  ScriptChanged: (id: string): string =>
    `new or changed script in step ${id}: only the main agent writes scripts`,
  WeakerStep: (id: string): string =>
    `check 2 refuted the new workflow: step ${id} has fewer falsifiers or lost a script falsifier`,
  MoreAttempts: (next: number, old: number): string =>
    `kept old workflow: more attempts (${next} > ${old})`,
  MoreAgents: (next: number, old: number): string =>
    `kept old workflow: more agents (${next} > ${old})`,
  NotPassed: "kept old workflow: the new run did not pass",
  Change: (change: string, reason: string): string => `${change} (${reason})`,
} as const;

export const ImproveLoopMessage = {
  Rounds: "--rounds must be a positive whole number",
  RoundsMissing: "no improve rounds: add an improve part to the workflow or pass --rounds",
  NotFinished: (state: string): string => `run is ${state}: improve needs a passed or failed run`,
  Kept: (round: number, file: string): string => `round ${round}: kept new workflow ${file}`,
  NotKept: (round: number, reason: string): string => `round ${round}: ${reason}`,
  Summary: (kept: number, rounds: number): string =>
    `new workflow files kept: ${kept} of ${rounds} rounds run`,
} as const;
