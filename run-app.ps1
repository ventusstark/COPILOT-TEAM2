$ErrorActionPreference = "Stop"

if (-not (Test-Path ".\node_modules")) {
  Write-Host "Dependencies missing. Running npm install..." -ForegroundColor Yellow
  npm install
}

npm run dev
