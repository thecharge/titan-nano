import {
  DashboardLimit,
  DashboardRoute,
  DashboardStream,
  DashboardTag,
  DashboardText,
  HttpStatus,
  KnowledgeKind,
  KnowledgeScope,
  KnowledgeState,
  ScriptWord,
} from "@titan/constants";
import { DashboardMessage } from "@titan/messages";
import type {
  ArtifactInspection,
  ArtifactPage,
  CapacitySnapshot,
  DashboardKnowledge,
  DashboardKnowledgeQuery,
  DashboardRun,
  DashboardRunContext,
  DashboardRunEntry,
  DashboardRunList,
  DashboardStep,
  Measure,
  RunConfiguration,
  RunEventView,
  RunNumbers,
} from "@titan/types";

const root = document.getElementById(DashboardTag.Root);
const cursors = new Map<string, number>();
let source: EventSource | undefined;
let navigation: AbortController | undefined;
let refresh: ReturnType<typeof setInterval> | undefined;

function node(tag: string, text?: string): HTMLElement {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  return element;
}

function measureText(measure: Measure): string {
  return measure.value === null
    ? measure.label
    : DashboardMessage.Measure(measure.value, measure.label);
}

function row(cells: readonly string[], header = false): HTMLElement {
  const line = node(DashboardTag.Row);
  for (const cell of cells) {
    const value = node(header ? DashboardTag.Header : DashboardTag.Cell, cell);
    value.title = cell;
    line.append(value);
  }
  return line;
}

async function getJson<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(path, {
    signal: AbortSignal.any([
      signal,
      AbortSignal.timeout(DashboardText.RequestTimeoutMilliseconds),
    ]),
  });
  if (!response.ok)
    throw new Error(
      response.status === HttpStatus.Unauthorized || response.status === HttpStatus.Forbidden
        ? DashboardMessage.Cookie
        : DashboardMessage.LoadFailed,
    );
  return (await response.json()) as T;
}

function show(...children: HTMLElement[]): void {
  root?.replaceChildren(...children);
}

function numberCells(numbers: RunNumbers | null): string[] {
  const empty = DashboardText.Empty;
  return [
    numbers ? new Date(numbers.started_at).toISOString() : empty,
    numbers ? String(numbers.elapsed) : empty,
    numbers ? String(numbers.attempts) : empty,
    numbers ? String(numbers.most_agents_at_once) : empty,
    numbers ? measureText(numbers.input_tokens) : empty,
    numbers ? measureText(numbers.output_tokens) : empty,
    numbers ? measureText(numbers.cost_usd) : empty,
    numbers ? String(numbers.survived) : empty,
    numbers ? String(numbers.refuted) : empty,
    numbers ? String(numbers.proofs.proven) : empty,
    numbers ? String(numbers.proofs.refuted) : empty,
    numbers ? String(numbers.proofs.not_proven) : empty,
  ];
}

function cellsOf(entry: DashboardRunEntry): string[] {
  const empty = DashboardText.Empty;
  return [
    empty,
    entry.summary.workflow_id ?? empty,
    String(entry.summary.state),
    entry.stage ?? empty,
    entry.persona ?? empty,
    entry.numbers ? new Date(entry.numbers.started_at).toISOString() : empty,
    entry.numbers ? measureText(entry.numbers.cost_usd) : empty,
  ];
}

function knowledgeLink(
  query: DashboardKnowledgeQuery = {},
  label: string = DashboardMessage.Knowledge,
): HTMLElement {
  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(query))
    if (value !== undefined) search.set(name, String(value));
  const link = node(DashboardTag.Link, label) as HTMLAnchorElement;
  link.href = DashboardText.KnowledgeHash + search.toString();
  return link;
}

function artifactLink(id: string, file?: string, offset?: number): HTMLAnchorElement {
  const link = node(
    DashboardTag.Link,
    file ? DashboardMessage.ArtifactNext : DashboardMessage.Artifacts,
  ) as HTMLAnchorElement;
  link.href = DashboardText.ArtifactHash + encodeURIComponent(id);
  if (file) link.href += DashboardRoute.Page + file;
  if (offset !== undefined)
    link.href += DashboardRoute.Query + new URLSearchParams({ offset: String(offset) });
  return link;
}

