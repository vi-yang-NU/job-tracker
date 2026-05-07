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

# Ollama is optional but powers the resume / eligibility analysis. Warn if
# it's missing — install proceeds either way.
if ! command -v ollama >/dev/null 2>&1; then
  echo "ⓘ  Ollama not found — resume + eligibility analysis will be skipped."
  echo "   To enable:"
  echo "     brew install ollama"
  echo "     brew services start ollama"
  echo "     ollama pull llama3.1:8b        # generation"
  echo "     ollama pull nomic-embed-text   # embeddings (RAG)"
fi

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
  TOKEN="\${JOBTRACKER_TOKEN:-}"
  # When run as \`curl | bash\`, stdin is the pipe — read from the controlling
  # tty instead so the prompt actually works.
  if [ -z "$TOKEN" ] && [ -r /dev/tty ]; then
    printf "Paste your agent token (from %s/agent): " "$API_BASE" > /dev/tty
    read -r TOKEN < /dev/tty
  fi
  if [ -z "$TOKEN" ]; then
    echo "" >&2
    echo "No agent token available." >&2
    echo "  Headless install: JOBTRACKER_TOKEN=<token> bash <(curl -fsSL $API_BASE/install.sh)" >&2
    echo "  Or save the token to $INSTALL_DIR/agent/.token (chmod 600) then re-run." >&2
    exit 1
  fi
  echo "$TOKEN" > "$INSTALL_DIR/agent/.token"
  chmod 600 "$INSTALL_DIR/agent/.token"
fi

IMESSAGE_TO="\${JOBTRACKER_IMESSAGE_TO:-}"
if [ -z "$IMESSAGE_TO" ] && [ -r /dev/tty ]; then
  printf "Phone number / Apple ID for iMessage delivery (Enter to skip): " > /dev/tty
  read -r IMESSAGE_TO < /dev/tty
fi

{
  echo "JOBTRACKER_API=$API_BASE"
  echo "JOBTRACKER_TOKEN_FILE=$INSTALL_DIR/agent/.token"
  if [ -n "$IMESSAGE_TO" ]; then
    echo "JOBTRACKER_IMESSAGE_TO=$IMESSAGE_TO"
  else
    echo "# JOBTRACKER_IMESSAGE_TO=+15555550123  # add a number/email here to enable iMessages"
  fi
  echo "# Ollama settings (defaults assume \\\`brew install ollama\\\` is running locally)"
  echo "# OLLAMA_BASE=http://localhost:11434"
  echo "# OLLAMA_MODEL=llama3.1:8b              # generation"
  echo "# OLLAMA_EMBED_MODEL=nomic-embed-text   # embeddings (RAG)"
} > "$INSTALL_DIR/agent/.env"

( cd "$INSTALL_DIR/agent" && npx playwright install chromium >/dev/null 2>&1 ) || true

mkdir -p "$HOME/Library/LaunchAgents"
NODE_BIN="$(command -v node)"

# Wrapper script: lets us override argv[0] with \`exec -a\` so Activity Monitor
# and \`ps\` show "jobtracker-agent" instead of "node".
WRAPPER="$INSTALL_DIR/agent/jobtracker-agent"
cat > "$WRAPPER" <<EOF
#!/bin/bash
cd "$INSTALL_DIR/agent"
exec -a jobtracker-agent "$NODE_BIN" "$INSTALL_DIR/agent/dist/index.js" tick
EOF
chmod +x "$WRAPPER"

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.jobtracker.agent</string>
  <key>Program</key><string>$WRAPPER</string>
  <key>ProgramArguments</key>
  <array>
    <string>jobtracker-agent</string>
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

# One-time welcome ping so the user sees the agent works.
( cd "$INSTALL_DIR/agent" && JOBTRACKER_API="$API_BASE" JOBTRACKER_TOKEN_FILE="$INSTALL_DIR/agent/.token" "$NODE_BIN" "$INSTALL_DIR/agent/dist/index.js" welcome ) || true

echo ""
echo "✓ Installed at commit $ACTUAL_SHA"
echo "  You should see a welcome notification — that means the agent is wired up."
echo "  Logs:        $INSTALL_DIR/agent.log"
echo "  Run now:     launchctl start com.jobtracker.agent"
echo "  Stop:        launchctl unload $PLIST"
echo "  Uninstall:   launchctl unload $PLIST && rm -rf $INSTALL_DIR $PLIST"
`;
}
