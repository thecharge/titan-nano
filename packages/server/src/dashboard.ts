import { basename, extname, resolve } from "node:path";
import {
  DashboardBuild,
  DashboardHeader,
  DashboardHtmlSource,
  DashboardLimit,
  DashboardPolicy,
  DashboardRoute,
  DashboardSession,
  ErrorCode,
  FileEncoding,
  HttpMethod,
  HttpOriginHeader,
  HttpStatus,
  IoLimit,
  LocalServer,
  ServerCode,
} from "@titan/constants";
import { settle } from "@titan/core";
import { TitanError } from "@titan/errors";
import { DashboardMessage } from "@titan/messages";
import { readFileBytes } from "@titan/streams";
import {
  ArtifactSearchSchema,
  type DashboardAsset,
  DashboardKnowledgeQuerySchema,
  DashboardPackedAssetsSchema,
  type DashboardSource,
  RunListSearchSchema,
} from "@titan/types";
import { DashboardSessions, sessionFrom } from "./dashboard-session.ts";
import { cursorOf, eventBody } from "./event-stream.ts";

const types: Record<string, string> = {
  ".js": DashboardPolicy.Script,
  ".css": DashboardPolicy.Style,
  ".map": DashboardPolicy.Plain,
};

export function rewriteSources(html: string, names: ReadonlySet<string>): string {
  return html.replace(DashboardHtmlSource.SourcePattern, (whole, value: string) => {
    const name = basename(value);
    return names.has(name) ? whole.replace(value, `${DashboardHtmlSource.Origin}${name}`) : whole;
  });
}

export async function buildDashboardAssets(
  directory = import.meta.dir,
): Promise<Map<string, DashboardAsset>> {
  const packed = resolve(directory, DashboardBuild.PackedAssets);
  if (await Bun.file(packed).exists()) {
    const assets = DashboardPackedAssetsSchema.parse(
      JSON.parse((await readFileBytes(packed, IoLimit.DataBytes)).toString(FileEncoding.Utf8)),
    );
    const names = new Set(assets.map((asset) => basename(asset.path)));
    return new Map(
      assets.map((asset) => [
        asset.path,
        {
          body: asset.path === DashboardRoute.Page ? rewriteSources(asset.body, names) : asset.body,
          type: asset.type,
        },
      ]),
    );
  }
  const built = await Bun.build({
    entrypoints: [resolve(directory, DashboardPolicy.Entry)],
    target: DashboardBuild.Target,
    minify: false,
  });
  if (!built.success) throw new TitanError(ErrorCode.Arguments, DashboardMessage.Page);
  const names = new Set(built.outputs.map((output) => basename(output.path)));
  const assets = new Map<string, DashboardAsset>();
  for (const output of built.outputs) {
    const name = basename(output.path);
    const extension = extname(name);
    if (extension === DashboardBuild.HtmlExtension)
      assets.set(DashboardRoute.Page, {
        body: rewriteSources(await output.text(), names),
        type: DashboardPolicy.Html,
      });
    else
      assets.set(`${DashboardHtmlSource.Origin}${name}`, {
        body: new Blob([await output.arrayBuffer()]),
        type: types[extension] ?? DashboardPolicy.Plain,
      });
  }
  return assets;
}

function secured(body: BodyInit | null, status: number, type: string, extra: HeadersInit = {}) {
  const headers = new Headers(extra);
  headers.set(DashboardHeader.ContentSecurityPolicy, DashboardPolicy.ContentSecurityPolicy);
  headers.set(DashboardHeader.ReferrerPolicy, DashboardPolicy.ReferrerPolicy);
  headers.set(DashboardHeader.CacheControl, DashboardPolicy.CacheControl);
  headers.set(DashboardHeader.ContentType, type);
  return new Response(body, { status, headers });
}

function failure(status: number, code: string, message: string): Response {
  return secured(JSON.stringify({ code, error: message }), status, LocalServer.Json);
}

const prepared = buildDashboardAssets();
void settle([() => prepared]);

export class Dashboard {
  private page: Promise<Map<string, DashboardAsset>> | undefined;

  constructor(
    private readonly source: DashboardSource,
    private readonly sessions: DashboardSessions = new DashboardSessions(),
  ) {}

  assets(): Promise<Map<string, DashboardAsset>> {
    this.page ??= prepared;
    return this.page;
  }

  handles(pathname: string): boolean {
    return (
      pathname === DashboardRoute.Page ||
      pathname === DashboardRoute.Login ||
      pathname === DashboardRoute.Runs ||
      pathname === DashboardRoute.Knowledge ||
      DashboardRoute.ArtifactPattern.test(pathname) ||
      DashboardRoute.ConfigurationPattern.test(pathname) ||
      DashboardRoute.RunPattern.test(pathname) ||
      DashboardRoute.AssetPattern.test(pathname)
    );
  }

  mint(): string {
    return this.sessions.mint();
  }

