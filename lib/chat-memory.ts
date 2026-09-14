// Redis-backed chat memory, per repo and per visitor. Stores the last N
// turns as a list of JSON-encoded ChatMessages. Scoping by visitor keeps
// one demo visitor's conversation from showing up for everyone else.
//
// All ops are best-effort: if Redis is unreachable, calls fall through to
// no-ops / empty results so the chat flow keeps working without infra.

import { getRedis, isRedisConfigured } from "./redis";
import type { ChatMessage } from "./types";

const MAX_TURNS = 20;
const KEY_TTL_SEC = 60 * 60 * 24 * 7; // 7 days

function key(repoId: string, visitorId: string): string {
  return `chat:${repoId}:${visitorId}:turns`;
}

export async function appendChatTurn(
  repoId: string,
  visitorId: string,
  msg: ChatMessage,
): Promise<void> {
  if (!isRedisConfigured()) return;
  try {
    const r = getRedis();
    const k = key(repoId, visitorId);
    await r.rpush(k, JSON.stringify(msg));
    // Keep only the most recent MAX_TURNS entries.
    await r.ltrim(k, -MAX_TURNS, -1);
    await r.expire(k, KEY_TTL_SEC);
  } catch {
    // memory is non-critical
  }
}

export async function loadChatHistory(repoId: string, visitorId: string): Promise<ChatMessage[]> {
  if (!isRedisConfigured()) return [];
  try {
    const raw = await getRedis().lrange(key(repoId, visitorId), 0, -1);
    return raw
      .map((s) => {
        try {
          return JSON.parse(s) as ChatMessage;
        } catch {
          return null;
        }
      })
      .filter((m): m is ChatMessage => !!m && (m.role === "user" || m.role === "assistant"));
  } catch {
    return [];
  }
}

export async function clearChatHistory(repoId: string, visitorId: string): Promise<void> {
  if (!isRedisConfigured()) return;
  try {
    await getRedis().del(key(repoId, visitorId));
  } catch {
    // ignore
  }
}
