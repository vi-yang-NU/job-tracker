#!/usr/bin/env node
import { tick } from "./tick";
import { Api } from "./api";
import { loadConfig } from "./config";

// Show up as "jobtracker-agent" in macOS Activity Monitor / `ps`, not "node".
process.title = "jobtracker-agent";

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
    case "welcome": {
      const { macNotify, iMessage } = await import("./notify");
      const to = process.env.JOBTRACKER_IMESSAGE_TO;
      const cfg = loadConfig();
      const api = new Api(cfg);
      const me = await api.me().catch(() => null);
      const greeting = me?.name ? `Welcome, ${me.name}!` : "Welcome to jobtracker!";
      const body =
        "Agent installed. You'll get pings here when a tracked job opens, gets a deadline, or disappears.";
      await macNotify(greeting, body);
      if (to) await iMessage(`${greeting} ${body}`, to);
      console.log("[welcome] notification sent");
      break;
    }
    case "help":
    default:
      console.log(`jobtracker agent

Commands:
  tick     Fetch all tracked jobs, post results, then deliver inbox. (default)
  whoami   Verify the agent token.
  inbox    Print pending notifications without delivering them.
  welcome  Send a one-time welcome notification (used by the installer).

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