  async respond(request: Request, ownOrigin: string): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get(HttpOriginHeader);
    if (origin !== null && origin !== ownOrigin)
      return failure(HttpStatus.Forbidden, ErrorCode.PermissionDenied, DashboardMessage.Origin);
    if (url.pathname === DashboardRoute.Login) return this.login(request, url);
    if (!this.sessions.valid(sessionFrom(request.headers.get(DashboardHeader.Cookie))))
      return failure(HttpStatus.Unauthorized, ServerCode.Unauthorized, DashboardMessage.Cookie);
    if (request.method !== HttpMethod.Get) return this.refuse();
    if (url.pathname === DashboardRoute.Page || DashboardRoute.AssetPattern.test(url.pathname)) {
      const asset = (await this.assets()).get(url.pathname);
      return asset
        ? secured(asset.body, HttpStatus.Ok, asset.type)
        : failure(HttpStatus.NotFound, ErrorCode.RunNotFound, DashboardMessage.Route);
    }
    if (url.pathname === DashboardRoute.Runs) {
      if (new Set(url.searchParams.keys()).size !== url.searchParams.size)
        return failure(HttpStatus.BadRequest, ErrorCode.Arguments, DashboardMessage.Route);
      const query = RunListSearchSchema.safeParse({
        limit: String(DashboardLimit.RunPageSize),
        ...Object.fromEntries(url.searchParams),
      });
      if (!query.success)
        return failure(HttpStatus.BadRequest, ErrorCode.Arguments, DashboardMessage.Route);
      return secured(
        JSON.stringify(await this.source.list(query.data)),
        HttpStatus.Ok,
        LocalServer.Json,
      );
    }
    if (url.pathname === DashboardRoute.Knowledge) {
      if (!this.source.knowledge)
        return failure(
          HttpStatus.NotFound,
          ErrorCode.KnowledgeMissing,
          DashboardMessage.Unavailable,
        );
      if (new Set(url.searchParams.keys()).size !== url.searchParams.size)
        return failure(HttpStatus.BadRequest, ErrorCode.Arguments, DashboardMessage.Route);
      const query = DashboardKnowledgeQuerySchema.safeParse(Object.fromEntries(url.searchParams));
      if (!query.success)
        return failure(HttpStatus.BadRequest, ErrorCode.Arguments, DashboardMessage.Route);
      return secured(
        JSON.stringify(await this.source.knowledge(query.data)),
        HttpStatus.Ok,
        LocalServer.Json,
      );
    }
    const configuration = DashboardRoute.ConfigurationPattern.exec(url.pathname);
    if (configuration?.[1]) {
      if (url.searchParams.size)
        return failure(HttpStatus.BadRequest, ErrorCode.Arguments, DashboardMessage.Route);
      if (!this.source.configuration)
        return failure(HttpStatus.NotFound, ErrorCode.RunNotFound, DashboardMessage.Unavailable);
      return secured(
        JSON.stringify(await this.source.configuration(decodeURIComponent(configuration[1]))),
        HttpStatus.Ok,
        LocalServer.Json,
      );
    }
    const artifact = DashboardRoute.ArtifactPattern.exec(url.pathname);
    if (artifact?.[1]) return this.artifacts(url, decodeURIComponent(artifact[1]), artifact[2]);
    const match = DashboardRoute.RunPattern.exec(url.pathname);
    if (!match?.[1])
      return failure(HttpStatus.NotFound, ErrorCode.RunNotFound, DashboardMessage.Route);
    const id = decodeURIComponent(match[1]);
    if (match[2]) return this.stream(request, id);
    try {
      return secured(JSON.stringify(await this.source.run(id)), HttpStatus.Ok, LocalServer.Json);
    } catch (error) {
      if (error instanceof TitanError && error.code === ErrorCode.RunNotFound)
        return failure(HttpStatus.NotFound, ErrorCode.RunNotFound, DashboardMessage.Unavailable);
      throw error;
    }
  }

  private async artifacts(url: URL, id: string, file?: string): Promise<Response> {
    if (new Set(url.searchParams.keys()).size !== url.searchParams.size)
      return failure(HttpStatus.BadRequest, ErrorCode.Arguments, DashboardMessage.Route);
    if (file && this.source.artifact) {
      const query = ArtifactSearchSchema.safeParse(Object.fromEntries(url.searchParams));
      if (!query.success)
        return failure(HttpStatus.BadRequest, ErrorCode.ArtifactRange, DashboardMessage.Route);
      return secured(
        JSON.stringify(await this.source.artifact(id, file, query.data)),
        HttpStatus.Ok,
        LocalServer.Json,
      );
    }
    if (!file && url.searchParams.size)
      return failure(HttpStatus.BadRequest, ErrorCode.Arguments, DashboardMessage.Route);
    if (!file && this.source.artifacts)
      return secured(
        JSON.stringify(await this.source.artifacts(id)),
        HttpStatus.Ok,
        LocalServer.Json,
      );
    return failure(
      HttpStatus.NotFound,
      ErrorCode.ArtifactUnavailable,
      DashboardMessage.Unavailable,
    );
  }

  private refuse(): Response {
    return secured(
      JSON.stringify({ code: ErrorCode.Method, error: DashboardMessage.Method }),
      HttpStatus.MethodNotAllowed,
      LocalServer.Json,
      { [DashboardHeader.Allow]: DashboardPolicy.Allow },
    );
  }

  private login(request: Request, url: URL): Response {
    if (request.method !== HttpMethod.Get) return this.refuse();
    const session = this.sessions.consume(url.searchParams.get(DashboardSession.CodeParameter));
    if (session === undefined)
      return failure(HttpStatus.Forbidden, ErrorCode.PermissionDenied, DashboardMessage.Login);
    return secured(null, HttpStatus.SeeOther, DashboardPolicy.Plain, {
      [DashboardHeader.Location]: DashboardRoute.Page,
      [DashboardHeader.SetCookie]: `${DashboardSession.CookieName}${DashboardSession.CookieAssignment}${session}${DashboardSession.CookieSeparator}${DashboardSession.CookieFlags}`,
    });
  }

  private stream(request: Request, id: string): Response {
    const first = cursorOf(request);
    if (first === undefined)
      return failure(HttpStatus.BadRequest, ErrorCode.EventCursor, DashboardMessage.Cursor);
    const source = this.source;
    return secured(
      eventBody((after) => source.events(id, after), first),
      HttpStatus.Ok,
      DashboardPolicy.EventStream,
    );
  }
}
