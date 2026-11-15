import {
  DataSchemaRule,
  ExitCode,
  IoLimit,
  OwnedDataShape,
  RequestDefaults,
  RequestLimit,
} from "@titan/constants";
import { negative, positive, rejected } from "@titan/test-factories";

export const dataShapeNamesCases = {
  positive: [
    positive(
      "declaration files retain callable ports",
      [{ "value.d.ts": "export interface Value { run(): void; }" }],
      [],
    ),

    positive(
      "bounded reference chains retain executable ports",
      [{}, 0, DataSchemaRule.MaximumDepth - 2],
      [],
    ),

    positive(
      "optional callback tuples remain ports",
      [{ "value.ts": "export interface Value { callbacks: [number, (() => void)?]; }" }],
      [],
    ),
    positive(
      "rest callback tuples remain ports",
      [{ "value.ts": "export interface Value { callbacks: [number, ...(() => void)[]]; }" }],
      [],
    ),
    positive(
      "named callback tuples remain ports",
      [{ "value.ts": "export interface Value { callbacks: [count: number, run?: () => void]; }" }],
      [],
    ),
    positive(
      "constructor callbacks remain ports",
      [
        {
          "value.ts":
            "type Factory = new () => object; export interface Value { create: Factory; }",
        },
      ],
      [],
    ),
    positive(
      "exact declaration allowance remains valid",
      [{}, DataSchemaRule.MaximumDeclarations],
      [],
    ),

    positive(
      "data is inferred from a schema",
      [
        {
          "value.ts":
            'import { z } from "zod"; const ValueSchema = z.object({ count: z.number() }); export type Value = z.infer<typeof ValueSchema>;',
        },
      ],
      [],
    ),
    positive(
      "method contracts remain behavior ports",
      [{ "value.ts": "export interface Value { run(input: string): Promise<void>; }" }],
      [],
    ),
    positive(
      "local callback alias remains a port",
      [
        {
          "value.ts":
            "type Action = () => void; export interface Value { run?: Action | undefined; }",
        },
      ],
      [],
    ),
    positive(
      "renamed callback import remains a port",
      [
        {
          "port.ts": "export type Action = () => void;",
          "value.ts":
            'import type { Action as Run } from "./port.ts"; export interface Value { run: Run; }',
        },
      ],
      [],
    ),
    positive(
      "namespace callback import remains a port",
      [
        {
          "port.ts": "export type Action = () => void;",
          "value.ts":
            'import type * as Port from "./port.ts"; export interface Value { run: Port.Action; }',
        },
      ],
      [],
    ),
    positive(
      "default contract import remains a port",
      [
        {
          "port.ts": "export default interface Port { run(): void; }",
          "value.ts": 'import type Port from "./port.ts"; export interface Value { port: Port; }',
        },
      ],
      [],
    ),
    positive(
      "same private name in separate modules is valid",
      [
        {
          "port.ts": "type Item = () => void; export interface Port { run: Item; }",
          "value.ts": "type Item = number; export type Value = string;",
        },
      ],
      [],
    ),
    positive(
      "inherited callable contract remains a port",
      [
        {
          "value.ts":
            "interface Port { run(): void; } export interface Value extends Port { label: string; }",
        },
      ],
      [],
    ),
    positive(
      "call and construct signatures remain ports",
      [
        {
          "value.ts": "export type Call = { (): void }; export type Construct = { new(): object };",
        },
      ],
      [],
    ),
    positive(
      "callback arrays remain executable ports",
      [
        {
          "value.ts":
            "type Action = () => void; export interface Value { callbacks: ReadonlyArray<Action>; }",
        },
      ],
      [],
    ),
    positive(
      "deferred results remain executable ports",
      [{ "value.ts": "export interface Value { result: Promise<number>; }" }],
      [],
    ),
    positive(
      "nested executable members remain ports",
      [{ "value.ts": "export interface Value { port: { run: () => void }; }" }],
      [],
    ),
    positive(
      "empty companion source does not hide a port",
      [{ "port.ts": "", "value.ts": "export interface Value { run(): void; }" }],
      [],
    ),
    positive(
      "merged callable interfaces remain ports",
      [{ "value.ts": "interface Value { run(): void; } interface Value { stop(): void; }" }],
      [],
    ),
  ],
  negative: [
    rejected(
      "external alias cannot impersonate executable builtins",
      [
        {
          "external.d.ts": 'declare module "external" { export type Count = number; }',
          "value.ts":
            'import type { Count as Promise } from "external"; export interface Value { count: Promise; }',
        },
      ],
      ["Value"],
    ),
    rejected(
      "local data class cannot impersonate executable builtins",
      [
        {
          "value.ts":
            "declare class Promise { count: number; } export interface Value { count: Promise; }",
        },
      ],
      ["Value"],
    ),

    rejected(
      "reference depth cannot grow past owner allowance",
      [{}, 0, DataSchemaRule.MaximumDepth + 1],
      ["Deep"],
    ),

    rejected(
      "recursive object aliases cannot hide unchecked data",
      [{ "value.ts": "export type Value = { children: Value[] };" }],
      ["Value"],
    ),

    rejected(
      "optional primitive tuples remain data",
      [{ "value.ts": "export interface Value { data: [number, string?]; }" }],
      ["Value"],
    ),
    rejected(
      "rest primitive tuples remain data",
      [{ "value.ts": "export interface Value { data: [number, ...string[]]; }" }],
      ["Value"],
    ),
    rejected(
      "namespace lookup cannot use an unrelated namespace",
      [
        {
          "port.ts": "export type Action = () => void;",
          "other.ts": "export type Count = number;",
          "value.ts":
            'import type * as Port from "./port.ts"; import type * as Other from "./other.ts"; export interface Value { count: Other.Count; }',
        },
      ],
      ["Value"],
    ),

    rejected(
      "plain interface needs a schema",
      [{ "value.ts": "export interface Value { count: number; }" }],
      ["Value"],
    ),
    rejected(
      "object alias needs a schema",
      [{ "value.ts": "export type Value = { count: number };" }],
      ["Value"],
    ),
    rejected(
      "unresolved reference cannot excuse data",
      [{ "value.ts": "export interface Value { count: Unresolved; }" }],
      ["Value"],
    ),
    rejected(
      "union members each need schemas",
      [{ "value.ts": "export type Value = { left: string } | { right: number };" }],
      ["Value", "Value"],
    ),
    rejected(
      "readonly arrays and parenthesized unions remain data",
      [{ "value.ts": "export interface Value { items: readonly (number | string)[]; }" }],
      ["Value"],
    ),
    rejected(
      "generic records remain data",
      [{ "value.ts": "export interface Value { items: Record<string, number>; }" }],
      ["Value"],
    ),
    rejected(
      "schema-derived fields do not excuse a raw wrapper",
      [
        {
          "value.ts":
            'import { z } from "zod"; type Count = z.infer<typeof schema>; export interface Value { count: Count; }',
        },
      ],
      ["Value"],
    ),
    rejected(
      "nested objects each need schemas",
      [{ "value.ts": "export interface Value { child: { count: number }; }" }],
      ["Value", "Value"],
    ),
    rejected(
      "inherited data remains data",
      [
        {
          "value.ts":
            "interface Base { count: number; } export interface Value extends Base { label: string; }",
        },
      ],
      ["Base", "Value"],
    ),
    rejected(
      "recursive data cannot hide behind a cycle",
      [{ "value.ts": "export interface Value { child: Value | null; }" }],
      ["Value"],
    ),
    rejected(
      "private callback name in another module cannot excuse data",
      [
        {
          "port.ts": "type Item = () => void; export interface Port { run: Item; }",
          "value.ts": "type Item = number; export interface Value { count: Item; }",
        },
      ],
      ["Value"],
    ),
    rejected(
      "local declaration overrides executable builtin names",
      [{ "value.ts": "type Promise = number; export interface Value { count: Promise; }" }],
      ["Value"],
    ),
    rejected(
      "anonymous argument data needs a schema",
      [{ "value.ts": "declare function consume(value: { count: number }): void;" }],
      [DataSchemaRule.Anonymous],
    ),
    rejected(
      "callback argument data needs a schema",
      [{ "value.ts": "export type Action = (input: { count: number }) => void;" }],
      ["Action"],
    ),
    rejected(
      "empty object aliases cannot become unchecked data",
      [{ "value.ts": "export type Value = {};" }],
      ["Value"],
    ),
    rejected(
      "ordinary value statements do not excuse unknown references",
      [{ "value.ts": "const name = 1; export interface Value { count: Unknown; }" }],
      ["Value"],
    ),
    rejected(
      "side effect imports cannot excuse unknown references",
      [
        {
          "value.ts": 'import "./port.ts"; export interface Value { count: Unknown; }',
          "port.ts": "",
        },
      ],
      ["Value"],
    ),
    negative("malformed source fails closed", [{ "value.ts": "export interface Value {" }], {}),
    rejected(
      "merged data declarations still require schemas",
      [{ "value.ts": "interface Value { count: number; } interface Value { label: string; }" }],
      ["Value", "Value"],
    ),
    negative(
      "declaration inventory remains bounded",
      [{}, DataSchemaRule.MaximumDeclarations + 1],
      {},
    ),
  ],
};

