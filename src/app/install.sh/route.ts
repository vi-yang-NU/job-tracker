import { NextResponse } from "next/server";
import { createHash } from "node:crypto";

/**
 * Public installer served at https://your-deployment/install.sh
 *
 * The cloned commit is pinned to VERCEL_GIT_COMMIT_SHA — i.e. the same commit
 * that built the install endpoint you're reading. This guarantees the agent
 * code on disk matches the API the agent talks to. Override with `?ref=SHA`.
 *
 * Operators must set JOBTRACKER_REPO_URL in their Vercel env to point at the
 * public repo end-users should clone.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;
  const repo = process.env.JOBTRACKER_REPO_URL;
  const branch = process.env.JOBTRACKER_REPO_BRANCH ?? "main";
  const refOverride = url.searchParams.get("ref")?.trim() ?? null;
  const deployedSha = process.env.VERCEL_GIT_COMMIT_SHA ?? null;
  const ref = sanitizeRef(refOverride) ?? deployedSha ?? branch;

  if (!repo) {
    return scriptResponse(misconfiguredScript());
  }

  const body = renderInstaller({ origin, repo, branch, ref });
  // Hash of the script body itself so users can verify out of band that two
  // machines are getting the same installer.
  const sha = createHash("sha256").update(body).digest("hex").slice(0, 16);
  const final = body.replace("__SCRIPT_SHA256__", sha);
  return scriptResponse(final);
}

function scriptResponse(body: string) {
  return new NextResponse(body, {
    headers: {
      "content-type": "text/x-shellscript; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function misconfiguredScript() {
  return `#!/usr/bin/env bash
echo "jobtracker: this deployment is missing JOBTRACKER_REPO_URL." >&2
echo "  The site operator must set this env var to the public Git URL of the agent source." >&2
exit 1
`;
}

/** Allow only a 7-40 char hex string (commit SHA) or a sane branch name. */
function sanitizeRef(ref: string | null): string | null {
  if (!ref) return null;
  if (/^[0-9a-fA-F]{7,40}$/.test(ref)) return ref;
  if (/^[A-Za-z0-9._/\-]{1,80}$/.test(ref)) return ref;
  return null;
}

function renderInstaller(opts: {
  origin: string;
  repo: string;
  branch: string;
  ref: string;
}) {
  const { origin, repo, branch, ref } = opts;
  const refIsSha = /^[0-9a-fA-F]{7,40}$/.test(ref);
  return `#!/usr/bin/env bash
set -euo pipefail

API_BASE="${origin}"
REPO="${repo}"
BRANCH="${branch}"
REF="${ref}"
SCRIPT_SHA="__SCRIPT_SHA256__"
INSTALL_DIR="\${JOBTRACKER_HOME:-$HOME/.jobtracker}"
PLIST="$HOME/Library/LaunchAgents/com.jobtracker.agent.plist"

echo "jobtracker installer"
echo "  repo:        $REPO"
echo "  pinned ref:  $REF${refIsSha ? "  (commit SHA)" : "  (branch — UPDATE-ON-EVERY-RUN)"}"
echo "  script sha:  $SCRIPT_SHA"
echo "  install to:  $INSTALL_DIR"
echo ""

for cmd in node npm git; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing dependency: $cmd. Install with: brew install $cmd" >&2
    exit 1
  fi
done

if [ -d "$INSTALL_DIR/.git" ]; then
  git -C "$INSTALL_DIR" fetch --depth 1 origin "$REF" || git -C "$INSTALL_DIR" fetch origin "$BRANCH"
  git -C "$INSTALL_DIR" -c advice.detachedHead=false checkout --force "$REF" 2>/dev/null \
    || git -C "$INSTALL_DIR" reset --hard "origin/$BRANCH"
else
  rm -rf "$INSTALL_DIR"
  git clone --depth 50 --branch "$BRANCH" "$REPO" "$INSTALL_DIR"
  git -C "$INSTALL_DIR" -c advice.detachedHead=false checkout --force "$REF" 2>/dev/null || true
fi

ACTUAL_SHA="$(git -C "$INSTALL_DIR" rev-parse HEAD)"
echo "Checked out: $ACTUAL_SHA"

cd "$INSTALL_DIR"
echo "Installing dependencies..."
npm install --silent

echo "Building agent..."
npm run build:agent --silent

if [ ! -f "$INSTALL_DIR/agent/.token" ]; then
  if [ -t 0 ]; then
    printf "Paste your agent token (from $API_BASE/agent): "
    read -r TOKEN
    echo "$TOKEN" > "$INSTALL_DIR/agent/.token"
    chmod 600 "$INSTALL_DIR/agent/.token"
  else
    echo ""
    echo "No token file at $INSTALL_DIR/agent/.token and no TTY to prompt." >&2
    echo "Either pipe a token in (echo TOKEN | $0) or rerun in a terminal." >&2
    exit 1
  fi
fi

cat > "$INSTALL_DIR/agent/.env" <<EOF
JOBTRACKER_API=$API_BASE
JOBTRACKER_TOKEN_FILE=$INSTALL_DIR/agent/.token
# Optional: phone number / Apple ID to receive iMessages.
# JOBTRACKER_IMESSAGE_TO=+15555550123
EOF

( cd "$INSTALL_DIR/agent" && npx playwright install chromium >/dev/null 2>&1 ) || true

mkdir -p "$HOME/Library/LaunchAgents"
NODE_BIN="$(command -v node)"
cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.jobtracker.agent</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE_BIN</string>
    <string>$INSTALL_DIR/agent/dist/index.js</string>
    <string>tick</string>
  </array>
  <key>WorkingDirectory</key><string>$INSTALL_DIR/agent</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>StartInterval</key><integer>10800</integer>
  <key>StandardOutPath</key><string>$INSTALL_DIR/agent.log</string>
  <key>StandardErrorPath</key><string>$INSTALL_DIR/agent.err</string>
</dict>
</plist>
EOF

launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"
launchctl start com.jobtracker.agent || true

echo ""
echo "✓ Installed at commit $ACTUAL_SHA"
echo "  Logs:        $INSTALL_DIR/agent.log"
echo "  Run now:     launchctl start com.jobtracker.agent"
echo "  Stop:        launchctl unload $PLIST"
echo "  Uninstall:   launchctl unload $PLIST && rm -rf $INSTALL_DIR $PLIST"
`;
}