function artifactContent(page: ArtifactPage): HTMLElement[] {
  const bytes = Uint8Array.from(atob(page.content), (value) => value.charCodeAt(0));
  try {
    return [
      node(DashboardTag.Preformatted, new TextDecoder(undefined, { fatal: true }).decode(bytes)),
    ];
  } catch {
    return [
      node(DashboardTag.Paragraph, DashboardMessage.ArtifactBinary),
      node(DashboardTag.Preformatted, page.content),
    ];
  }
}

function configurationLink(id: string): HTMLAnchorElement {
  const link = node(DashboardTag.Link, DashboardMessage.Configuration) as HTMLAnchorElement;
  link.href = DashboardText.ConfigurationHash + encodeURIComponent(id);
  return link;
}

async function showConfiguration(id: string, signal: AbortSignal): Promise<void> {
  const configuration = await getJson<RunConfiguration>(
    DashboardRoute.RunPrefix + encodeURIComponent(id) + DashboardRoute.ConfigurationSuffix,
    signal,
  );
  if (signal.aborted) return;
  const back = node(DashboardTag.Link, DashboardMessage.BackToRun) as HTMLAnchorElement;
  back.href = DashboardText.RunHash + encodeURIComponent(id);
  show(
    back,
    node(DashboardTag.SecondHeading, DashboardMessage.Configuration),
    node(DashboardTag.ThirdHeading, DashboardMessage.ConfigurationCommitment),
    node(DashboardTag.Preformatted, configuration.config.hash),
    node(DashboardTag.ThirdHeading, DashboardMessage.ConfigurationSettings),
    node(DashboardTag.Preformatted, JSON.stringify(configuration.config.value, null, 2)),
    node(DashboardTag.ThirdHeading, DashboardMessage.ConfigurationSources),
    node(DashboardTag.Preformatted, JSON.stringify(configuration.config.sources, null, 2)),
  );
}

async function showArtifacts(
  id: string,
  file: string | undefined,
  query: string,
  signal: AbortSignal,
): Promise<void> {
  const path = DashboardRoute.RunPrefix + encodeURIComponent(id) + DashboardRoute.ArtifactsSuffix;
  const back = node(DashboardTag.Link, DashboardMessage.BackToRun) as HTMLAnchorElement;
  back.href = DashboardText.RunHash + encodeURIComponent(id);
  if (file) {
    const page = await getJson<ArtifactPage>(
      path + DashboardRoute.Page + file + DashboardRoute.Query + query,
      signal,
    );
    if (signal.aborted) return;
    const first = artifactLink(id, file, 0);
    first.textContent = DashboardMessage.ArtifactStart;
    show(
      back,
      artifactLink(id),
      node(DashboardTag.SecondHeading, page.file.path),
      node(
        DashboardTag.Paragraph,
        DashboardMessage.ArtifactRange(page.offset, page.next_offset, page.file.bytes),
      ),
      ...artifactContent(page),
      ...(page.offset ? [first] : []),
      ...(page.has_more ? [artifactLink(id, file, page.next_offset)] : []),
    );
    return;
  }
  const inspection = await getJson<ArtifactInspection>(path, signal);
  if (signal.aborted) return;
  const table = node(DashboardTag.Table);
  table.append(
    node(DashboardTag.Caption, DashboardMessage.Artifacts),
    row(DashboardMessage.ArtifactColumns, true),
  );
  for (const entry of inspection.files) {
    const line = row([
      DashboardText.Empty,
      String(entry.bytes),
      String(entry.executable),
      entry.hash,
    ]);
    const link = artifactLink(id, entry.id);
    link.textContent = entry.path;
    line.firstElementChild?.append(link);
    table.append(line);
  }
  show(
    back,
    node(DashboardTag.SecondHeading, DashboardMessage.Artifacts),
    node(DashboardTag.Preformatted, inspection.hash),
    inspection.files.length ? table : node(DashboardTag.Paragraph, DashboardMessage.ArtifactEmpty),
    node(DashboardTag.ThirdHeading, DashboardMessage.ArtifactOutputs),
    node(DashboardTag.Preformatted, JSON.stringify(inspection.outputs, null, 2)),
  );
}

