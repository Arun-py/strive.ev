# ══════════════════════════════════════════════════════════════════════════════
#  STRIVE-EV  ·  Auto Commit + Deploy Watcher
#  • Watches strive-ev/ for file changes
#  • Auto git commit + push  →  Vercel deploys automatically from GitHub
#  • Triggers Render deploy via API  (if RENDER_API_KEY is set in .secrets)
# ══════════════════════════════════════════════════════════════════════════════

$REPO_ROOT   = Split-Path $PSScriptRoot -Parent        # strive-ev/
$SECRETS_FILE = Join-Path (Split-Path $REPO_ROOT -Parent) ".secrets"

# ── Helpers ───────────────────────────────────────────────────────────────────
function Write-Banner([string]$msg, [string]$color = "Cyan") {
    Write-Host "`n[ $(Get-Date -f 'HH:mm:ss') ]  $msg" -ForegroundColor $color
}

function Load-Secrets {
    $s = @{ RENDER_API_KEY = ""; RENDER_SERVICE_ID = "" }
    if (Test-Path $SECRETS_FILE) {
        Get-Content $SECRETS_FILE | ForEach-Object {
            if ($_ -match '^\s*([^#=]+)=(.*)$') {
                $s[$Matches[1].Trim()] = $Matches[2].Trim()
            }
        }
    }
    return $s
}

function Save-ServiceId([string]$id) {
    if (-not (Test-Path $SECRETS_FILE)) { return }
    $lines = Get-Content $SECRETS_FILE
    $lines = $lines | ForEach-Object {
        if ($_ -match '^\s*RENDER_SERVICE_ID=') { "RENDER_SERVICE_ID=$id" }
        else { $_ }
    }
    $lines | Set-Content $SECRETS_FILE -Encoding UTF8
    Write-Banner "Render service ID saved to .secrets: $id" "Green"
}

