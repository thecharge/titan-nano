const mode = process.argv[2];
const result = {
  text: "",
  json: { delivered: true },
  session_id: "native",
  usage: { input_tokens: 1, output_tokens: 1, cost_usd: null },
};
const answer = { type: "answer", answer: result };
process.on("message", (request) => {
  if (request.type === "ack") {
    process.send(answer);
    return;
  }
  if (mode === "exit") process.exit(9);
  if (mode === "error") {
    process.send({
      type: "error",
      code: "session_unavailable",
      message: "native missing",
      retryable: false,
      retry_after_ms: 0,
    });
    return;
  }
  if (mode === "double-ready") {
    process.send({ type: "ready" });
    return;
  }
  if (mode === "answer") {
    process.send(answer);
    return;
  }
  const event = { type: "session", session_id: "native", data: {} };
  process.send({ type: "event", event });
});
if (mode === "not-ready") process.send(answer);
else if (mode === "malformed") process.send({ type: "invalid" });
else if (mode === "oversize")
  process.send({
    type: "event",
    event: { type: "message", session_id: null, data: "x".repeat(1048576) },
  });
else if (mode !== "silent") process.send({ type: "ready" });
