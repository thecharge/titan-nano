export const KnowledgeMessage = {
  PersonaInspection:
    "Persona inspection requires a valid selector and bounded positive version and page size",
  PendingInspectionUnavailable: "This knowledge view cannot inspect private pending entries",
  InspectionReadOnly: "Knowledge inspection permits only reading stored entries and counts",
  PublicationConflict: "Checked knowledge changes conflict with a committed entry",
  Pending: "Private knowledge set is invalid or inconsistent",
  PendingClosed: "Private knowledge set is closed to further changes",
  Invalid: "Knowledge entry must have a valid header and a bounded text body",
  Missing: "Knowledge entry does not exist",
  PromoteExists: "The home hub already has an entry with this id; nothing was copied",
  Conflict: "Knowledge entry changed; read its current version before updating it",
  Corrupt: "Knowledge files or the durable change record are inconsistent",
  Capacity: "Knowledge hub exceeds its configured entry or byte allowance",
  PersonaDeletion: "Deleting a persona requires a human-approved delete_persona request",
  PersonaDefinition: "Register a new version to change a saved persona definition",
  PersonaDecision:
    "Persona approval requires a registered version and a matching state-change operation",
  Unavailable: "Knowledge publication needs recovery before another operation can run",
  Owner: "Another knowledge writer owns this home",
  Search: "Knowledge search requires bounded text, a supported mode and a valid page size",
  MeaningUnavailable: "Meaning search is not ready; showing word results",
  EmbedderChanged:
    "The embedder changed since the knowledge hub was indexed; run titan kb reindex before meaning search",
  EmbedderModelUnavailable: "The local embedding model is not installed in this build",
  Client: "Knowledge server returned an invalid or mismatched result",
  Command: "Manage readable knowledge entries and retained versions",
  Add: "Add a Markdown or persona YAML file to the knowledge hub",
  Get: "Read a final knowledge entry by id",
  Prune: "Report old, replaced and duplicate entries, or archive them with --apply",
  Consolidate: "Report duplicate groups, or join them with --apply while retaining every source",
  Restore: "Restore an archived entry by id while preserving its version history",
  MaintenanceInvalid: "Maintenance requires --apply as a flag and --before as a UTC date and time",
  Update: "Update a knowledge entry using its current version",
  Delete: "Delete an ordinary knowledge entry using its current version",
  SearchTool: "Search final knowledge entries by words, with an explicit meaning fallback",
  Reindex: "Rebuild the search database and readable index from final files",
  Promote: "Copy a project entry to the home hub and keep the project entry",
  List: "List entries of both hubs, filtered by kind, scope, tag and state",
  Stats: "Print the figures of each hub: entries, size, oldest, newest, never read, meaning search",
  Show: "Print an entry with its history and its links",
  ListInvalid:
    "Knowledge list needs a known kind, a scope of project or home, a tag, a state of final or pending and a valid page size",
  StatsInvalid: "Knowledge server returned invalid figures",
  ScopeInvalid: "Knowledge scope must be project or home",
  Version: "Knowledge changes require --entry-version with the version that was read",
  Publication:
    "Knowledge publication needs a unique id, distinct entry changes and matching base versions",
  PublicationReceipt:
    "Knowledge publication receipt is inconsistent with its durable change record",
  ImportedIdentity: "Imported entry id and version must match the entry being updated",
  Index:
    "# Knowledge hub\n\n| Id | Kind | Title | Tags | Version | State | Summary | File |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n",
} as const;

export function knowledgeIndexRow(fields: readonly string[], path: string): string {
  return `| ${fields.join(" | ")} | [${path}](${path}) |\n`;
}
