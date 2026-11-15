export const StreamMessage = {
  InvalidJson: "Value is not supported bounded JSON data",
  InvalidLimit: "Stream byte limit must be a positive safe integer",
  Exceeded: "Input exceeds its byte limit",
} as const;
