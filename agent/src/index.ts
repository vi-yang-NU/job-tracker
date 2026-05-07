#!/usr/bin/env node
import { tick, sendDigest } from "./tick";
import { Api } from "./api";
import { loadConfig } from "./config";

async function main() {
  const cmd = process.argv[2] ?? "tick";
  const iMessageTo = process.env.JOBTRACKER_IMESSAGE_TO;

  switch (cmd) {
    case "tick":
      await tick({ iMessageTo });
      break;
    case "digest": {
      const cfg = loadConfig();
      const api = new Api(cfg);
      await sendDigest(api, iMessageTo);
      break;
    }
    case "whoami": {
      const cfg = loadConfig();
      const api = new Api(cfg);
      const me = await api.me();
      console.log(JSON.stringify(me, null, 2));
      break;
    }
    case "help":
    default:
      console.log(`jobtracker agent

Commands:
  tick     Fetch all tracked jobs and post results back. (default)
  digest   Send today's digest only (no fetch).
  whoami   Verify the agent token.

Env:
  JOBTRACKER_API           API base (default http://localhost:3000)
  JOBTRACKER_TOKEN         Bearer token (or use JOBTRACKER_TOKEN_FILE)
  JOBTRACKER_TOKEN_FILE    Path to a file holding the token
  JOBTRACKER_IMESSAGE_TO   Phone number / email for iMessage delivery
`);
      if (cmd !== "help") process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