async function showKnowledge(query: string, signal: AbortSignal): Promise<void> {
  const knowledge = await getJson<DashboardKnowledge>(
    DashboardRoute.Knowledge + DashboardRoute.Query + query,
    signal,
  );
  if (signal.aborted) return;
  const block = node(DashboardTag.Section);
  const back = node(DashboardTag.Link, DashboardMessage.Runs) as HTMLAnchorElement;
  back.href = DashboardText.HomeHash;
  block.append(back, node(DashboardTag.SecondHeading, DashboardMessage.Knowledge));
  block.append(node(DashboardTag.Paragraph, DashboardMessage.KnowledgeReadOnly));
  block.append(
    node(
      DashboardTag.Paragraph,
      knowledge.stats.meaning_ready
        ? DashboardMessage.KnowledgeReady
        : DashboardMessage.KnowledgeUnavailable,
    ),
  );
  for (const scope of knowledge.stats.scopes) {
    block.append(
      node(
        DashboardTag.Paragraph,
        DashboardMessage.KnowledgeCounts(scope.scope, scope.entries, scope.bytes, scope.never_read),
      ),
    );
    block.append(
      node(
        DashboardTag.Paragraph,
        DashboardMessage.KnowledgeDates(
          scope.oldest?.updated ?? null,
          scope.newest?.updated ?? null,
        ),
      ),
    );
    for (const kind of scope.kinds) {
      block.append(
        node(
          DashboardTag.Paragraph,
          DashboardMessage.KnowledgeKindCounts(
            kind.kind,
            kind.entries,
            kind.bytes,
            kind.never_read,
            kind.oldest?.updated ?? null,
            kind.newest?.updated ?? null,
          ),
        ),
      );
    }
  }
  const selection = new URLSearchParams(query);
  const runId = selection.get(DashboardRoute.KnowledgeRunParameter) ?? undefined;
  const scope = Object.values(KnowledgeScope).find(
    (value) => value === selection.get(DashboardRoute.KnowledgeScopeParameter),
  );
  const kind = Object.values(KnowledgeKind).find(
    (value) => value === selection.get(DashboardRoute.KnowledgeKindParameter),
  );
  const state = Object.values(KnowledgeState).find(
    (value) => value === selection.get(DashboardRoute.KnowledgeStateParameter),
  );
  const tag = selection.get(DashboardRoute.KnowledgeTagParameter) ?? undefined;
  block.append(knowledgeLink({ run_id: runId }, DashboardMessage.KnowledgeAll));
  const scopes = node(DashboardTag.Paragraph, DashboardMessage.KnowledgeScopes);
  for (const selected of runId === undefined
    ? [KnowledgeScope.Home]
    : Object.values(KnowledgeScope))
    scopes.append(
      knowledgeLink(
        { run_id: runId, scope: selected, kind, tag, state },
        DashboardMessage.Filter(selected),
      ),
    );
  block.append(scopes);
  const kinds = node(DashboardTag.Paragraph, DashboardMessage.KnowledgeKinds);
  for (const selected of Object.values(KnowledgeKind))
    kinds.append(
      knowledgeLink(
        { run_id: runId, scope, kind: selected, tag, state },
        DashboardMessage.Filter(selected),
      ),
    );
  block.append(kinds);
  const states = node(DashboardTag.Paragraph, DashboardMessage.KnowledgeStates);
  for (const selected of Object.values(KnowledgeState))
    states.append(
      knowledgeLink(
        { run_id: runId, scope, kind, tag, state: selected },
        DashboardMessage.Filter(selected),
      ),
    );
  block.append(states);
  for (const entry of knowledge.list.entries) {
    const line = node(
      DashboardTag.Paragraph,
      DashboardMessage.KnowledgeEntry(entry.scope, entry.kind, entry.title, entry.version),
    );
    if (entry.attempt && entry.operation)
      line.append(
        node(
          DashboardTag.Paragraph,
          DashboardMessage.KnowledgePending(
            entry.attempt.run_id,
            entry.attempt.step_id,
            entry.attempt.candidate_id,
            entry.attempt.attempt,
            entry.operation,
          ),
        ),
      );
    if (entry.state === KnowledgeState.Final)
      line.append(
        knowledgeLink(
          { run_id: runId, id: entry.id, scope: entry.scope },
          DashboardMessage.KnowledgeOpen,
        ),
      );
    for (const selected of entry.tags)
      line.append(
        knowledgeLink(
          { run_id: runId, scope, kind, tag: selected, state },
          DashboardMessage.Filter(selected),
        ),
      );
    block.append(line);
  }
  if (!knowledge.list.entries.length)
    block.append(node(DashboardTag.Paragraph, DashboardMessage.KnowledgeEmpty));
  if (knowledge.list.truncated)
    block.append(node(DashboardTag.Paragraph, DashboardMessage.KnowledgeTruncated));
  if (knowledge.entry) {
    const found = knowledge.entry;
    block.append(node(DashboardTag.ThirdHeading, found.entry.title));
    block.append(node(DashboardTag.Preformatted, found.entry.body));
    block.append(
      node(
        DashboardTag.Paragraph,
        DashboardMessage.KnowledgeHistory(
          found.history.earlier_versions,
          found.history.promoted_from,
        ),
      ),
    );
    for (const version of found.history.page.entries) {
      block.append(
        node(
          DashboardTag.ThirdHeading,
          DashboardMessage.KnowledgeEntry(
            found.scope,
            version.kind,
            version.title,
            version.version,
          ),
        ),
      );
      block.append(node(DashboardTag.Preformatted, version.body));
    }
    if (found.history.page.next_before !== null)
      block.append(
        knowledgeLink(
          {
            run_id: runId,
            id: found.entry.id,
            scope: found.scope,
            before: found.history.page.next_before,
          },
          DashboardMessage.KnowledgeEarlier,
        ),
      );
    for (const related of found.links) {
      const line = node(
        DashboardTag.Paragraph,
        DashboardMessage.KnowledgeRelation(related.scope, related.title, related.relation),
      );
      line.append(
        knowledgeLink(
          { run_id: runId, id: related.id, scope: related.scope },
          DashboardMessage.KnowledgeOpen,
        ),
      );
      block.append(line);
    }
  }
  if (!signal.aborted) show(block);
}

