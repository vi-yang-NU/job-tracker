import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

/** Native macOS notification (top-right banner). Always available. */
export async function macNotify(title: string, message: string): Promise<void> {
  if (process.platform !== "darwin") return;
  const safeTitle = escapeForOsa(title);
  const safeMsg = escapeForOsa(message);
  await exec("osascript", [
    "-e",
    `display notification "${safeMsg}" with title "${safeTitle}"`,
  ]).catch(() => {
    /* user may have notifications disabled */
  });
}

/**
 * Send an iMessage to your own number / a specified buddy.
 * Requires Messages.app to be signed in.
 * If `to` is omitted, falls back to a notification.
 */
export async function iMessage(message: string, to?: string): Promise<boolean> {
  if (process.platform !== "darwin") return false;
  if (!to) return false;
  const script = `
    tell application "Messages"
      set targetService to 1st service whose service type = iMessage
      set targetBuddy to buddy "${to}" of targetService
      send "${escapeForOsa(message)}" to targetBuddy
    end tell
  `;
  try {
    await exec("osascript", ["-e", script]);
    return true;
  } catch {
    return false;
  }
}

function escapeForOsa(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ");
}
