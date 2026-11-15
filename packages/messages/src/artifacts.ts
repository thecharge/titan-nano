export const ArtifactMessage = {
  Destination:
    "Choose --output with an absolute new directory outside the run storage; its parent must exist without links.",
  Exists: "Artifact export refuses to replace an existing destination.",
  Export: "Artifact export could not complete. Inspect the selected destination before retrying.",
  NotFound: "No kept file matches that artifact identifier.",
  Range: "Artifact offset and limit must describe a bounded range within the kept file.",
  Page: "The server returned an invalid artifact file page.",
  Unavailable: "A passed delivery is required before inspecting artifacts.",
  Invalid: "Kept artifact files, result, manifest or committed hash do not agree.",
  Client: "The server returned an invalid artifact inspection.",
} as const;
