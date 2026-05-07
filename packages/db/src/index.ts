import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

export * from "./schema";
export { schema };

let cachedClient: Client | undefined;
let cachedDb: ReturnType<typeof drizzle<typeof schema>> | undefined;

export function getDb(opts?: { url?: string; authToken?: string }) {
  const url = opts?.url ?? process.env.TURSO_DATABASE_URL;
  const authToken = opts?.authToken ?? process.env.TURSO_AUTH_TOKEN;
  if (!url) throw new Error("TURSO_DATABASE_URL is not set");
  if (!cachedClient) {
    cachedClient = createClient({ url, authToken });
    cachedDb = drizzle(cachedClient, { schema });
  }
  return cachedDb!;
}

export type DB = ReturnType<typeof getDb>;
