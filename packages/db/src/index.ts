import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema.js";

export * from "./schema.js";
export { schema };

let cachedClient: Client | undefined;
let cachedDb: ReturnType<typeof drizzle<typeof schema>> | undefined;

/**
 * Returns a Drizzle DB instance. The libSQL client doesn't connect until a
 * query runs, so building Next.js routes (which evaluate modules during
 * `Collecting page data`) succeeds even when env vars aren't present yet.
 * The actual missing-env error surfaces at request time, not build time.
 */
export function getDb(opts?: { url?: string; authToken?: string }) {
  const url =
    opts?.url ?? process.env.TURSO_DATABASE_URL ?? "libsql://unset.invalid";
  const authToken = opts?.authToken ?? process.env.TURSO_AUTH_TOKEN;
  if (!cachedClient) {
    cachedClient = createClient({ url, authToken });
    cachedDb = drizzle(cachedClient, { schema });
  }
  return cachedDb!;
}

export type DB = ReturnType<typeof getDb>;
