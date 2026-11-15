import { readdir, readlink } from "node:fs/promises";
import { resolve } from "node:path";
import { StreamDescriptorFixture } from "@titan/constants";
import { settle } from "@titan/core";

export async function openDirectoryFiles(home: string) {
  const descriptors = await readdir(StreamDescriptorFixture.Directory);
  const targets = await settle(
    descriptors.map(
      (descriptor) => () => readlink(resolve(StreamDescriptorFixture.Directory, descriptor)),
    ),
  );
  return targets.filter(
    (target) => target.status === "fulfilled" && target.value.startsWith(`${home}/`),
  ).length;
}
