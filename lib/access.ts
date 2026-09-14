// Public-demo access control.
//
// When DEMO_ACCESS_KEY is set, anonymous visitors can browse and chat with
// already-analyzed repos, but only the owner (who unlocked with the key) can
// add repos or start an analysis — those are the expensive operations.
// Unset the variable to run fully open, e.g. locally.

import { createHash, randomUUID, timingSafeEqual } from "crypto";

export const ACCESS_COOKIE = "rm_access";
export const VISITOR_COOKIE = "rm_vid";
const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 30;

function sha256(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

function cookieAttrs(): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE_SEC}${secure}`;
}

export function isDemoLocked(): boolean {
  return Boolean(process.env.DEMO_ACCESS_KEY);
}

export function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

/** Constant-time comparison of a submitted key against DEMO_ACCESS_KEY. */
export function checkAccessKey(candidate: string): boolean {
  const key = process.env.DEMO_ACCESS_KEY;
  if (!key) return true;
  return timingSafeEqual(sha256(candidate), sha256(key));
}

// The cookie carries a hash of the key, never the key itself.
function accessToken(): string {
  return sha256(`repomind:${process.env.DEMO_ACCESS_KEY ?? ""}`).toString("hex");
}

export function hasAccess(req: Request): boolean {
  if (!isDemoLocked()) return true;
  const cookie = readCookie(req, ACCESS_COOKIE);
  if (!cookie) return false;
  const expected = accessToken();
  return (
    cookie.length === expected.length &&
    timingSafeEqual(Buffer.from(cookie), Buffer.from(expected))
  );
}

export function accessCookieHeader(): string {
  return `${ACCESS_COOKIE}=${accessToken()}; ${cookieAttrs()}`;
}

export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

/**
 * Anonymous per-browser id, so chat memory isn't shared between demo
 * visitors. Returns a Set-Cookie value when a new id had to be minted.
 */
export function visitorId(req: Request): { id: string; setCookie: string | null } {
  const existing = readCookie(req, VISITOR_COOKIE);
  if (existing && /^[0-9a-f-]{36}$/.test(existing)) {
    return { id: existing, setCookie: null };
  }
  const id = randomUUID();
  return { id, setCookie: `${VISITOR_COOKIE}=${id}; ${cookieAttrs()}` };
}
