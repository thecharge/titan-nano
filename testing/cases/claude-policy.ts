import {
  AgentTool,
  ClaudeEventKind,
  ClaudeMcpFixture,
  ClaudePermission,
  ErrorCode,
  NativeStreamOutcome,
  SymlinkFixture,
} from "@titan/constants";
import { ClaudeMessage } from "@titan/messages";
import { negative, positive, rejected } from "@titan/test-factories";

const allowed = {
  hook: {
    hookSpecificOutput: {
      hookEventName: ClaudeEventKind.PreToolUse,
      permissionDecision: ClaudePermission.Allow,
      permissionDecisionReason: ClaudeMessage.WorkspacePolicy,
    },
  },
  permission: { behavior: ClaudePermission.Allow, updatedInput: { file_path: "inside.txt" } },
};
const denied = {
  hook: {
    hookSpecificOutput: {
      hookEventName: ClaudeEventKind.PreToolUse,
      permissionDecision: ClaudePermission.Deny,
      permissionDecisionReason: ClaudeMessage.WorkspacePolicy,
    },
  },
  permission: { behavior: ClaudePermission.Deny, message: ClaudeMessage.ToolDenied },
};
export const claudeToolPolicyCases = {
  positive: [
    positive(
      "plain output start retains the explicit read policy",
      [
        [AgentTool.Read],
        false,
        AgentTool.Read,
        false,
        undefined,
        SymlinkFixture.None,
        undefined,
        false,
        ClaudeEventKind.PreToolUse,
        false,
      ],
      { tools: [AgentTool.Read], ...allowed },
    ),
    positive(
      "plain output resume retains the explicit read policy",
      [
        [AgentTool.Read],
        false,
        AgentTool.Read,
        false,
        undefined,
        SymlinkFixture.None,
        undefined,
        true,
        ClaudeEventKind.PreToolUse,
        false,
      ],
      { tools: [AgentTool.Read], ...allowed },
    ),
    positive("explicit read grants only read", [[AgentTool.Read], false, AgentTool.Read], {
      tools: [AgentTool.Read],
      ...allowed,
    }),
    positive("explicit write grants only write", [[AgentTool.Write], true, AgentTool.Write], {
      tools: [AgentTool.Write],
      ...allowed,
    }),
    positive(
      "writable shell grants only the shell",
      [[AgentTool.Bash], true, AgentTool.Bash, false, { command: "bun test" }],
      {
        tools: [AgentTool.Bash],
        hook: allowed.hook,
        permission: { behavior: ClaudePermission.Allow, updatedInput: { command: "bun test" } },
      },
    ),
    positive(
      "writable shell allows a command inside the folder",
      [[AgentTool.Bash], true, AgentTool.Bash, false, { command: "ls src && echo done" }],
      {
        tools: [AgentTool.Bash],
        hook: allowed.hook,
        permission: {
          behavior: ClaudePermission.Allow,
          updatedInput: { command: "ls src && echo done" },
        },
      },
    ),
    positive("explicit edit grants only edit", [[AgentTool.Edit], true, AgentTool.Edit], {
      tools: [AgentTool.Edit],
      ...allowed,
    }),
  ],
  negative: [
    negative(
      "unexpected hook event cannot authorize a new session tool",
      [
        [AgentTool.Read],
        false,
        AgentTool.Read,
        false,
        undefined,
        SymlinkFixture.None,
        undefined,
        false,
        "PostToolUse",
      ],
      { message: ClaudeMessage.UnexpectedHook },
    ),
    negative(
      "unexpected hook event cannot authorize a resumed session tool",
      [
        [AgentTool.Read],
        false,
        AgentTool.Read,
        false,
        undefined,
        SymlinkFixture.None,
        undefined,
        true,
        "SessionStart",
      ],
      { message: ClaudeMessage.UnexpectedHook },
    ),
    rejected(
      "inherited MCP read remains outside persona tools",
      [[AgentTool.Read], false, ClaudeMcpFixture.Read],
      { tools: [AgentTool.Read], ...denied },
    ),
    rejected(
      "inherited MCP write remains outside writable persona tools",
      [[AgentTool.Write], true, ClaudeMcpFixture.Write],
      { tools: [AgentTool.Write], ...denied },
    ),
    rejected("empty tools cannot read", [[], false, AgentTool.Read], { tools: [], ...denied }),
    rejected("writable empty tools cannot write", [[], true, AgentTool.Write], {
      tools: [],
      ...denied,
    }),
    rejected("read does not implicitly grant grep", [[AgentTool.Read], false, AgentTool.Grep], {
      tools: [AgentTool.Read],
      ...denied,
    }),
    rejected("write does not implicitly grant read", [[AgentTool.Write], true, AgentTool.Read], {
      tools: [AgentTool.Write],
      ...denied,
    }),
    rejected("later mutation cannot grant shell", [[AgentTool.Read], true, AgentTool.Bash, true], {
      tools: [AgentTool.Read],
      ...denied,
    }),
    rejected(
      "later mutation cannot grant write",
      [[AgentTool.Read], false, AgentTool.Write, true],
      {
        tools: [AgentTool.Read],
        ...denied,
      },
    ),
    negative("read-only phase refuses write", [[AgentTool.Write], false, AgentTool.Write], {
      code: ErrorCode.PermissionDenied,
      message: ClaudeMessage.UnsupportedTools,
    }),
    negative("read-only phase refuses edit", [[AgentTool.Edit], false, AgentTool.Edit], {
      code: ErrorCode.PermissionDenied,
      message: ClaudeMessage.UnsupportedTools,
    }),
    negative("read-only phase refuses shell", [[AgentTool.Bash], false, AgentTool.Bash], {
      code: ErrorCode.PermissionDenied,
      message: ClaudeMessage.UnsupportedTools,
    }),
    negative("unknown native tools are refused", [["UnknownTool"], true, "UnknownTool"], {
      code: ErrorCode.PermissionDenied,
      message: ClaudeMessage.UnsupportedTools,
    }),
  ],
};

