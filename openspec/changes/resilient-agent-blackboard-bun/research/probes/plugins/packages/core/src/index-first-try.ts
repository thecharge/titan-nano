export const SPEC = "titan-plugin-v1";
export type Backend = { id: string; capabilities: Record<string, boolean> };
export type Plugin = { specificationVersion: string; name: string; backends?: Backend[] };
export async function loadPlugins(names: string[]) {
  const backends = new Map<string, Backend>(); const errors: string[] = [];
  for (const n of names) {
    let mod: any;
    try { mod = await import(n); } catch (e) { errors.push(`${n}: not installed (${(e as Error).message.split("\n")[0]})`); continue; }
    const p: Plugin = mod.default;
    if (p?.specificationVersion !== SPEC) { errors.push(`${n}: wants ${p?.specificationVersion}, titan has ${SPEC}`); continue; }
    for (const b of p.backends ?? []) {
      if (backends.has(b.id)) { errors.push(`${n}: backend ${b.id} already registered`); continue; }
      backends.set(b.id, b);
    }
  }
  return { backends: [...backends.keys()], errors };
}
