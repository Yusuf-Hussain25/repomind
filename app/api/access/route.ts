import { NextResponse } from "next/server";
import {
  accessCookieHeader,
  checkAccessKey,
  clientIp,
  isDemoLocked,
} from "@/lib/access";
import { hitLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

/** Owner unlock: exchanges DEMO_ACCESS_KEY for an HttpOnly access cookie. */
export async function POST(req: Request) {
  if (!isDemoLocked()) return NextResponse.json({ ok: true });

  const attempts = await hitLimit(`unlock:${clientIp(req)}`, 5, 15 * 60);
  if (!attempts.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(attempts.retryAfterSec) } },
    );
  }

  const body = await req.json().catch(() => null);
  if (typeof body?.key !== "string" || !checkAccessKey(body.key)) {
    return NextResponse.json({ error: "Wrong access key" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.headers.append("Set-Cookie", accessCookieHeader());
  return res;
}
