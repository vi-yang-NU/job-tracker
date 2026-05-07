import "dotenv/config";
import { readFileSync } from "node:fs";

export interface Config {
  apiBase: string;
  token: string;
}

export function loadConfig(): Config {
  const apiBase = process.env.JOBTRACKER_API ?? "http://localhost:3000";
  const tokenFile = process.env.JOBTRACKER_TOKEN_FILE;
  const inlineToken = process.env.JOBTRACKER_TOKEN;
  let token = inlineToken;
  if (!token && tokenFile) {
    try {
      token = readFileSync(tokenFile, "utf8").trim();
    } catch {
      // fall through
    }
  }
  if (!token) {
    throw new Error(
      "no agent token — set JOBTRACKER_TOKEN or write a token to JOBTRACKER_TOKEN_FILE"
    );
  }
  return { apiBase, token };
}