function runFilters(query: string): HTMLElement {
  const form = node(DashboardTag.Form);
  const search = new URLSearchParams(query);
  const inputs = DashboardText.RunFilterFields.map((name, index) => {
    const label = node(DashboardTag.Label, DashboardMessage.RunFilterLabels[index]);
    const input = node(DashboardTag.Input) as HTMLInputElement;
    input.name = name;
    input.value = search.get(name) ?? DashboardText.Empty;
    label.append(input);
    form.append(label);
    return input;
  });
  const clear = node(DashboardTag.Link, DashboardMessage.ClearFilters) as HTMLAnchorElement;
  clear.href = DashboardText.HomeHash;
  clear.addEventListener(DashboardText.ClickEvent, () => {
    for (const input of inputs) input.value = DashboardText.Empty;
  });
  form.append(node(DashboardTag.Button, DashboardMessage.ApplyFilters), clear);
  form.addEventListener(DashboardText.SubmitEvent, (event) => {
    event.preventDefault();
    const next = new URLSearchParams(query);
    next.delete(DashboardRoute.BeforeParameter);
    for (const input of inputs) {
      if (input.value.trim()) next.set(input.name, input.value.trim());
      else next.delete(input.name);
    }
    location.hash = DashboardText.ListHash + next.toString();
  });
  return form;
}

