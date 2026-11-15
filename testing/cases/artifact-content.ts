import {
  ArtifactContentMutation,
  ArtifactFormat,
  ArtifactInspectionTransport,
  ArtifactKind,
  ArtifactMutation,
  ErrorCode,
  FileEncoding,
} from "@titan/constants";
import { hash } from "@titan/core";
import { ArtifactMessage } from "@titan/messages";
import { negative, positive, rejected } from "@titan/test-factories";

const data = Buffer.from([0, 255, 128, 7, 0, 65]);
export const artifactMcpAdmissionCases = {
  positive: [
    positive("strict MCP full page is accepted", [{}], false),
    positive("strict MCP bounded page is accepted", [{ limit: 1 }], false),
  ],
  negative: [
    rejected("MCP cannot ignore an unknown selector", [{ cursor: 1 }], true),
    rejected("MCP refuses zero page length", [{ limit: 0 }], true),
  ],
};
const large = Buffer.alloc(ArtifactFormat.PageBytes * 2 + 7, 173);
export const artifactByteRangeCases = {
  positive: [
    positive("binary bytes remain exact", [data, {}], data),
    positive(
      "range crosses a stream chunk boundary",
      [large, { offset: ArtifactFormat.PageBytes - 2, limit: 7 }],
      Buffer.alloc(7, 173),
    ),
    positive(
      "one page does not retain a whole large file",
      [large, {}],
      Buffer.alloc(ArtifactFormat.PageBytes, 173),
    ),
    positive("empty file has an empty page", [Buffer.alloc(0), {}], Buffer.alloc(0)),
    positive("end cursor is a valid empty page", [data, { offset: data.length }], Buffer.alloc(0)),
  ],
  negative: [
    negative("wrong content hash is refused", [data, {}, ArtifactContentMutation.Hash], {
      code: ErrorCode.ArtifactInvalid,
    }),
    negative("short source is refused", [data, {}, ArtifactContentMutation.Short], {
      code: ErrorCode.ArtifactInvalid,
    }),
    negative(
      "growing source is refused before collecting excess bytes",
      [data, {}, ArtifactContentMutation.Grown],
      { code: ErrorCode.ArtifactInvalid },
    ),
    negative("mode changes are refused", [data, {}, ArtifactContentMutation.Mode], {
      code: ErrorCode.ArtifactInvalid,
    }),
    negative("final file links are refused", [data, {}, ArtifactContentMutation.Link], {
      code: ErrorCode.ArtifactInvalid,
    }),
    negative("missing source is refused", [data, {}, ArtifactContentMutation.Missing], {
      code: ErrorCode.ArtifactInvalid,
    }),
    negative("range cannot exceed file size", [data, { offset: data.length + 1 }], {
      code: ErrorCode.ArtifactRange,
    }),
    negative(
      "page allocation cannot exceed the cap",
      [data, { limit: ArtifactFormat.PageBytes + 1 }],
      { code: ErrorCode.ArtifactRange },
    ),
  ],
};
const identity = { path: "source.txt", identity: true };
export const artifactReadReviewCases = {
  positive: [
    positive("full checked file retains producing identity", [hash("source.txt")], {
      ...identity,
      content: Buffer.from("delivered"),
      offset: 0,
      next: 9,
      more: false,
    }),
    positive("partial file exposes a byte cursor", [hash("source.txt"), { offset: 2, limit: 3 }], {
      ...identity,
      content: Buffer.from("liv"),
      offset: 2,
      next: 5,
      more: true,
    }),
    positive("end of checked file is observable", [hash("source.txt"), { offset: 9 }], {
      ...identity,
      content: Buffer.alloc(0),
      offset: 9,
      next: 9,
      more: false,
    }),
  ],
  negative: [
    negative("path cannot replace artifact identifier", ["../source.txt"], {
      code: ErrorCode.ArtifactNotFound,
    }),
    negative("unknown valid identifier is refused", [hash("absent")], {
      code: ErrorCode.ArtifactNotFound,
    }),
    negative("offset past end is refused", [hash("source.txt"), { offset: 10 }], {
      code: ErrorCode.ArtifactRange,
    }),
    negative(
      "oversized request is refused",
      [hash("source.txt"), { limit: ArtifactFormat.PageBytes + 1 }],
      { code: ErrorCode.ArtifactRange },
    ),
    negative(
      "tampered delivery cannot expose a page",
      [hash("source.txt"), {}, ArtifactMutation.Content],
      { code: ErrorCode.ArtifactInvalid },
    ),
  ],
};
export const artifactReadTransportCases = {
  positive: Object.values(ArtifactInspectionTransport).flatMap((transport) => [
    positive(`${transport} full file`, [transport, {}], {
      content: "delivered",
      offset: 0,
      next: 9,
      more: false,
    }),
    positive(`${transport} partial file`, [transport, { offset: 2, limit: 3 }], {
      content: "liv",
      offset: 2,
      next: 5,
      more: true,
    }),
  ]),
  negative: Object.values(ArtifactInspectionTransport).flatMap((transport) =>
    transport === ArtifactInspectionTransport.Mcp
      ? [
          rejected("MCP tamper has a typed failure", [transport, {}, ArtifactMutation.Content], {
            code: ErrorCode.ArtifactInvalid,
            error: ArtifactMessage.Invalid,
          }),
          rejected("MCP invalid cursor has a typed failure", [transport, { offset: 10 }], {
            code: ErrorCode.ArtifactRange,
            error: ArtifactMessage.Range,
          }),
        ]
      : [
          negative(`${transport} tamper is refused`, [transport, {}, ArtifactMutation.Content], {
            code: ErrorCode.ArtifactInvalid,
          }),
          negative(`${transport} invalid cursor is refused`, [transport, { offset: 10 }], {
            code: ErrorCode.ArtifactRange,
          }),
        ],
  ),
};
const page = {
  schema_version: ArtifactFormat.PageVersion,
  run_id: "delivery",
  workflow_id: "workflow",
  workflow_revision: hash("revision"),
  file: {
    id: hash("source.txt"),
    kind: ArtifactKind.File,
    path: "source.txt",
    hash: hash("delivered"),
    bytes: 9,
    executable: false,
  },
  offset: 0,
  next_offset: 9,
  has_more: false,
  encoding: FileEncoding.Base64,
  content: Buffer.from("delivered").toString(FileEncoding.Base64),
};
export const artifactReadResponseCases = {
  positive: [
    positive("typed complete response", [page], page.content),
    positive("typed end cursor response", [{ ...page, offset: 9, content: "" }, { offset: 9 }], ""),
  ],
  negative: [
    negative("response cannot name another run", [{ ...page, run_id: "another" }], {
      code: ErrorCode.InvalidResponse,
    }),
    negative(
      "response cannot name another file",
      [{ ...page, file: { ...page.file, id: hash("another") } }],
      { code: ErrorCode.InvalidResponse },
    ),
    negative(
      "response cannot change the selected path",
      [{ ...page, file: { ...page.file, path: "another.txt" } }],
      { code: ErrorCode.InvalidResponse },
    ),
    negative(
      "response cannot skip the requested offset",
      [
        {
          ...page,
          offset: 1,
          content: Buffer.from("delivered").subarray(1).toString(FileEncoding.Base64),
        },
      ],
      { code: ErrorCode.InvalidResponse },
    ),
    negative("response cannot exceed requested page length", [page, { limit: 2 }], {
      code: ErrorCode.InvalidResponse,
    }),
    negative(
      "nonterminal page cannot stall the cursor",
      [{ ...page, content: "", next_offset: 0, has_more: true }],
      { code: ErrorCode.InvalidResponse },
    ),
    negative("cursor cannot disagree with bytes", [{ ...page, next_offset: 8 }], {
      code: ErrorCode.InvalidResponse,
    }),
    negative("truncation cannot disagree with file size", [{ ...page, has_more: true }], {
      code: ErrorCode.InvalidResponse,
    }),
    negative("invalid base64 cannot become file bytes", [{ ...page, content: "not base64" }], {
      code: ErrorCode.InvalidResponse,
    }),
    negative(
      "encoded length cannot admit two extra bytes",
      [
        {
          ...page,
          file: { ...page.file, bytes: ArtifactFormat.PageBytes + 2 },
          next_offset: ArtifactFormat.PageBytes + 2,
          content: Buffer.alloc(ArtifactFormat.PageBytes + 2).toString(FileEncoding.Base64),
        },
      ],
      { code: ErrorCode.InvalidResponse },
    ),
  ],
};
export const artifactReadSearchCases = {
  positive: [
    positive("default range is bounded", [{}], { offset: 0, limit: ArtifactFormat.PageBytes }),
    positive("numeric range is parsed", [{ offset: "3", limit: "2" }], { offset: 3, limit: 2 }),
  ],
  negative: [
    negative("negative offset cannot pass query admission", [{ offset: "-1" }], {
      code: ErrorCode.ArtifactRange,
    }),
    negative("zero limit cannot pass query admission", [{ limit: "0" }], {
      code: ErrorCode.ArtifactRange,
    }),
    negative("unsafe offset cannot pass query admission", [{ offset: "9007199254740992" }], {
      code: ErrorCode.ArtifactRange,
    }),
    negative("unknown selector cannot be ignored", [{ cursor: "1" }], {
      code: ErrorCode.ArtifactRange,
    }),
  ],
};
export const artifactListAliasCases = {
  positive: [
    positive("ordinary list alias targets the kept run", [], ["added.txt", "source.txt"]),
    positive(
      "executable list alias targets the kept run",
      [ArtifactMutation.None, true],
      ["added.txt", "source.txt"],
    ),
  ],
  negative: [
    negative("list alias retains hash validation", [ArtifactMutation.Content], {
      code: ErrorCode.ArtifactInvalid,
    }),
    negative("list alias retains link validation", [ArtifactMutation.FileLink], {
      code: ErrorCode.UnsafeSymlink,
    }),
  ],
};
const fileRoute = `artifacts/${hash("source.txt")}`;
export const artifactReadHttpQueryCases = {
  positive: [
    positive("explicit byte range is accepted", ["offset=0&limit=2", fileRoute], {
      status: 200,
      code: null,
    }),
    positive("end cursor is accepted", ["offset=9", fileRoute], { status: 200, code: null }),
  ],
  negative: [
    rejected("duplicate query cannot choose a cursor", ["offset=0&offset=9", fileRoute], {
      status: 400,
      code: ErrorCode.Arguments,
    }),
    rejected("unknown query cannot be ignored", ["cursor=1", fileRoute], {
      status: 400,
      code: ErrorCode.ArtifactRange,
    }),
    rejected("list does not silently ignore range selectors", ["offset=1"], {
      status: 400,
      code: ErrorCode.Arguments,
    }),
    rejected("artifact id cannot qualify a control route", ["", `cancel/${hash("source.txt")}`], {
      status: 400,
      code: ErrorCode.Method,
    }),
  ],
};
