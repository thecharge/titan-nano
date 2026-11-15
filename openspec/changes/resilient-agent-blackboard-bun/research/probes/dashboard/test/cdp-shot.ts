export {};
// Take a screenshot of an already open Chrome tab through the Chrome DevTools Protocol.
// usage: bun test/cdp-shot.ts <debug port> <out.png> <text the page must show>
const [port, out, needle] = process.argv.slice(2) as [string, string, string];
const tabs: any[] = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const tab = tabs.find((t) => t.type === "page")!;
const ws = new WebSocket(tab.webSocketDebuggerUrl);
let n = 0;
const call = (method: string, params = {}) =>
	new Promise<any>((ok) => {
		const id = ++n;
		const on = (m: MessageEvent) => { const j = JSON.parse(String(m.data)); if (j.id === id) { ws.removeEventListener("message", on); ok(j.result); } };
		ws.addEventListener("message", on);
		ws.send(JSON.stringify({ id, method, params }));
	});
await new Promise((ok) => ws.addEventListener("open", ok));
const text = await call("Runtime.evaluate", { expression: "document.body.innerText", returnByValue: true });
const shown = String(text.result.value).includes(needle);
console.log(`page shows "${needle}": ${shown}`);
const shot = await call("Page.captureScreenshot", { format: "png" });
await Bun.write(out, Buffer.from(shot.data, "base64"));
ws.close();
process.exit(shown ? 0 : 1);