const pathAllowed = { hookAllowed: true, permissionAllowed: true };
const pathDenied = { hookAllowed: false, permissionAllowed: false };
export const claudeScopedWriteCases = {
  positive: [
    positive(
      "a declared file may be written",
      [AgentTool.Write, "inside.txt", ["inside.txt"], false],
      pathAllowed,
    ),
    positive(
      "a declared directory permits a new descendant",
      [AgentTool.Write, "src/new.txt", ["src"], false],
      pathAllowed,
    ),
    positive(
      "a declared file may be edited after resume",
      [AgentTool.Edit, "inside.txt", ["inside.txt"], false, false, true],
      pathAllowed,
    ),
    positive(
      "a whole-project declaration preserves ordinary writes",
      [AgentTool.Write, "nested/new.txt", ["."], false],
      pathAllowed,
    ),
  ],
  negative: [
    rejected(
      "another file is outside the write scope",
      [AgentTool.Write, "other.txt", ["inside.txt"], false],
      pathDenied,
    ),
    rejected(
      "a similar directory prefix cannot expand the scope",
      [AgentTool.Edit, "src-extra/file.txt", ["src"], false],
      pathDenied,
    ),
    rejected(
      "a read claim cannot become a write permission",
      [AgentTool.Write, "inside.txt", ["inside.txt"], true],
      pathDenied,
    ),
    rejected(
      "mutating the caller scope cannot grant a file",
      [AgentTool.Write, "other.txt", ["inside.txt"], false, true],
      pathDenied,
    ),
    rejected(
      "resumed callbacks retain their declared scope",
      [AgentTool.Edit, "other.txt", ["inside.txt"], false, false, true],
      pathDenied,
    ),
    rejected(
      "a declared protected path stays closed",
      [AgentTool.Write, ".titan/owner", [".titan"], false],
      pathDenied,
    ),
    rejected(
      "a declared parent traversal stays closed",
      [AgentTool.Write, "src/../other.txt", ["."], false],
      pathDenied,
    ),
  ],
};
export const claudePathPolicyCases = {
  positive: [
    positive(
      "Read retains access to an ordinary hard-linked file",
      [AgentTool.Read, { file_path: "link" }, SymlinkFixture.HardLink],
      pathAllowed,
    ),
    positive(
      "Grep retains access to an ordinary hard-linked file",
      [AgentTool.Grep, { pattern: "fixture", path: "link" }, SymlinkFixture.HardLink],
      pathAllowed,
    ),
    positive(
      "Ordinary hidden code configuration remains readable",
      [AgentTool.Read, { file_path: ".github/workflows/check.yml" }],
      pathAllowed,
    ),
    positive(
      "Similar environment name remains writable",
      [AgentTool.Write, { file_path: ".environment.txt" }],
      pathAllowed,
    ),
    positive(
      "Shell runs a plain test command",
      [AgentTool.Bash, { command: "bun test" }],
      pathAllowed,
    ),
    positive(
      "Shell may name a similar hidden code folder",
      [AgentTool.Bash, { command: "ls .github && cat src/a.ts" }],
      pathAllowed,
    ),
    positive(
      "Shell may use a variable it set itself",
      [AgentTool.Bash, { command: "F=src/a.ts; cat $F" }],
      pathAllowed,
    ),
    positive("Read uses its file path", [AgentTool.Read, { file_path: "inside.txt" }], pathAllowed),
    positive(
      "Write permits a new nested file",
      [AgentTool.Write, { file_path: "nested/new.txt" }],
      pathAllowed,
    ),
    positive(
      "Glob permits recursive extension alternatives",
      [AgentTool.Glob, { pattern: "src/**/*.{ts,tsx}" }],
      pathAllowed,
    ),
    positive(
      "Glob permits a scoped search directory",
      [AgentTool.Glob, { pattern: "*.md", path: "notes" }],
      pathAllowed,
    ),
    positive(
      "Grep uses its regex and directory",
      [AgentTool.Grep, { pattern: "needle", path: "src" }],
      pathAllowed,
    ),
    positive(
      "Grep permits a relative glob filter",
      [AgentTool.Grep, { pattern: "", glob: "*.{ts,tsx}" }],
      pathAllowed,
    ),
  ],
  negative: [
    rejected(
      "Write cannot modify another path through a hard link",
      [AgentTool.Write, { file_path: "link" }, SymlinkFixture.HardLink],
      pathDenied,
    ),
    rejected(
      "Edit cannot modify another path through a hard link",
      [AgentTool.Edit, { file_path: "link" }, SymlinkFixture.HardLink],
      pathDenied,
    ),
    rejected(
      "Shell cannot name Git metadata",
      [AgentTool.Bash, { command: "cat .git/config" }],
      pathDenied,
    ),
    rejected(
      "Shell cannot run git",
      [AgentTool.Bash, { command: "git push origin main" }],
      pathDenied,
    ),
    rejected(
      "Shell cannot reach the runtime folder",
      [AgentTool.Bash, { command: "rm -rf .titan" }],
      pathDenied,
    ),
    rejected(
      "Shell cannot leave the folder",
      [AgentTool.Bash, { command: "cat ../secret" }],
      pathDenied,
    ),
    rejected(
      "Shell cannot use an absolute path outside",
      [AgentTool.Bash, { command: "cat /etc/passwd" }],
      pathDenied,
    ),
    rejected(
      "Shell cannot expand a variable",
      [AgentTool.Bash, { command: "cat $HOME/.ssh/id" }],
      pathDenied,
    ),
    rejected("Shell needs a command", [AgentTool.Bash, { cmd: "ls" }], pathDenied),
    rejected(
      "Read cannot inspect runtime ownership",
      [AgentTool.Read, { file_path: ".titan/agent-writer.db" }],
      pathDenied,
    ),
    rejected(
      "Write cannot alter runtime ownership",
      [AgentTool.Write, { file_path: ".titan/agent-writer.db" }],
      pathDenied,
    ),
    rejected(
      "Edit cannot change Git configuration",
      [AgentTool.Edit, { file_path: ".git/config" }],
      pathDenied,
    ),
    rejected(
      "Read cannot inspect environment credentials",
      [AgentTool.Read, { file_path: ".env" }],
      pathDenied,
    ),
    rejected(
      "Write cannot create environment credentials",
      [AgentTool.Write, { file_path: ".env.local" }],
      pathDenied,
    ),
    rejected(
      "Read cannot inspect nested agent settings",
      [AgentTool.Read, { file_path: "nested/.claude/settings.json" }],
      pathDenied,
    ),
    rejected(
      "Write cannot alter nested harness instructions",
      [AgentTool.Write, { file_path: "nested/.agents/skills/titan/SKILL.md" }],
      pathDenied,
    ),
    rejected(
      "Glob cannot target runtime metadata",
      [AgentTool.Glob, { pattern: "*", path: ".titan" }],
      pathDenied,
    ),
    rejected(
      "Grep cannot target credential file",
      [AgentTool.Grep, { pattern: "needle", path: ".env.production" }],
      pathDenied,
    ),
    rejected(
      "Grep cannot target nested Git metadata",
      [AgentTool.Grep, { pattern: "needle", path: "nested/.git" }],
      pathDenied,
    ),
    rejected(
      "Read cannot inspect ignored dependencies",
      [AgentTool.Read, { file_path: "node_modules/package/index.js" }],
      pathDenied,
    ),
    rejected(
      "Edit cannot change agent settings",
      [AgentTool.Edit, { file_path: ".codex/config.toml" }],
      pathDenied,
    ),
    rejected(
      "Read refuses a linked invocation root",
      [AgentTool.Read, { file_path: "inside.txt" }, SymlinkFixture.Root],
      pathDenied,
    ),
    rejected(
      "Write cannot follow a dangling outside file link",
      [AgentTool.Write, { file_path: "link" }, SymlinkFixture.Dangling],
      pathDenied,
    ),
    rejected(
      "Write cannot create below a dangling outside parent",
      [AgentTool.Write, { file_path: "link/new.txt" }, SymlinkFixture.Dangling],
      pathDenied,
    ),
    rejected(
      "Glob cannot search a dangling outside parent",
      [AgentTool.Glob, { pattern: "*", path: "link" }, SymlinkFixture.Dangling],
      pathDenied,
    ),
    rejected(
      "Grep cannot search a dangling outside parent",
      [AgentTool.Grep, { pattern: "needle", path: "link" }, SymlinkFixture.Dangling],
      pathDenied,
    ),
    rejected(
      "Read cannot follow an inside file link",
      [AgentTool.Read, { file_path: "link" }, SymlinkFixture.Inside],
      pathDenied,
    ),
    rejected(
      "Write cannot replace an inside file through a link",
      [AgentTool.Write, { file_path: "link" }, SymlinkFixture.Inside],
      pathDenied,
    ),
    rejected(
      "Glob cannot follow an inside directory link",
      [AgentTool.Glob, { pattern: "*", path: "link" }, SymlinkFixture.InsideDirectory],
      pathDenied,
    ),
    rejected(
      "Read cannot normalize a symlink parent away",
      [AgentTool.Read, { file_path: "link/../inside.txt" }, SymlinkFixture.Outside],
      pathDenied,
    ),
    rejected(
      "Write cannot normalize a symlink parent away",
      [AgentTool.Write, { file_path: "link/../new.txt" }, SymlinkFixture.Outside],
      pathDenied,
    ),
    rejected(
      "Read cannot treat a file as a parent directory",
      [AgentTool.Read, { file_path: "inside.txt/child" }],
      pathDenied,
    ),
    negative(
      "unexpected filesystem errors remain operational",
      [AgentTool.Read, { file_path: "x".repeat(256) }],
      { code: "ENAMETOOLONG" },
    ),

    rejected(
      "Glob cannot use an absolute pattern",
      [AgentTool.Glob, { pattern: "/outside/*" }],
      pathDenied,
    ),
    rejected(
      "Glob cannot traverse its search root",
      [AgentTool.Glob, { pattern: "../outside/*" }],
      pathDenied,
    ),
    rejected(
      "Glob cannot hide traversal in alternatives",
      [AgentTool.Glob, { pattern: "{../outside,src}/*" }],
      pathDenied,
    ),
    rejected(
      "Glob cannot hide an absolute alternative",
      [AgentTool.Glob, { pattern: "{src,/outside}/*" }],
      pathDenied,
    ),
    rejected(
      "Glob cannot use home expansion",
      [AgentTool.Glob, { pattern: "~/secret/*" }],
      pathDenied,
    ),
    rejected(
      "Glob cannot use backslash traversal",
      [AgentTool.Glob, { pattern: "..\\outside\\*" }],
      pathDenied,
    ),
    rejected(
      "Glob refuses extended glob syntax",
      [AgentTool.Glob, { pattern: "@(src|outside)/*" }],
      pathDenied,
    ),
    rejected("Glob needs a pattern", [AgentTool.Glob, {}], pathDenied),
    rejected("Glob needs a string pattern", [AgentTool.Glob, { pattern: ["*.ts"] }], pathDenied),
    rejected("Glob needs a nonempty pattern", [AgentTool.Glob, { pattern: "" }], pathDenied),
    rejected(
      "Glob path cannot be hidden by file_path",
      [AgentTool.Glob, { pattern: "*", path: "../outside", file_path: "inside.txt" }],
      pathDenied,
    ),
    rejected(
      "Grep path cannot be hidden by file_path",
      [AgentTool.Grep, { pattern: "needle", path: "../outside", file_path: "inside.txt" }],
      pathDenied,
    ),
    rejected("Grep needs a string expression", [AgentTool.Grep, { pattern: {} }], pathDenied),
    rejected(
      "Grep cannot use a parent glob filter",
      [AgentTool.Grep, { pattern: "needle", glob: "../outside/*" }],
      pathDenied,
    ),
    rejected(
      "Read requires file_path rather than a search path",
      [AgentTool.Read, { path: "inside.txt" }],
      pathDenied,
    ),
    rejected(
      "Read does not default missing paths to the workspace",
      [AgentTool.Read, {}],
      pathDenied,
    ),
    rejected("Write requires file_path", [AgentTool.Write, {}], pathDenied),
    rejected(
      "Edit cannot use a parent path",
      [AgentTool.Edit, { file_path: "../outside/secret" }],
      pathDenied,
    ),
    rejected("Read refuses an empty file path", [AgentTool.Read, { file_path: "" }], pathDenied),
    rejected(
      "Read refuses a null byte",
      [AgentTool.Read, { file_path: "inside\0.txt" }],
      pathDenied,
    ),
    rejected(
      "Null input cannot become a current-directory request",
      [AgentTool.Read, null],
      pathDenied,
    ),
    rejected(
      "Array input cannot become a current-directory request",
      [AgentTool.Glob, []],
      pathDenied,
    ),
    rejected(
      "Explicit null search path is not omitted",
      [AgentTool.Glob, { pattern: "*", path: null }],
      pathDenied,
    ),
    rejected(
      "Read cannot follow an outside symlink",
      [AgentTool.Read, { file_path: "link/secret" }, SymlinkFixture.Outside],
      pathDenied,
    ),
    rejected(
      "Write cannot create through an outside symlink",
      [AgentTool.Write, { file_path: "link/new.txt" }, SymlinkFixture.Outside],
      pathDenied,
    ),
    rejected(
      "Glob cannot search an outside symlink",
      [AgentTool.Glob, { pattern: "*", path: "link" }, SymlinkFixture.Outside],
      pathDenied,
    ),
    rejected(
      "Grep cannot search an outside symlink",
      [AgentTool.Grep, { pattern: "needle", path: "link" }, SymlinkFixture.Outside],
      pathDenied,
    ),
  ],
};

export const claudeStoppedPolicyCases = {
  positive: [
    positive(
      "a current Write callback retains its authorization",
      [AgentTool.Write, NativeStreamOutcome.Complete, false],
      pathAllowed,
    ),
    positive(
      "a current resumed Edit callback retains its authorization",
      [AgentTool.Edit, NativeStreamOutcome.Complete, true],
      pathAllowed,
    ),
  ],
  negative: [
    ...[false, true].flatMap((resumed) => [
      rejected(
        `a closed session cannot authorize Write: resume=${resumed}`,
        [AgentTool.Write, NativeStreamOutcome.Close, resumed],
        pathDenied,
      ),
      rejected(
        `a cancelled session cannot authorize Edit: resume=${resumed}`,
        [AgentTool.Edit, NativeStreamOutcome.Cancel, resumed],
        pathDenied,
      ),
      rejected(
        `an aborted callback cannot authorize Write: resume=${resumed}`,
        [AgentTool.Write, NativeStreamOutcome.Abort, resumed],
        pathDenied,
      ),
    ]),
  ],
};