async function showList(query: string, signal: AbortSignal, filters: HTMLElement): Promise<void> {
  const list = await getJson<DashboardRunList>(
    DashboardRoute.Runs + (query ? DashboardRoute.Query + query : DashboardText.Empty),
    signal,
  );
  if (signal.aborted || filters.contains(document.activeElement)) return;
  const table = node(DashboardTag.Table);
  table.className = DashboardText.RunListClass;
  table.append(node(DashboardTag.Caption, DashboardMessage.RunList));
  table.append(row(DashboardText.Columns, true));
  for (const entry of list.runs) {
    const link = node(DashboardTag.Link, entry.summary.run_id) as HTMLAnchorElement;
    link.href = DashboardText.RunHash + encodeURIComponent(entry.summary.run_id);
    link.title = entry.summary.run_id;
    const line = row(cellsOf(entry));
    line.firstElementChild?.append(link);
    table.append(line);
    if (entry.numbers) {
      const details = node(DashboardTag.Details) as HTMLDetailsElement;
      details.id = DashboardText.MeasurementsIdPrefix + entry.summary.run_id;
      details.open =
        (document.getElementById(details.id) as HTMLDetailsElement | null)?.open ?? false;
      details.append(
        node(DashboardTag.Summary, DashboardMessage.AllMeasurements),
        runNumbers(entry.numbers),
      );
      const measurements = node(DashboardTag.Cell) as HTMLTableCellElement;
      measurements.colSpan = DashboardText.Columns.length;
      measurements.append(details);
      const expanded = node(DashboardTag.Row);
      expanded.append(measurements);
      table.append(expanded);
    }
  }
  const viewport = node(DashboardTag.Group);
  viewport.className = DashboardText.TableViewportClass;
  viewport.append(table);
  const navigation = node(DashboardTag.Paragraph);
  const search = new URLSearchParams(query);
  if (search.has(DashboardRoute.BeforeParameter)) {
    search.delete(DashboardRoute.BeforeParameter);
    const latest = node(DashboardTag.Link, DashboardMessage.LatestRuns) as HTMLAnchorElement;
    latest.href = DashboardText.ListHash + search.toString();
    navigation.append(latest);
  }
  if (list.page?.has_more) {
    search.set(DashboardRoute.BeforeParameter, String(list.page.next_before));
    const older = node(DashboardTag.Link, DashboardMessage.OlderRuns) as HTMLAnchorElement;
    older.href = DashboardText.ListHash + search.toString();
    navigation.append(older);
  }
  show(
    knowledgeLink(),
    filters,
    ...(list.capacity ? [capacityBlock(list.capacity)] : []),
    list.runs.length
      ? viewport
      : node(
          DashboardTag.Paragraph,
          query ? DashboardMessage.EmptyRunPage : DashboardMessage.EmptyRuns,
        ),
    ...(navigation.children.length ? [navigation] : []),
  );
}

function capacityBlock(capacity: CapacitySnapshot): HTMLElement {
  const block = node(DashboardTag.Section);
  block.append(
    node(DashboardTag.ThirdHeading, DashboardMessage.AgentCapacity),
    node(
      DashboardTag.Paragraph,
      DashboardMessage.CapacityActive(capacity.active, capacity.max_active_agents),
    ),
    node(
      DashboardTag.Paragraph,
      DashboardMessage.CapacityPending(capacity.pending, capacity.max_pending_agents),
    ),
  );
  const backends = new Set([
    ...Object.keys(capacity.backend_limits),
    ...Object.keys(capacity.backends),
  ]);
  for (const backend of backends)
    block.append(
      node(
        DashboardTag.Paragraph,
        DashboardMessage.CapacityBackend(
          backend,
          Reflect.get(capacity.backends, backend) ?? 0,
          Reflect.get(capacity.backend_limits, backend) ?? null,
        ),
      ),
    );
  return block;
}

function eventLine(event: RunEventView): HTMLElement {
  return node(
    DashboardTag.Item,
    DashboardMessage.EventLine(event.id, event.type, JSON.stringify(event.data)),
  );
}

function stepBlock(step: DashboardStep): HTMLElement {
  const block = node(DashboardTag.Section);
  block.append(
    node(
      DashboardTag.ThirdHeading,
      DashboardMessage.StepTitle(step.id, step.persona ?? ScriptWord, step.state),
    ),
  );
  if (step.needs?.length)
    block.append(node(DashboardTag.Paragraph, DashboardMessage.Dependencies(step.needs)));
  for (const phase of step.recovery ?? []) {
    block.append(
      node(
        DashboardTag.Paragraph,
        DashboardMessage.PhaseRecovery(phase.phase, phase.executions, phase.retries),
      ),
    );
    if (phase.next_retry !== null)
      block.append(node(DashboardTag.Paragraph, DashboardMessage.RetryTime(phase.next_retry)));
    if (phase.capture_pending)
      block.append(node(DashboardTag.Paragraph, DashboardMessage.CapturePending));
    if (phase.error) block.append(node(DashboardTag.Preformatted, phase.error));
  }
  for (const attempt of step.attempts) {
    block.append(
      node(
        DashboardTag.FourthHeading,
        DashboardMessage.AttemptTitle(attempt.attempt, attempt.verdict),
      ),
    );
    for (const text of attempt.evidence) block.append(node(DashboardTag.Preformatted, text));
  }
  for (const check of step.checks)
    block.append(
      node(DashboardTag.Paragraph, DashboardMessage.CheckLine(check.phase, check.answer)),
    );
  return block;
}

