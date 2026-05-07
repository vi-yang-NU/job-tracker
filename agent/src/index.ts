#!/usr/bin/env node
import { tick } from "./tick";
import { Api } from "./api";
import { loadConfig } from "./config";

async function main() {
  const cmd = process.argv[2] ?? "tick";

  switch (cmd) {
    case "tick":
      await tick();
      break;
    case "whoami": {
      const cfg = loadConfig();
      const api = new Api(cfg);
      const me = await api.me();
      console.log(JSON.stringify(me, null, 2));
      break;
    }
    case "inbox": {
      const cfg = loadConfig();
      const api = new Api(cfg);
      const inbox = await api.inbox();
      console.log(JSON.stringify(inbox.notifications, null, 2));
      break;
    }
    case "help":
    default:
      console.log(`jobtracker agent

Commands:
  tick     Fetch all tracked jobs, post results, then deliver inbox. (default)
  whoami   Verify the agent token.
  inbox    Print pending notifications without delivering them.

Env:
  JOBTRACKER_API           API base
  JOBTRACKER_TOKEN         Bearer token (or use JOBTRACKER_TOKEN_FILE)
  JOBTRACKER_TOKEN_FILE    Path to a file holding the token
  JOBTRACKER_IMESSAGE_TO   Phone number / Apple ID for iMessage delivery
                           (omit to use macOS notifications only)
`);
      if (cmd !== "help") process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
