param(
  [string]$AppUrl = "http://localhost:3000",
  [int]$Port = 3000
)

$ErrorActionPreference = "Stop"

Write-Host "== Node.js App Bootstrap ==" -ForegroundColor Cyan
Write-Host "Working directory: $PWD"

# 1) Verify Node.js + npm
$nodeInstalled = $false
try {
  $nodeVersionRaw = (node -v).Trim()
  $nodeInstalled = $true
} catch {}

if (-not $nodeInstalled) {
  Write-Host "Node.js not found. Trying to install Node.js LTS via winget..." -ForegroundColor Yellow
  winget install OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements
  Write-Host "Node.js installed. Please close and reopen PowerShell, then re-run this script." -ForegroundColor Yellow
  exit 1
}

$nodeVersion = $nodeVersionRaw.TrimStart("v")
$major = [int]($nodeVersion.Split(".")[0])
if ($major -lt 20) {
  Write-Host "Node.js 20+ required. Found $nodeVersionRaw. Upgrading via winget..." -ForegroundColor Yellow
  winget upgrade OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements
  Write-Host "Node.js upgraded. Please close and reopen PowerShell, then re-run this script." -ForegroundColor Yellow
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
  @"
# Local development environment
# Add/override variables here if your app needs them
JWT_SECRET=local-dev-secret-change-me
"@ | Out-File -FilePath ".env.local" -Encoding utf8
}

# 4) Run optional setup scripts if present
if (Test-Path ".\scripts\seed-holidays.ts") {
  Write-Host "Found scripts/seed-holidays.ts, seeding data..." -ForegroundColor Cyan
  npx tsx scripts/seed-holidays.ts
}

# 5) Install Playwright browser only if Playwright config exists
if (Test-Path ".\playwright.config.ts") {
  Write-Host "Playwright config found. Installing Chromium (optional for E2E)..." -ForegroundColor Cyan
  npx playwright install chromium
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
