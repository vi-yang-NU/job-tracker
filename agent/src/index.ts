#!/usr/bin/env node
import { tick } from "./tick.js";
import { Api } from "./api.js";
import { loadConfig } from "./config.js";
import { readLastTick } from "./state.js";

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
      const { macNotify, iMessage } = await import("./notify.js");
      const to = process.env.JOBTRACKER_IMESSAGE_TO;
      const cfg = loadConfig();
      const api = new Api(cfg);
      const me = await api.me().catch(() => null);
      const greeting = me?.name ? `Welcome, ${me.name}!` : "Welcome to jobtracker!";
      const body =
        "Agent installed. You'll get pings here when a tracked job opens, gets a deadline, or disappears.";
      await macNotify(greeting, body);
      console.log("[welcome] macOS notification sent");
      if (!to) {
        console.log(
          "[welcome] iMessage skipped — set JOBTRACKER_IMESSAGE_TO in ~/.jobtracker/agent/.env to enable"
        );
      } else {
        const r = await iMessage(`${greeting} ${body}`, to);
        if (r.ok) {
          console.log(`[welcome] iMessage sent to ${to}`);
        } else {
          console.log(`[welcome] iMessage to ${to} failed: ${r.reason}`);
          console.log(
            "  If macOS asked for Automation permission, approve in System Settings → Privacy & Security → Automation, then re-run \`node dist/index.js welcome\`."
          );
        }
      }
      break;
    }
    case "status": {
      const state = readLastTick();
      if (!state) {
        console.log("Agent has never completed a tick on this machine.");
        console.log("Trigger one now:  launchctl start com.jobtracker.agent");
        break;
      }
      const ranAt = new Date(state.ranAt);
      const nextAt = new Date(ranAt.getTime() + state.intervalSec * 1000);
      const sinceMs = Date.now() - ranAt.getTime();
      const untilMs = nextAt.getTime() - Date.now();
      console.log(`Last tick:  ${formatRelative(sinceMs)} ago  (${ranAt.toLocaleString()})`);
      if (untilMs <= 0) {
        console.log(
          `Next tick:  overdue by ${formatRelative(-untilMs)} — launchd will fire on next wake`
        );
      } else {
        console.log(`Next tick:  in ${formatRelative(untilMs)}  (${nextAt.toLocaleString()})`);
      }
      console.log(`Run now:    launchctl start com.jobtracker.agent`);
      break;
    }
    case "help":
    default:
      console.log(`jobtracker agent

Commands:
  tick     Fetch all tracked jobs, post results, then deliver inbox. (default)
  status   Show when the agent last ran and when it'll run next.
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

function formatRelative(ms: number): string {
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
