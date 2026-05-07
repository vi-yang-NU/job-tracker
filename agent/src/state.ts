import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const INTERVAL_SEC = 10800;

function stateDir(): string {
  return process.env.JOBTRACKER_HOME ?? join(homedir(), ".jobtracker");
}

function statePath(): string {
  return join(stateDir(), "last-tick.json");
}

export interface TickState {
  ranAt: string;
  intervalSec: number;
}

export function writeLastTick(): void {
  const dir = stateDir();
  try {
    mkdirSync(dir, { recursive: true });
  } catch {
    // best-effort
  }
  const state: TickState = {
    ranAt: new Date().toISOString(),
    intervalSec: INTERVAL_SEC,
  };
  writeFileSync(statePath(), JSON.stringify(state, null, 2));
}

export function readLastTick(): TickState | null {
  try {
    const raw = readFileSync(statePath(), "utf8");
    return JSON.parse(raw) as TickState;
  } catch {
    return null;
  }
}
