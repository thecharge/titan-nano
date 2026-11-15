export const AgentHostMessage = {
  Protocol: "Invalid or out-of-order agent host message",
  Size: "Agent host message exceeds its byte budget",
  Stopped: "Agent host stopped before completing its turn",
  Busy: "The candidate workspace already has an active agent host",
  Platform: "Managed agent processes currently require Linux",
} as const;
