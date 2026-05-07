import { NextResponse } from "next/server";

/** Public installer served at https://your-app/install.sh */
export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const repo =
    process.env.JOBTRACKER_REPO_URL ?? "https://github.com/Vincent-Yang0134/job-tracker.git";
  const branch = process.env.JOBTRACKER_REPO_BRANCH ?? "main";
  const script = renderInstaller(origin, repo, branch);
  return new NextResponse(script, {
    headers: {
      "content-type": "text/x-shellscript; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function renderInstaller(origin: string, repo: string, branch: string) {
  return `#!/usr/bin/env bash
set -euo pipefail

API_BASE="${origin}"
REPO="${repo}"
BRANCH="${branch}"
INSTALL_DIR="$HOME/.jobtracker"
PLIST="$HOME/Library/LaunchAgents/com.jobtracker.agent.plist"

echo "Installing jobtracker agent to $INSTALL_DIR"

for cmd in node npm git; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing dependency: $cmd. Install with: brew install $cmd" >&2
    exit 1
  fi
done

# Fetch the agent source (sparse — only the bits we need)
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

# Token
if [ ! -f "$INSTALL_DIR/agent/.token" ]; then
  printf "Paste your agent token (from $API_BASE/agent): "
  read -r TOKEN
  echo "$TOKEN" > "$INSTALL_DIR/agent/.token"
  chmod 600 "$INSTALL_DIR/agent/.token"
fi

# Config
cat > "$INSTALL_DIR/agent/.env" <<EOF
JOBTRACKER_API=$API_BASE
JOBTRACKER_TOKEN_FILE=$INSTALL_DIR/agent/.token
EOF

# Install Playwright browser (Chromium) — needed for LinkedIn / Workday
npx --prefix "$INSTALL_DIR/agent" playwright install chromium --with-deps >/dev/null 2>&1 || \
  npx --prefix "$INSTALL_DIR/agent" playwright install chromium >/dev/null 2>&1 || true

# launchd plist
mkdir -p "$HOME/Library/LaunchAgents"
cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.jobtracker.agent</string>
  <key>ProgramArguments</key>
  <array>
    <string>$(command -v node)</string>
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
echo "✓ Installed. Agent runs at login + every 3 hours."
echo "  Logs:        $INSTALL_DIR/agent.log"
echo "  Run now:     launchctl start com.jobtracker.agent"
echo "  Stop:        launchctl unload $PLIST"
echo "  Uninstall:   launchctl unload $PLIST && rm -rf $INSTALL_DIR $PLIST"
`;
}
