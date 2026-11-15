# Harness repair browser evidence

These images show the actual local Titan server with a controlled fake backend. They were captured with Chrome 156.0.8078.47 using a fresh temporary profile. They contain synthetic project knowledge and generated run identifiers. They do not establish live vendor behavior or production readiness.

- [Run overview](overview.png): stored run state and navigation to shared knowledge. Recorded measurements are retained in the catalog and expand below each run. The open disclosure survives refresh.
- [Run detail](run.png): recorded measurements, execution context, steps, attempts, checks, board events and open requests.
- [Mobile run detail](mobile-run.png): the actual run page at a 390-pixel viewport.
- [Mobile overview](mobile-overview.png): the run table scrolls inside its viewport. The page width stays 390 pixels.
- [Knowledge inspection](knowledge.png): committed project/home entries, per-kind and scope counts, date ranges, state/scope/kind/tag links, missing-model readiness, entry content, provenance and related links. This view is read-only.

The refreshed overview, run and knowledge captures used browser protocol navigation against the actual server. Desktop captures use a 1440-pixel viewport. Mobile captures use 390 pixels. Each page retained its viewport width. The overview measurement disclosure remained open after its two-second refresh. Tests independently cover the authentication, mutation refusal and retained read counters. The current source includes write-side run summary projection and pending-state inspection. Complete replacement gates are recorded in the repair evidence after their observed results; these images alone do not complete dashboard acceptance.

- [Retained history](history.png): actual browser continuation from version 53 through the older page containing versions two and one. The browser checked both retained bodies and the absence of a further link. An image-handler payload remained literal text, with no image element or executed handler. Per-kind dates appear beside counts. Synthetic knowledge uses the same read-only server endpoint as normal inspection.