const file = "packages/types/src/value.ts";
const peer = "packages/types/src/peer.ts";
const accepted = { code: 0, findings: 0, unchanged: true };
const refused = { code: 1, findings: 1, unchanged: true };
export const dataShapeTreeCases = {
  positive: [
    positive(
      "declaration module source stays valid",
      [{ "packages/types/src/port.d.mts": "export interface Port { run(): void; }" }],
      accepted,
    ),

    positive(
      "schema source stays unchanged",
      [{ [file]: "export type Value = number;" }],
      accepted,
    ),
    positive(
      "exact read budgets remain valid",
      [
        { [file]: " \n", [peer]: " \n" },
        { source_bytes: 2, total_bytes: 4, max_files: 2 },
      ],
      accepted,
    ),
  ],
  negative: [
    rejected(
      "module extension cannot hide data",
      [
        {
          [file]: "export type Baseline = number;",
          "packages/types/src/value.mts": "export interface Value { count: number; }",
        },
      ],
      refused,
    ),
    rejected(
      "common module extension cannot hide data",
      [
        {
          [file]: "export type Baseline = number;",
          "packages/types/src/value.cts": "export type Value = { count: number };",
        },
      ],
      refused,
    ),
    rejected(
      "TSX extension cannot hide data",
      [
        {
          [file]: "export type Baseline = number;",
          "packages/types/src/value.tsx": "export type Value = { count: number };",
        },
      ],
      refused,
    ),
    rejected(
      "declaration extension cannot hide data",
      [
        {
          [file]: "export type Baseline = number;",
          "packages/types/src/value.d.ts": "export interface Value { count: number; }",
        },
      ],
      refused,
    ),

    rejected(
      "data interface fails the actual command",
      [{ [file]: "export interface Value { count: number; }" }],
      refused,
    ),
    rejected(
      "nested type data fails the actual command",
      [{ [file]: "export type Value = { count: number };" }],
      refused,
    ),
    negative("missing source inventory fails closed", [{}], {}),
    negative("per-source bytes are bounded", [{ [file]: "   " }, { source_bytes: 2 }], {}),
    negative(
      "combined bytes are bounded",
      [
        { [file]: "  ", [peer]: "  " },
        { source_bytes: 2, total_bytes: 3 },
      ],
      {},
    ),
    negative("source file count is bounded", [{ [file]: " ", [peer]: " " }, { max_files: 1 }], {}),
    negative(
      "invalid syntax fails the actual command",
      [{ [file]: "export interface Value {" }],
      {},
    ),
    negative("zero limits are refused", [{ [file]: " " }, { max_files: 0 }], {}),
    negative(
      "enlarged limits are refused",
      [{ [file]: " " }, { source_bytes: IoLimit.DataBytes + 1 }],
      {},
    ),
    negative("unknown limit keys cannot weaken checks", [{ [file]: " " }, { skip: true }], {}),
  ],
};

