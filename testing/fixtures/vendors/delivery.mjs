import { chmod, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";

const identifier = /^[a-z][a-z0-9_-]{0,31}$/;

export function deliveryTask(task) {
  if (typeof task !== "string" || !task.startsWith("{")) return null;
  const value = JSON.parse(task);
  if (
    ![
      "barrier,content,file,mode,requires",
      "barrier,content,file,interrupt,mode,requires",
    ].includes(Object.keys(value).sort().join(",")) ||
    (value.interrupt !== undefined && value.interrupt !== true) ||
    value.mode !== "delivery" ||
    !identifier.test(value.file) ||
    !identifier.test(value.content) ||
    !Array.isArray(value.requires) ||
    value.requires.length > 8 ||
    !value.requires.every((entry) => identifier.test(entry))
  )
    throw new Error("Invalid delivery task contract");
  if (value.barrier !== null) {
    const barrier = value.barrier;
    if (
      Object.keys(barrier).sort().join(",") !== "directory,member,members" ||
      !isAbsolute(barrier.directory) ||
      !identifier.test(barrier.member) ||
      !Array.isArray(barrier.members) ||
      barrier.members.length < 2 ||
      barrier.members.length > 3 ||
      new Set(barrier.members).size !== barrier.members.length ||
      !barrier.members.every((entry) => identifier.test(entry)) ||
      !barrier.members.includes(barrier.member)
    )
      throw new Error("Invalid delivery barrier contract");
  }
  return value;
}

async function waitForFiles(paths) {
  for (let attempt = 0; attempt < 600; attempt++) {
    let ready = true;
    for (const path of paths) ready &&= await Bun.file(path).exists();
    if (ready) return;
    await Bun.sleep(5);
  }
  throw new Error("Parallel peers did not arrive");
}

async function rendezvous(barrier) {
  await mkdir(barrier.directory, { recursive: true });
  await writeFile(join(barrier.directory, `${barrier.member}.pending`), String(process.pid), {
    flag: "wx",
  });
  await rename(
    join(barrier.directory, `${barrier.member}.pending`),
    join(barrier.directory, `${barrier.member}.ready`),
  );
  const ready = barrier.members.map((member) => join(barrier.directory, `${member}.ready`));
  await waitForFiles(ready);
  for (const path of ready) process.kill(Number(await readFile(path, "utf8")), 0);
  await writeFile(join(barrier.directory, `${barrier.member}.checked`), "live", { flag: "wx" });
  await waitForFiles(barrier.members.map((member) => join(barrier.directory, `${member}.checked`)));
}

export async function deliver(task, cwd, checker) {
  for (const file of task.requires) {
    if ((await readFile(join(cwd, `${file}.txt`), "utf8")) !== `Delivered ${file}`)
      throw new Error(`Ancestor delivery changed: ${file}`);
    if (file === "seed" && ((await stat(join(cwd, "seed.txt"))).mode & 0o111) === 0)
      throw new Error("Ancestor executable flag changed");
  }
  const file = join(cwd, `${task.file}.txt`);
  if (checker) {
    if ((await readFile(file, "utf8")) !== `Delivered ${task.content}`)
      throw new Error("Candidate delivery changed");
    if (task.file === "seed" && ((await stat(file)).mode & 0o111) === 0)
      throw new Error("Candidate executable flag changed");
    return;
  }
  if (task.barrier) await rendezvous(task.barrier);
  await writeFile(file, Buffer.from(`Delivered ${task.content}`));
  if (task.file === "seed") await chmod(file, 0o700);
}
