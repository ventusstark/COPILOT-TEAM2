param(
  [string]$AppUrl = "http://localhost:3000",
  [int]$Port = 3000
)

$ErrorActionPreference = "Stop"
$requiredNodeVersion = "v22.22.1"

Write-Host "== Node.js App Bootstrap ==" -ForegroundColor Cyan
Write-Host "Working directory: $PWD"

# 1) Ensure fnm is installed and use required Node.js version
$fnmInstalled = $false
if (Get-Command fnm -ErrorAction SilentlyContinue) {
  $fnmInstalled = $true
}

if (-not $fnmInstalled) {
  Write-Host "fnm not found. Installing fnm via winget..." -ForegroundColor Yellow
  winget install Schniz.fnm --silent --accept-package-agreements --accept-source-agreements
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to install fnm via winget." -ForegroundColor Red
    exit 1
  }
  if (-not (Get-Command fnm -ErrorAction SilentlyContinue)) {
    Write-Host "fnm installation complete, but this shell cannot see fnm yet. Please close and reopen PowerShell, then re-run this script." -ForegroundColor Yellow
    exit 1
  }
}

# Load fnm environment in this shell so fnm-managed node/npm become active.
fnm env --shell powershell | Out-String | Invoke-Expression

$installedVersions = (fnm list) -join "`n"
if ($installedVersions -notmatch [regex]::Escape($requiredNodeVersion)) {
  Write-Host "Installing Node.js $requiredNodeVersion via fnm..." -ForegroundColor Cyan
  fnm install $requiredNodeVersion
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to install Node.js $requiredNodeVersion via fnm." -ForegroundColor Red
    exit 1
  }
}

fnm use $requiredNodeVersion | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Failed to activate Node.js $requiredNodeVersion via fnm." -ForegroundColor Red
  exit 1
}

$nodeVersionRaw = (node -v).Trim()
if ($nodeVersionRaw -ne $requiredNodeVersion) {
  Write-Host "Expected Node.js $requiredNodeVersion but found $nodeVersionRaw. Please verify fnm setup and rerun." -ForegroundColor Red
  exit 1
}

Write-Host "Node version: $nodeVersionRaw" -ForegroundColor Green
Write-Host "npm version: $(npm -v)" -ForegroundColor Green

# 2) Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Cyan
npm install

# 3) Optional env file creation
if (-not (Test-Path ".env.local")) {
  Write-Host "No .env.local found. Creating a minimal local env file..." -ForegroundColor Yellow
  $jwtSecret = [Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
  @"
# Local development environment
# Add/override variables here if your app needs them
JWT_SECRET=$jwtSecret
"@ | Out-File -FilePath ".env.local" -Encoding utf8
}

# 4) Run optional setup scripts if present
if (Test-Path ".\scripts\seed-holidays.ts") {
  Write-Host "Found scripts/seed-holidays.ts, seeding data..." -ForegroundColor Cyan
  npx tsx scripts/seed-holidays.ts
}

# 6) Port check
$portInUse = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($portInUse) {
  Write-Host "Port $Port is in use. Stopping existing process..." -ForegroundColor Yellow
  $pids = $portInUse | Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($p in $pids) {
    try { Stop-Process -Id $p -Force } catch {}
  }
  Start-Sleep -Seconds 2
}

# 7) Start app
Write-Host "Starting app on $AppUrl ..." -ForegroundColor Cyan
npm run dev