function rememberCursor(id: string, cursor: number): void {
  cursors.delete(id);
  cursors.set(id, cursor);
  if (cursors.size > DashboardLimit.RunPageSize) {
    const oldest = cursors.keys().next().value;
    if (oldest !== undefined) cursors.delete(oldest);
  }
}

function runNumbers(numbers: RunNumbers): HTMLElement {
  const block = node(DashboardTag.Section);
  block.append(node(DashboardTag.ThirdHeading, DashboardMessage.RunNumbers));
  const list = node(DashboardTag.DescriptionList);
  const values = numberCells(numbers);
  for (const [index, label] of DashboardText.NumberColumns.entries()) {
    const item = node(DashboardTag.Group);
    item.append(
      node(DashboardTag.Term, label),
      node(DashboardTag.Description, values[index] ?? DashboardText.Empty),
    );
    list.append(item);
  }
  block.append(list);
  return block;
}

function runContext(context: DashboardRunContext): HTMLElement {
  const block = node(DashboardTag.Section);
  block.className = DashboardText.RunContextClass;
  block.append(node(DashboardTag.ThirdHeading, DashboardMessage.RunContext));
  const list = node(DashboardTag.DescriptionList);
  const values = [
    context.project,
    context.backend,
    context.runtime_version ?? DashboardMessage.NotReported,
    String(context.max_parallel),
    context.artifacts ?? DashboardMessage.NotReported,
  ];
  for (const [index, label] of DashboardMessage.RunContextLabels.entries()) {
    const item = node(DashboardTag.Group);
    item.append(node(DashboardTag.Term, label), node(DashboardTag.Description, values[index]));
    list.append(item);
  }
  block.append(list);
  if (context.error) block.append(node(DashboardTag.Preformatted, context.error));
  return block;
}

function renderRun(run: DashboardRun, board: HTMLElement, connection: HTMLElement): void {
  const id = run.numbers.run_id;
  const requests = node(DashboardTag.List);
  for (const request of run.requests)
    requests.append(
      node(
        DashboardTag.Item,
        DashboardMessage.RequestLine(request.request_id, request.kind, request.answer_command),
      ),
    );
  const back = node(DashboardTag.Link, DashboardMessage.Runs) as HTMLAnchorElement;
  back.href = DashboardText.HomeHash;
  show(
    back,
    knowledgeLink({ run_id: id }),
    configurationLink(id),
    node(
      DashboardTag.SecondHeading,
      DashboardMessage.RunTitle(run.numbers.run_id, run.numbers.state),
    ),
    runNumbers(run.numbers),
    ...(run.context ? [runContext(run.context)] : []),
    ...(run.context?.artifacts ? [artifactLink(id)] : []),
    node(DashboardTag.Paragraph, run.answer_hint),
    node(DashboardTag.ThirdHeading, DashboardText.Steps),
    ...run.steps.map(stepBlock),
    ...(run.steps.length ? [] : [node(DashboardTag.Paragraph, DashboardMessage.EmptySteps)]),
    node(DashboardTag.ThirdHeading, DashboardText.Requests),
    run.requests.length ? requests : node(DashboardTag.Paragraph, DashboardMessage.EmptyRequests),
    node(DashboardTag.ThirdHeading, DashboardText.Board),
    board,
    connection,
  );
}