function Get-RenderServiceId([string]$apiKey) {
    try {
        $headers = @{ Authorization = "Bearer $apiKey"; Accept = "application/json" }
        $resp = Invoke-RestMethod "https://api.render.com/v1/services?type=web&limit=20" `
                    -Headers $headers -Method GET -ErrorAction Stop
        # Pick the service whose name matches our render.yaml
        $svc = $resp | Where-Object { $_.service.name -eq "strive-ev-backend" } | Select-Object -First 1
        if (-not $svc) { $svc = $resp | Select-Object -First 1 }   # fallback: first service
        return $svc.service.id
    } catch {
        Write-Banner "Could not fetch Render services: $_" "Yellow"
        return $null
    }
}

function Trigger-RenderDeploy([string]$apiKey, [string]$serviceId) {
    if (-not $apiKey -or $apiKey -eq "rnd_PASTE_YOUR_KEY_HERE") { return }
    if (-not $serviceId) { return }
    try {
        $headers = @{ Authorization = "Bearer $apiKey"; Accept = "application/json" }
        Invoke-RestMethod "https://api.render.com/v1/services/$serviceId/deploys" `
            -Headers $headers -Method POST -Body "{}" -ContentType "application/json" `
            -ErrorAction Stop | Out-Null
        Write-Banner "Render deploy triggered  ✓" "Green"
    } catch {
        Write-Banner "Render deploy call failed: $_" "Yellow"
    }
}

function Commit-And-Push {
    Set-Location $REPO_ROOT
    $status = git status --porcelain 2>&1
    if (-not $status) { return $false }

    # Summarise changed files for the commit message
    $changed = ($status -replace '^\s*\S+\s+','').Trim() -join ", "
    if ($changed.Length -gt 80) { $changed = $changed.Substring(0,77) + "..." }
    $msg = "auto: $(Get-Date -f 'yyyy-MM-dd HH:mm')  |  $changed"

    Write-Banner "Committing: $msg" "Cyan"
    git add -A | Out-Null
    git commit -m $msg 2>&1 | ForEach-Object { Write-Host "  $_" }
    git push origin master 2>&1 | ForEach-Object { Write-Host "  $_" }
    Write-Banner "Pushed to GitHub  →  Vercel deploy started  ✓" "Green"
    return $true
}

# ── Startup ───────────────────────────────────────────────────────────────────
Clear-Host
Write-Host "══════════════════════════════════════════════" -ForegroundColor DarkCyan
Write-Host "  STRIVE-EV  Auto Commit + Deploy Watcher"      -ForegroundColor Cyan
Write-Host "  Watching: $REPO_ROOT"                         -ForegroundColor Gray
Write-Host "══════════════════════════════════════════════" -ForegroundColor DarkCyan

$secrets = Load-Secrets

# Auto-detect Render service ID if key is present but ID is missing
if ($secrets.RENDER_API_KEY -and
    $secrets.RENDER_API_KEY -ne "rnd_PASTE_YOUR_KEY_HERE" -and
    -not $secrets.RENDER_SERVICE_ID) {
    Write-Banner "Fetching Render service ID..." "Yellow"
    $id = Get-RenderServiceId $secrets.RENDER_API_KEY
    if ($id) {
        Save-ServiceId $id
        $secrets.RENDER_SERVICE_ID = $id
    }
}

if ($secrets.RENDER_API_KEY -and $secrets.RENDER_API_KEY -ne "rnd_PASTE_YOUR_KEY_HERE") {
    Write-Host "  Render  : service=$($secrets.RENDER_SERVICE_ID)  ✓" -ForegroundColor Green
} else {
    Write-Host "  Render  : no API key — paste key in .secrets to enable" -ForegroundColor Yellow
}
Write-Host "  Vercel  : auto-deploys from every GitHub push  ✓" -ForegroundColor Green
Write-Host ""

# ── File system watcher ───────────────────────────────────────────────────────
$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path                = $REPO_ROOT
$watcher.IncludeSubdirectories = $true
$watcher.NotifyFilter        = [System.IO.NotifyFilters]::LastWrite -bor
                               [System.IO.NotifyFilters]::FileName  -bor
                               [System.IO.NotifyFilters]::DirectoryName
$watcher.Filter              = "*"
$watcher.EnableRaisingEvents = $false

# Ignore these paths
$IGNORE_PATTERNS = @('.next', 'node_modules', '.git', '__pycache__', '.vscode')

$pendingCommit = $false
$lastChange    = [datetime]::MinValue
$DEBOUNCE_SEC  = 8   # wait 8 s of silence before committing

Write-Banner "Watching for changes  (Ctrl+C to stop)" "Cyan"

while ($true) {
    $event = $watcher.WaitForChanged([System.IO.WatcherChangeTypes]::All, 500)

    if (-not $event.TimedOut) {
        $name = $event.Name
        # Skip ignored paths
        $skip = $false
        foreach ($pat in $IGNORE_PATTERNS) {
            if ($name -like "*$pat*") { $skip = $true; break }
        }
        if (-not $skip) {
            Write-Host "  ~  $name" -ForegroundColor DarkGray
            $pendingCommit = $true
            $lastChange    = Get-Date
        }
    }

    if ($pendingCommit) {
        $elapsed = (Get-Date) - $lastChange
        if ($elapsed.TotalSeconds -ge $DEBOUNCE_SEC) {
            $pendingCommit = $false
            $pushed = Commit-And-Push
            if ($pushed) {
                # Reload secrets in case user just added API key
                $secrets = Load-Secrets
                Trigger-RenderDeploy $secrets.RENDER_API_KEY $secrets.RENDER_SERVICE_ID
            }
        } else {
            $remaining = [int]($DEBOUNCE_SEC - $elapsed.TotalSeconds)
            Write-Host "`r  Committing in ${remaining}s...   " -NoNewline -ForegroundColor DarkYellow
        }
    }
}
