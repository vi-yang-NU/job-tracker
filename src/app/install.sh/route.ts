import { NextResponse } from "next/server";

/**
 * Public installer served at https://your-deployment/install.sh
 *
 * Operators must set JOBTRACKER_REPO_URL in their Vercel env to point at the
 * repo end-users should clone. We intentionally have no default — it would
 * tie the script to whoever first wrote it.
 */
export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const repo = process.env.JOBTRACKER_REPO_URL;
  const branch = process.env.JOBTRACKER_REPO_BRANCH ?? "main";
  if (!repo) {
    // Return 200 (not 500) so `curl -fsSL ... | bash` actually runs the script
    // and prints the explanation. The script itself exits 1.
    return new NextResponse(misconfiguredScript(), {
      headers: {
        "content-type": "text/x-shellscript; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }
  const script = renderInstaller(origin, repo, branch);
  return new NextResponse(script, {
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

function renderInstaller(origin: string, repo: string, branch: string) {
  return `#!/usr/bin/env bash
set -euo pipefail

API_BASE="${origin}"
REPO="${repo}"
BRANCH="${branch}"
INSTALL_DIR="\${JOBTRACKER_HOME:-$HOME/.jobtracker}"
PLIST="$HOME/Library/LaunchAgents/com.jobtracker.agent.plist"

echo "Installing jobtracker agent to $INSTALL_DIR"

for cmd in node npm git; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing dependency: $cmd. Install with: brew install $cmd" >&2
    exit 1
  fi
done

if [ -d "$INSTALL_DIR/.git" ]; then
  git -C "$INSTALL_DIR" fetch origin "$BRANCH"
  git -C "$INSTALL_DIR" reset --hard "origin/$BRANCH"
else
  rm -rf "$INSTALL_DIR"
  git clone --depth 1 --branch "$BRANCH" "$REPO" "$INSTALL_DIR"
fi

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
# Optional: set this to your phone number / Apple ID to receive iMessages.
# JOBTRACKER_IMESSAGE_TO=+15555550123
EOF

# Install Playwright browser (Chromium) for sites that need a real browser.
( cd "$INSTALL_DIR/agent" && npx playwright install chromium >/dev/null 2>&1 ) || true

# launchd plist (every 3h + at login). macOS coalesces missed StartInterval
# firings while the laptop is asleep into a single RunAtLoad run on next wake.
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
echo "✓ Installed. Agent runs at login and every 3 hours while the laptop is awake."
echo "  Logs:        $INSTALL_DIR/agent.log"
echo "  Run now:     launchctl start com.jobtracker.agent"
echo "  Stop:        launchctl unload $PLIST"
echo "  Uninstall:   launchctl unload $PLIST && rm -rf $INSTALL_DIR $PLIST"
`;
}
