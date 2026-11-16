import { Backend } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const nativeWorkspaceWriteCases = {
  positive: [
    positive("workspace managed writer updates an observed file", ["update", false], true),
    positive("workspace managed writer creates a missing descendant", ["create", false], true),
    positive("workspace managed writer supports empty content", ["empty", false], true),
  ],
  negative: [
    rejected("workspace managed writer preserves stale content", ["stale", true], true),
    rejected(
      "workspace managed writer refuses existing files with a null version",
      ["existing", true],
      true,
    ),
    rejected(
      "workspace managed writer refuses a missing parent for an existing version",
      ["missing", true],
      true,
    ),
    rejected(
      "workspace managed writer refuses a non-directory parent",
      ["file-parent", true],
      true,
    ),
    rejected("workspace managed writer refuses linked parents", ["symlink-parent", true], true),
    rejected("workspace managed writer refuses shared inodes", ["linked", true], true),
  ],
};

export const nativeManagedSdkWriteCases = {
  positive: [
    positive(
      "Codex SDK writes and creates declared files through the production server",
      [Backend.Codex, false],
      true,
    ),
    positive(
      "Claude SDK writes and creates declared files through the production server",
      [Backend.Claude, false],
      true,
    ),
  ],
  negative: [
    rejected("Codex SDK refuses undeclared and stale managed writes", [Backend.Codex, true], true),
    rejected(
      "Claude SDK refuses undeclared and stale managed writes",
      [Backend.Claude, true],
      true,
    ),
  ],
};

export const nativeManagedWriteCases = {
  positive: [
    positive("managed update preserves the shared inode", ["allowed.txt", true], true),
    positive("managed creation admits a missing declared file", ["allowed.txt", false], true),
    positive("managed creation makes declared parent directories", ["nested/new.txt", true], true),
  ],
  negative: [
    rejected(
      "managed write refuses runtime-owned paths inside its declared scope",
      ["runtime/new.txt", true, true],
      true,
    ),
    rejected("managed write refuses an unlisted path", ["outside.txt", true, true], true),
    rejected("managed write refuses a stale version", ["allowed.txt", true, true, true], true),
    rejected(
      "managed write refuses a read-only persona",
      ["allowed.txt", true, true, false, true],
      true,
    ),
    rejected(
      "managed write refuses a multiply linked file",
      ["allowed.txt", true, true, false, false, true],
      true,
    ),
  ],
};
export const nativeFileGrantCases = {
  positive: [
    positive("exact scope grants only its existing file", [["allowed.txt"], ["allowed.txt"]], true),
    positive(
      "directory scope grants ordinary descendant files",
      [["directory"], ["directory/child.txt"]],
      true,
    ),
    positive("missing file scope needs managed creation", [["new.txt"], []], true),
  ],
  negative: [
    rejected(
      "native grants refuse a file used as a parent directory",
      [["allowed.txt/child"], [], false, [], true],
      true,
    ),
    rejected(
      "root scope omits protected metadata",
      [["."], ["allowed.txt", "directory/child.txt"]],
      true,
    ),
    rejected(
      "runtime omissions stay outside native grants",
      [["."], ["allowed.txt"], false, ["directory"]],
      true,
    ),
    rejected("hard-linked scope is refused before launch", [["allowed.txt"], [], true], true),
    rejected(
      "explicit protected metadata never becomes a native grant",
      [[".git/config"], []],
      true,
    ),
  ],
};
