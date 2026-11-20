import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { addAbortListener } from "node:events";
import { request } from "node:https";
import { BlockList, isIP } from "node:net";
import {
  ErrorCode,
  FileEncoding,
  HashAlgorithm,
  HttpHeader,
  LocalServer,
  TextSymbol,
  WebResource,
} from "@titan/constants";
import { TitanError } from "@titan/errors";
import { WebResourceMessage } from "@titan/messages";
import type { WebResourceDial, WebResourceRequest, WebResourceResponse } from "@titan/types";

const privateV4 = new BlockList();
for (const [address, prefix] of WebResource.NonPublicV4) privateV4.addSubnet(address, prefix);

const globalV6 = new BlockList();
globalV6.addSubnet(WebResource.PublicV6, 3, WebResource.IpV6);
const specialV6 = new BlockList();
for (const [address, prefix] of WebResource.NonPublicV6)
  specialV6.addSubnet(address, prefix, WebResource.IpV6);

function publicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !privateV4.check(address);
  return (
    family === 6 &&
    globalV6.check(address, WebResource.IpV6) &&
    !specialV6.check(address, WebResource.IpV6)
  );
}

export function publicResourceURL(value: string): URL {
  const url = URL.parse(value);
  if (
    url?.protocol !== WebResource.Protocol ||
    url.username ||
    url.password ||
    url.href.length > WebResource.UrlCharacters
  )
    throw new TitanError(ErrorCode.Arguments, WebResourceMessage.InvalidUrl);
  url.hash = TextSymbol.Empty;
  return url;
}

async function resolvePublicHost(host: string, signal: AbortSignal) {
  if (isIP(host)) return [{ address: host }];
  let listener: Disposable | undefined;
  try {
    return await Promise.race([
      lookup(host, { all: true }),
      new Promise<never>((_, reject) => {
        listener = addAbortListener(signal, () => reject(signal.reason));
      }),
    ]);
  } finally {
    listener?.[Symbol.dispose]();
  }
}

export function dialPublicResource(
  url: URL,
  address: string,
  signal: AbortSignal,
  send: WebResourceRequest = request,
): Promise<WebResourceResponse> {
  const host = url.hostname.replace(/^\[|\]$/g, TextSymbol.Empty);
  return new Promise((resolve, reject) => {
    const get = send(
      {
        hostname: address,
        servername: isIP(host) ? undefined : host,
        port: url.port || 443,
        path: url.pathname + url.search,
        headers: {
          [WebResource.Host]: url.host,
          [WebResource.AcceptEncoding]: WebResource.Identity,
        },
        agent: false,
        rejectUnauthorized: true,
        maxHeaderSize: WebResource.HeaderBytes,
        signal,
      },
      (response) => {
        const cancellation = addAbortListener(signal, () =>
          response.destroy(new Error(WebResourceMessage.Timeout)),
        );
        response.once(WebResource.CloseEvent, () => cancellation[Symbol.dispose]());
        resolve({
          status: response.statusCode,
          headers: response.headers,
          body: response,
          close: () => response.destroy(),
        });
      },
    );
    get.once(WebResource.ErrorEvent, reject);
    get.end();
  });
}

async function connect(url: URL, signal: AbortSignal, dial: WebResourceDial) {
  const host = url.hostname.replace(/^\[|\]$/g, TextSymbol.Empty);
  const addresses = await resolvePublicHost(host, signal);
  signal.throwIfAborted();
  const selected = addresses[0];
  if (!selected || addresses.some(({ address }) => !publicAddress(address)))
    throw new Error(WebResourceMessage.PublicAddress);
  return dial(url, selected.address, signal);
}

export async function readPublicResource(
  url: URL,
  dial: WebResourceDial = dialPublicResource,
  signal: AbortSignal = AbortSignal.timeout(WebResource.TimeoutMs),
) {
  const requested = url.href;
  let status: number | undefined;
  let mediaType: string | undefined;
  try {
    for (let redirects = 0; ; redirects += 1) {
      status = undefined;
      mediaType = undefined;
      const response = await connect(url, signal, dial);
      try {
        status = response.status;
        mediaType = response.headers[HttpHeader.ContentType];
        if (status && WebResource.RedirectStatuses.includes(status)) {
          if (redirects >= WebResource.Redirects) throw new Error(WebResourceMessage.RedirectLimit);
          if (!response.headers.location) throw new Error(WebResourceMessage.MissingLocation);
          url = publicResourceURL(new URL(response.headers.location, url).href);
          continue;
        }
        if (!status || status < 200 || status >= 300)
          throw new Error(WebResourceMessage.FailedStatus);
        if (
          response.headers[WebResource.ContentEncoding] &&
          response.headers[WebResource.ContentEncoding] !== WebResource.Identity
        )
          throw new Error(WebResourceMessage.UnsupportedEncoding);
        const chunks: Buffer[] = [];
        let bytes = 0;
        for await (const chunk of response.body) {
          const buffer = Buffer.from(chunk);
          bytes += buffer.length;
          if (bytes > WebResource.Bytes) throw new Error(WebResourceMessage.ByteLimit);
          chunks.push(buffer);
        }
        const body = Buffer.concat(chunks, bytes);
        const media =
          mediaType?.split(WebResource.MediaTypeDelimiter)[0]?.trim().toLowerCase() ??
          TextSymbol.Empty;
        const textual =
          media.startsWith(WebResource.TextTypePrefix) ||
          media === LocalServer.Json ||
          media.endsWith(WebResource.JsonTypeSuffix);
        return {
          requested,
          final_url: url.href,
          status,
          media_type: mediaType,
          retrieved_at: Date.now(),
          digest: createHash(HashAlgorithm.Sha256).update(body).digest(FileEncoding.Hex),
          text: textual ? body.toString(FileEncoding.Utf8) : null,
          extraction_error: textual ? null : WebResourceMessage.UnsupportedExtraction,
        };
      } finally {
        response.close();
      }
    }
  } catch (error) {
    return {
      requested,
      final_url: url.href,
      status,
      media_type: mediaType,
      retrieved_at: Date.now(),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
