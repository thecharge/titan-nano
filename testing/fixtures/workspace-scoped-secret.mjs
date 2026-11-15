import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createSecretScanner } from "@titan/config";
import { readTree, writeTree } from "@titan/workspace";

const [source, target, mode] = process.argv.slice(2);
const scanner = () => createSecretScanner({ TITAN_SCOPED_TOKEN: "independent-scoped-credential" });
try {
  if (mode === "copy") {
    const file = resolve(source, "content.txt");
    const bytes = await readFile(file);
    await writeTree(
      target,
      {
        "content.txt": {
          source: file,
          hash: createHash("sha256").update(bytes).digest("hex"),
          bytes: bytes.length,
          executable: false,
        },
      },
      undefined,
      scanner,
    );
  } else await readTree(source, undefined, scanner);
  console.log(JSON.stringify({ code: null }));
} catch (error) {
  console.log(JSON.stringify({ code: error.code }));
}
