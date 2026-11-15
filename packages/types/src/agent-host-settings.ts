import { ConfigDefault } from "@titan/constants";
import { z } from "zod";

const count = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
export const AgentHostSettingsSchema = z.strictObject({
  gc_markers: count.max(ConfigDefault.HostGcMarkersLimit).default(ConfigDefault.HostGcMarkers),
  worker_threads: count
    .min(ConfigDefault.HostWorkerThreadsMinimum)
    .max(ConfigDefault.HostWorkerThreadsLimit)
    .default(ConfigDefault.HostWorkerThreads),
  startup_timeout_ms: count
    .max(ConfigDefault.HostStartupLimit)
    .default(ConfigDefault.HostStartupMilliseconds),
});
export type AgentHostSettings = z.infer<typeof AgentHostSettingsSchema>;
