export const IoLimit = {
  ChunkBytes: 64 * 1024,
  DataBytes: 1024 * 1024,
  AddressBytes: 8 * 1024,
  HashBytes: 128,
  ResponseBytes: 16 * 1024 * 1024,
} as const;
export const Sha256Pattern = /^[a-f0-9]{64}$/;

export const JsonEncoding = {
  ChunkCharacters: 8192,
  MaximumDepth: 128,
  HighStart: 0xd800,
  HighEnd: 0xdbff,
  LowStart: 0xdc00,
  LowEnd: 0xdfff,
} as const;
export const JsonToken = {
  Quote: '"',
  Comma: ",",
  Colon: ":",
  ArrayStart: "[",
  ArrayEnd: "]",
  ObjectStart: "{",
  ObjectEnd: "}",
} as const;
