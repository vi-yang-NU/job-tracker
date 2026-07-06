import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

/**
 * Windows installer served at https://your-deployment/install.ps1
 *
 * The cloned commit is pinned to VERCEL_GIT_COMMIT_SHA unless overridden with
 * `?ref=SHA`. The installer clones the public repo, installs deps, builds the
 * agent, and registers a scheduled task that runs every 3 hours.
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
  const sha = createHash("sha256").update(body).digest("hex").slice(0, 16);
  const final = body.replace("__SCRIPT_SHA256__", sha);
  return scriptResponse(final);
}

function scriptResponse(body: string) {
  return new NextResponse(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function misconfiguredScript() {
  return `Write-Error "jobtracker: this deployment is missing JOBTRACKER_REPO_URL."
Write-Error "  The site operator must set this env var to the public Git URL of the agent source."
exit 1
`;
}

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
  return `# PowerShell installer for jobtracker on Windows
$ErrorActionPreference = "Stop"

$apiBase = "${origin}"
$repo = "${repo}"
$branch = "${branch}"
$ref = "${ref}"
$scriptSha = "__SCRIPT_SHA256__"
$installDir = if ($env:JOBTRACKER_HOME) { $env:JOBTRACKER_HOME } else { Join-Path $env:USERPROFILE ".jobtracker" }
$repoDir = Join-Path $installDir "repo"
$agentDir = Join-Path $repoDir "agent"
$tokenFile = Join-Path $agentDir ".token"
$envFile = Join-Path $agentDir ".env"
$taskName = "jobtracker-agent"

Write-Host "jobtracker installer"
Write-Host "  repo:        $repo"
Write-Host "  pinned ref:  $ref"
Write-Host "  script sha:  $scriptSha"
Write-Host "  install to:  $installDir"
Write-Host ""

foreach ($cmd in @("git", "npm")) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
    throw "Missing dependency: $cmd"
  }
}

New-Item -ItemType Directory -Force -Path $installDir | Out-Null

if (Test-Path $repoDir) {
  git -C $repoDir fetch --depth 1 origin $ref | Out-Null
  git -C $repoDir checkout --force $ref 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) {
    git -C $repoDir reset --hard "origin/$branch" | Out-Null
  }
} else {
  git clone --depth 50 --branch $branch $repo $repoDir | Out-Null
  git -C $repoDir checkout --force $ref 2>$null | Out-Null
}

$actualSha = git -C $repoDir rev-parse HEAD
Write-Host "Checked out: $actualSha"

Push-Location $repoDir
try {
  Write-Host "Installing dependencies..."
  npm install --silent | Out-Null
  Write-Host "Building agent..."
  npm run build:agent --silent | Out-Null
} finally {
  Pop-Location
}

if (-not (Test-Path $tokenFile)) {
  $token = $env:JOBTRACKER_TOKEN
  if (-not $token) {
    $token = Read-Host "Paste your agent token (from $apiBase/agent)"
  }
  if (-not $token) {
    throw "No agent token available. Set JOBTRACKER_TOKEN and rerun."
  }
  Set-Content -Path $tokenFile -Value $token -NoNewline
}

$imessageTo = $env:JOBTRACKER_IMESSAGE_TO
$envContent = @(
  "JOBTRACKER_API=$apiBase"
  "JOBTRACKER_TOKEN_FILE=$tokenFile"
  if ($imessageTo) { "JOBTRACKER_IMESSAGE_TO=$imessageTo" } else { "# JOBTRACKER_IMESSAGE_TO=+15555550123  # macOS only" }
  "# JOBTRACKER_SCRAPY_PYTHON=$([System.IO.Path]::Combine($env:LocalAppData, 'Programs', 'Python', 'Python314', 'python.exe'))"
) -join [Environment]::NewLine
Set-Content -Path $envFile -Value $envContent

$agentCmd = Join-Path $agentDir "jobtracker-agent.cmd"
$node = (Get-Command node).Source
$agentJs = Join-Path $agentDir "dist\index.js"
@"
@echo off
cd /d "$agentDir"
"$node" "$agentJs" tick
"@ | Set-Content -Path $agentCmd -NoNewline

$action = New-ScheduledTaskAction -Execute $agentCmd
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1)
$trigger.Repetition = (New-ScheduledTaskRepetitionSettings -Interval (New-TimeSpan -Hours 3) -Duration (New-TimeSpan -Days 3650))
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -WakeToRun -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
$task = New-ScheduledTask -Action $action -Trigger $trigger -Settings $settings -Principal $principal

Register-ScheduledTask -TaskName $taskName -InputObject $task -Force | Out-Null
Start-ScheduledTask -TaskName $taskName

Push-Location $agentDir
try {
  & $node $agentJs welcome | Out-Null
} finally {
  Pop-Location
}

Write-Host ""
Write-Host "✓ Installed at commit $actualSha"
Write-Host "  Run now:     Start-ScheduledTask -TaskName $taskName"
Write-Host "  Stop:        Stop-ScheduledTask -TaskName $taskName"
Write-Host "  Uninstall:   Unregister-ScheduledTask -TaskName $taskName -Confirm:$false; Remove-Item -Recurse -Force \"$installDir\""
`;
}