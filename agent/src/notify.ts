import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

/** Native macOS notification (top-right banner). */
export async function macNotify(title: string, message: string): Promise<void> {
  if (process.platform !== "darwin") return;
  const safeTitle = escapeForOsa(title);
  const safeMsg = escapeForOsa(message);
  await exec("osascript", [
    "-e",
    `display notification "${safeMsg}" with title "${safeTitle}"`,
  ]).catch((err) => {
    console.error(`[notify] macNotify failed: ${(err as Error).message}`);
  });
}

export interface IMessageResult {
  ok: boolean;
  reason?: string;
}

/**
 * Send an iMessage via Messages.app + AppleScript.
 *
 * Requirements:
 *   - macOS, Messages.app signed in to your Apple ID.
 *   - The first call from a new binary triggers macOS's "App wants to control
 *     Messages.app" prompt; the user must approve it (System Settings →
 *     Privacy & Security → Automation). After approval, launchd runs work too.
 */
export async function iMessage(message: string, to?: string): Promise<IMessageResult> {
  if (process.platform !== "darwin") {
    return { ok: false, reason: "not on macOS" };
  }
  if (!to) {
    return { ok: false, reason: "JOBTRACKER_IMESSAGE_TO not set" };
  }
  const script = `
    tell application "Messages"
      set targetService to 1st service whose service type = iMessage
      set targetBuddy to buddy "${to}" of targetService
      send "${escapeForOsa(message)}" to targetBuddy
    end tell
  `;
  try {
    await exec("osascript", ["-e", script]);
    return { ok: true };
  } catch (err) {
    const reason = (err as Error).message;
    console.error(`[notify] iMessage to ${to} failed: ${reason}`);
    return { ok: false, reason };
  }
}

function escapeForOsa(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ");
}
