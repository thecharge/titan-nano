import { ErrorCode, IoLimit, NativeToolRedirect } from "@titan/constants";
import { TitanError } from "@titan/errors";
import { NativeToolBridgeMessage } from "@titan/messages";
import { readBytes } from "@titan/streams";

export function nativeToolFetch(timeout: number) {
  return async (url: string | URL, init?: RequestInit): Promise<Response> => {
    const deadline = AbortSignal.timeout(timeout);
    try {
      const response = await fetch(url, {
        ...init,
        redirect: NativeToolRedirect,
        signal: init?.signal ? AbortSignal.any([init.signal, deadline]) : deadline,
      });
      if (!response.body) return response;
      const bytes = await readBytes(response.body, IoLimit.ResponseBytes);
      return new Response(Uint8Array.from(bytes), {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    } catch {
      throw new TitanError(ErrorCode.ServerUnavailable, NativeToolBridgeMessage.Startup);
    }
  };
}