const traversal = { limits: {}, entries: 0, bytes: 0, omitted: [] };
const inventory = {
  run_id: "run-one",
  config_hash: "config-hash",
  max_requests: 1,
  approvals: RequestDefaults,
  requests: [],
};
const listing = { project_path: "", requests: [] };
const turn = { value: null, requests: [] };
const turnResult = { ready: true };
const malformedRequest = {};
const result = { exitCode: ExitCode.Success };
const positional = { name: "run-id", required: true };
export const ownedDataShapeCases = {
  positive: [
    positive("empty traversal starts within limits", [OwnedDataShape.Traversal, traversal], true),
    positive(
      "nonempty traversal retains byte and entry counters",
      [OwnedDataShape.Traversal, { ...traversal, entries: 2, bytes: 128 }],
      true,
    ),
    positive(
      "request inventory accepts minimum allowance",
      [OwnedDataShape.RequestInventory, inventory],
      true,
    ),
    positive(
      "request inventory accepts owner ceiling",
      [OwnedDataShape.RequestInventory, { ...inventory, max_requests: RequestLimit.PerRun }],
      true,
    ),
    positive(
      "legacy listing accepts no project label",
      [OwnedDataShape.RequestListRun, listing],
      true,
    ),
    positive(
      "project listing retains its path",
      [OwnedDataShape.RequestListRun, { ...listing, project_path: "/workspace/project" }],
      true,
    ),
    positive("empty phase turn retains a null result", [OwnedDataShape.PhaseTurn, turn], true),
    positive(
      "phase turn retains a structured result",
      [OwnedDataShape.PhaseTurn, { ...turn, value: turnResult }],
      true,
    ),
    positive("command success permits no data", [OwnedDataShape.CommandResult, result], true),
    positive(
      "blocked command uses the fixed enum",
      [OwnedDataShape.CommandResult, { data: null, exitCode: ExitCode.Blocked }],
      true,
    ),
    positive(
      "required positional needs no choices",
      [OwnedDataShape.CommandPositional, positional],
      true,
    ),
    positive(
      "optional positional retains choices",
      [
        OwnedDataShape.CommandPositional,
        { ...positional, required: false, choices: ["first", "second"] },
      ],
      true,
    ),
  ],
  negative: [
    rejected(
      "negative traversal entries fail",
      [OwnedDataShape.Traversal, { ...traversal, entries: -1 }],
      false,
    ),
    rejected(
      "unknown traversal fields fail",
      [OwnedDataShape.Traversal, { ...traversal, skip: true }],
      false,
    ),
    rejected(
      "zero request allowance fails",
      [OwnedDataShape.RequestInventory, { ...inventory, max_requests: 0 }],
      false,
    ),
    rejected(
      "enlarged request allowance fails",
      [OwnedDataShape.RequestInventory, { ...inventory, max_requests: RequestLimit.PerRun + 1 }],
      false,
    ),
    rejected(
      "project labels with non-string values fail",
      [OwnedDataShape.RequestListRun, { ...listing, project_path: null }],
      false,
    ),
    rejected(
      "listing requests with non-array values fail",
      [OwnedDataShape.RequestListRun, { ...listing, requests: "missing" }],
      false,
    ),
    rejected(
      "phase requests with non-array values fail",
      [OwnedDataShape.PhaseTurn, { ...turn, requests: "missing" }],
      false,
    ),
    rejected(
      "malformed phase request data fails",
      [OwnedDataShape.PhaseTurn, { ...turn, requests: [malformedRequest] }],
      false,
    ),
    rejected(
      "unlisted command exit code fails",
      [OwnedDataShape.CommandResult, { exitCode: 99 }],
      false,
    ),
    rejected(
      "unknown command fields fail",
      [OwnedDataShape.CommandResult, { ...result, skip: true }],
      false,
    ),
    rejected(
      "empty positional names fail",
      [OwnedDataShape.CommandPositional, { ...positional, name: "" }],
      false,
    ),
    rejected(
      "positional choices with non-string values fail",
      [OwnedDataShape.CommandPositional, { ...positional, choices: [1] }],
      false,
    ),
  ],
};
