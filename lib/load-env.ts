// Loads .env.local / .env for standalone scripts (worker, seed).
//
// Must be the FIRST import in those files. ES imports are evaluated before
// the importing file's body runs, so calling dotenv inline after the other
// imports is too late for modules that read process.env at load time —
// lib/redis.ts would silently fall back to the local Redis default.

import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
