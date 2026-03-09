# STRIVE-EV Auto Commit + Deploy Watcher
# - Watches strive-ev/ for changes
# - Auto git commit + push  ->  Vercel auto-deploys
# - Triggers Render deploy via API  (needs RENDER_API_KEY in .secrets)

$REPO_ROOT    = Split-Path $PSScriptRoot -Parent
$SECRETS_FILE = Join-Path (Split-Path $REPO_ROOT -Parent) ".secrets"

function Write-Banner([string]$msg, [string]$col="Cyan") {
    $ts = Get-Date -Format "HH:mm:ss"
    Write-Host ""
    Write-Host "[ $ts ]  $msg" -ForegroundColor $col
}

function Load-Secrets {
    $s = @{ RENDER_API_KEY=""; RENDER_SERVICE_ID="" }
    if (Test-Path $SECRETS_FILE) {
        foreach ($line in (Get-Content $SECRETS_FILE)) {
            if ($line -match "^([^#=]+)=(.*)$") {
                $s[$Matches[1].Trim()] = $Matches[2].Trim()
            }
        }
    }
    return $s
}

function Save-ServiceId([string]$id) {
    if (-not (Test-Path $SECRETS_FILE)) { return }
    $lines = Get-Content $SECRETS_FILE
    $out   = foreach ($line in $lines) {
        if ($line -match "^RENDER_SERVICE_ID=") { "RENDER_SERVICE_ID=$id" }
        else { $line }
    }
    $out | Set-Content $SECRETS_FILE -Encoding UTF8
    Write-Banner "Render service ID saved: $id" "Green"
}

function Get-RenderServiceId([string]$apiKey) {
    try {
        $h    = @{ Authorization="Bearer $apiKey"; Accept="application/json" }
        $resp = Invoke-RestMethod "https://api.render.com/v1/services?type=web&limit=20" -Headers $h -Method GET
        $svc  = $resp | Where-Object { $_.service.name -eq "strive-ev-backend" } | Select-Object -First 1
        if (-not $svc) { $svc = $resp | Select-Object -First 1 }
        return $svc.service.id
    } catch {
        Write-Banner "Could not fetch Render services: $_" "Yellow"
        return $null
    }
}

function Invoke-RenderDeploy([string]$apiKey, [string]$serviceId) {
    $placeholder = "rnd_PASTE_YOUR_KEY_HERE"
    if ((-not $apiKey) -or ($apiKey -eq $placeholder)) { return }
    if (-not $serviceId) { return }
    try {
        $h = @{ Authorization="Bearer $apiKey"; Accept="application/json" }
        Invoke-RestMethod "https://api.render.com/v1/services/$serviceId/deploys" `
            -Headers $h -Method POST -Body "{}" -ContentType "application/json" | Out-Null
        Write-Banner "Render deploy triggered  OK" "Green"
    } catch {
        Write-Banner "Render deploy failed: $_" "Yellow"
    }
}

function Invoke-CommitAndPush {
    Set-Location $REPO_ROOT
    $status = git status --porcelain 2>&1
    if (-not $status) { return $false }

    $changed = ($status -replace "^\s*\S+\s+","").Trim() -join ", "
    if ($changed.Length -gt 80) { $changed = $changed.Substring(0,77) + "..." }
    $ts  = Get-Date -Format "yyyy-MM-dd HH:mm"
    $msg = "auto: $ts - $changed"

    Write-Banner "Committing: $msg" "Cyan"
    git add -A | Out-Null
    git commit -m $msg 2>&1 | ForEach-Object { Write-Host "  $_" }
    git push origin master 2>&1 | ForEach-Object { Write-Host "  $_" }
    Write-Banner "Pushed -> Vercel deploy started  OK" "Green"
    return $true
}

# --- Startup ---
Clear-Host
Write-Host "============================================" -ForegroundColor DarkCyan
Write-Host "  STRIVE-EV  Auto Commit + Deploy Watcher"  -ForegroundColor Cyan
Write-Host "  Repo: $REPO_ROOT"                         -ForegroundColor Gray
Write-Host "============================================" -ForegroundColor DarkCyan

$secrets = Load-Secrets
$placeholder = "rnd_PASTE_YOUR_KEY_HERE"
$hasKey = $secrets.RENDER_API_KEY -and ($secrets.RENDER_API_KEY -ne $placeholder)

if ($hasKey -and (-not $secrets.RENDER_SERVICE_ID)) {
    Write-Banner "Fetching Render service ID..." "Yellow"
    $id = Get-RenderServiceId $secrets.RENDER_API_KEY
    if ($id) { Save-ServiceId $id; $secrets.RENDER_SERVICE_ID = $id }
}

if ($hasKey) {
    Write-Host "  Render : service=$($secrets.RENDER_SERVICE_ID)  OK" -ForegroundColor Green
} else {
    Write-Host "  Render : paste API key in .secrets to enable" -ForegroundColor Yellow
}
Write-Host "  Vercel : auto-deploys from every GitHub push  OK" -ForegroundColor Green
Write-Host ""

# --- Watcher ---
$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path                  = $REPO_ROOT
$watcher.IncludeSubdirectories = $true
$watcher.NotifyFilter          = [System.IO.NotifyFilters]::LastWrite -bor `
                                  [System.IO.NotifyFilters]::FileName  -bor `
                                  [System.IO.NotifyFilters]::DirectoryName
$watcher.Filter                = "*"
$watcher.EnableRaisingEvents   = $false

$SKIP_PATTERNS = @(".next","node_modules",".git","__pycache__",".vscode")
$DEBOUNCE_SEC  = 8
$pendingCommit = $false
$lastChange    = [datetime]::MinValue

Write-Banner "Watching for changes  (Ctrl+C to stop)" "Cyan"

while ($true) {
    $ev = $watcher.WaitForChanged([System.IO.WatcherChangeTypes]::All, 500)

    if (-not $ev.TimedOut) {
        $name = $ev.Name
        $skip = $false
        foreach ($pat in $SKIP_PATTERNS) {
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
            $pushed = Invoke-CommitAndPush
            if ($pushed) {
                $secrets = Load-Secrets
                Invoke-RenderDeploy $secrets.RENDER_API_KEY $secrets.RENDER_SERVICE_ID
            }
        } else {
            $rem = [int]($DEBOUNCE_SEC - $elapsed.TotalSeconds)
            Write-Host "`r  Committing in ${rem}s...   " -NoNewline -ForegroundColor DarkYellow
        }
    }
}