async function showRun(id: string, signal: AbortSignal): Promise<void> {
  const encoded = encodeURIComponent(id);
  const run = await getJson<DashboardRun>(DashboardRoute.RunPrefix + encoded, signal);
  if (signal.aborted) return;
  const board = node(DashboardTag.List);
  for (const event of run.board) {
    board.append(eventLine(event));
  }
  rememberCursor(id, Math.max(run.board.at(-1)?.id ?? 0, cursors.get(id) ?? 0));
  const connection = node(DashboardTag.Paragraph, DashboardMessage.StreamConnecting);
  renderRun(run, board, connection);
  scheduleRefresh(signal, async () => {
    const latest = await getJson<DashboardRun>(DashboardRoute.RunPrefix + encoded, signal);
    if (!signal.aborted) renderRun(latest, board, connection);
  });
  source = new EventSource(
    DashboardRoute.RunPrefix +
      encoded +
      DashboardRoute.EventsSuffix +
      DashboardText.AfterParameter +
      (cursors.get(id) ?? 0),
  );
  source.addEventListener(DashboardText.StreamOpenEvent, () => {
    if (!signal.aborted) connection.textContent = DashboardMessage.StreamLive;
  });
  source.addEventListener(DashboardText.StreamErrorEvent, () => {
    if (!signal.aborted) connection.textContent = DashboardMessage.StreamInterrupted;
  });
  source.addEventListener(DashboardStream.EventName, (message) => {
    if (signal.aborted) return;
    try {
      const event = JSON.parse((message as MessageEvent<string>).data) as RunEventView;
      if (!Number.isSafeInteger(event.id) || event.id <= (cursors.get(id) ?? 0)) return;
      rememberCursor(id, event.id);
      board.append(eventLine(event));
      if (board.children.length > DashboardLimit.ListedBoardMessages)
        board.firstElementChild?.remove();
      connection.textContent = DashboardMessage.StreamLive;
    } catch {
      connection.textContent = DashboardMessage.StreamInterrupted;
    }
  });
}

function showFailure(error: unknown, signal: AbortSignal): void {
  if (signal.aborted) return;
  const retry = node(DashboardTag.Button, DashboardMessage.Retry);
  retry.addEventListener(DashboardText.ClickEvent, () => void route());
  show(
    node(DashboardTag.SecondHeading, DashboardMessage.LoadFailed),
    node(
      DashboardTag.Paragraph,
      error instanceof Error && error.message === DashboardMessage.Cookie
        ? DashboardMessage.Cookie
        : DashboardMessage.RetryHint,
    ),
    retry,
  );
}

function scheduleRefresh(signal: AbortSignal, update: () => Promise<void>): void {
  let pending = false;
  refresh = setInterval(() => {
    if (pending || signal.aborted) return;
    pending = true;
    void update()
      .catch((error: unknown) => showFailure(error, signal))
      .finally(() => {
        pending = false;
      });
  }, DashboardText.RefreshMilliseconds);
}

async function route(): Promise<void> {
  navigation?.abort();
  const controller = new AbortController();
  navigation = controller;
  const signal = controller.signal;
  source?.close();
  source = undefined;
  if (refresh) clearInterval(refresh);
  refresh = undefined;
  show(node(DashboardTag.Paragraph, DashboardMessage.Loading));
  try {
    const configuration = DashboardText.ConfigurationHashPattern.exec(location.hash);
    if (configuration?.[1]) {
      await showConfiguration(decodeURIComponent(configuration[1]), signal);
      return;
    }
    const artifact = DashboardText.ArtifactHashPattern.exec(location.hash);
    if (artifact?.[1]) {
      await showArtifacts(
        decodeURIComponent(artifact[1]),
        artifact[2],
        artifact[3] ?? DashboardText.Empty,
        signal,
      );
      return;
    }
    const knowledge = DashboardText.KnowledgeHashPattern.exec(location.hash);
    if (knowledge) {
      await showKnowledge(knowledge[1] ?? DashboardText.Empty, signal);
      return;
    }
    const match = DashboardText.RunHashPattern.exec(location.hash);
    if (match?.[1]) {
      await showRun(decodeURIComponent(match[1]), signal);
      return;
    }
    const query = DashboardText.ListHashPattern.exec(location.hash)?.[1] ?? DashboardText.Empty;
    const filters = runFilters(query);
    await showList(query, signal, filters);
    if (!signal.aborted)
      scheduleRefresh(signal, async () => {
        if (!filters.contains(document.activeElement)) await showList(query, signal, filters);
      });
  } catch (error) {
    showFailure(error, signal);
  }
}

window.addEventListener(DashboardText.HashEvent, () => void route());
void route();
