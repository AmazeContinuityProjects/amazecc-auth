/**
 * Entry point for `@better-auth/cli generate`. The CLI runs in plain Node and
 * cannot reach D1, so it builds the auth instance against a throwaway
 * better-sqlite3 file — D1 speaks the same SQLite dialect, and the generated
 * DDL is applied to D1 via `wrangler d1 migrations apply`.
 */
import BetterSqlite3 from "better-sqlite3";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAuth } from "./auth";

const dir = mkdtempSync(join(tmpdir(), "amazecc-auth-schema-"));
const filename = join(dir, "schema.sqlite");

export const auth = createAuth(
  {
    BETTER_AUTH_SECRET:
      process.env.BETTER_AUTH_SECRET ??
      "cli-placeholder-secret-0123456789abcdef0123456789abcdef",
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? "https://auth.amazecc.com",
    DB: undefined as never,
  },
  new BetterSqlite3(filename)
);
export default auth;
