import { DashboardSession, ErrorCode, FileEncoding } from "@titan/constants";
import { hash } from "@titan/core";
import { TitanError } from "@titan/errors";
import { DashboardMessage } from "@titan/messages";

function random(bytes: number): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(bytes))).toString(FileEncoding.Hex);
}

export class DashboardSessions {
  private readonly codes = new Map<string, number>();
  private readonly sessions = new Set<string>();
  constructor(private readonly clock: () => number = Date.now) {}

  mint(): string {
    const now = this.clock();
    for (const [key, expires] of this.codes) if (expires <= now) this.codes.delete(key);
    if (this.codes.size >= DashboardSession.MaximumCodes)
      throw new TitanError(ErrorCode.Arguments, DashboardMessage.Capacity);
    const code = random(DashboardSession.CodeBytes);
    this.codes.set(hash(code), now + DashboardSession.CodeLifetimeMilliseconds);
    return code;
  }

  consume(code: string | null): string | undefined {
    if (code === null) return undefined;
    const key = hash(code);
    const expires = this.codes.get(key);
    this.codes.delete(key);
    if (expires === undefined || expires <= this.clock()) return undefined;
    if (this.sessions.size >= DashboardSession.MaximumSessions) {
      const oldest = this.sessions.values().next().value;
      if (oldest !== undefined) this.sessions.delete(oldest);
    }
    const session = random(DashboardSession.SessionBytes);
    this.sessions.add(hash(session));
    return session;
  }

  valid(session: string | undefined): boolean {
    return session !== undefined && this.sessions.has(hash(session));
  }
}

export function sessionFrom(cookie: string | null): string | undefined {
  if (cookie === null) return undefined;
  for (const part of cookie.split(DashboardSession.CookieSeparator)) {
    const at = part.indexOf(DashboardSession.CookieAssignment);
    if (at > 0 && part.slice(0, at) === DashboardSession.CookieName) return part.slice(at + 1);
  }
  return undefined;
}
