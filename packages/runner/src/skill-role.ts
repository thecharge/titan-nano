import { ErrorCode, FileEncoding, Newline, PathPart, WorkspaceSkill } from "@titan/constants";
import { hash } from "@titan/core";
import { TitanError } from "@titan/errors";
import { NativeToolMessage, RunnerMessage } from "@titan/messages";
import type { NativeFileResult, Persona, Run } from "@titan/types";

export function skillRole(run: Run, persona: Persona): string {
  const skills = run.workspace_skills;
  if (!skills?.index.length) return persona.role;
  const index = skills.index.map(({ name, description }) =>
    RunnerMessage.SkillIndexEntry(name, description),
  );
  const instructions = skills.files
    .filter(
      ({ name, path }) => persona.skills?.includes(name) && path === WorkspaceSkill.Instructions,
    )
    .map(({ name, content, hash: expected }) => {
      if (hash(Buffer.from(content, FileEncoding.Utf8)) !== expected)
        throw new TitanError(ErrorCode.SnapshotChanged, name);
      return RunnerMessage.SkillInstructions(name, content);
    });
  return [
    persona.role,
    RunnerMessage.SkillIndexHeading,
    ...index,
    ...(instructions.length
      ? [RunnerMessage.SkillReferenceAccess(WorkspaceSkill.VirtualDirectory)]
      : []),
    ...instructions,
  ].join(Newline);
}

export function isSkillPath(run: Run, path: string): boolean {
  return (
    run.workspace_skills !== undefined &&
    path.startsWith(WorkspaceSkill.VirtualDirectory + PathPart.Separator)
  );
}

export function readSkill(run: Run, path: string, persona?: Persona): NativeFileResult {
  const [, name, ...relative] = path.split(PathPart.Separator);
  const file = run.workspace_skills?.files.find(
    (entry) => entry.name === name && entry.path === relative.join(PathPart.Separator),
  );
  if (!file || (persona && !persona.skills?.includes(file.name)))
    throw new TitanError(ErrorCode.PermissionDenied, NativeToolMessage.Denied);
  const content = Buffer.from(file.content, FileEncoding.Utf8);
  if (hash(content) !== file.hash) throw new TitanError(ErrorCode.SnapshotChanged, path);
  return {
    observation: { path, version: file.hash, hash: file.hash, executable: false },
    content: content.toString(FileEncoding.Base64),
  };
}
