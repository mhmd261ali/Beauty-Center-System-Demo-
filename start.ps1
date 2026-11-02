$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$usingDocker = $false
$docker = Get-Command docker -ErrorAction SilentlyContinue
if ($docker) {
  $previous = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  docker info --format "{{.ServerVersion}}" 1>$null 2>$null
  if ($LASTEXITCODE -eq 0) {
    docker compose up -d
    if ($LASTEXITCODE -eq 0) { $usingDocker = $true }
  }
  $ErrorActionPreference = $previous
}

if (-not $usingDocker) {
  $bin = "C:\Program Files\PostgreSQL\17\bin"
  $pgCtl = Join-Path $bin "pg_ctl.exe"
  $initdb = Join-Path $bin "initdb.exe"
  $psql = Join-Path $bin "psql.exe"
  $data = Join-Path $PSScriptRoot "backend\.pgdata"
  if (-not (Test-Path $pgCtl)) {
    Write-Host "Start Docker Desktop, or install PostgreSQL 17, then run this again."
    exit 1
  }
  if (-not (Test-Path $data)) {
    & $initdb -D $data -U clinic --auth-local=trust --auth-host=trust --encoding=UTF8 --locale=C
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  }
  & $pgCtl -D $data status 1>$null 2>$null
  if ($LASTEXITCODE -ne 0) {
    & $pgCtl -D $data -l (Join-Path $data "server.log") start
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  }
  $exists = & $psql -h localhost -p 5432 -U clinic -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = 'clinic'"
  if (($exists | Out-String).Trim() -ne "1") {
    & $psql -h localhost -p 5432 -U clinic -d postgres -c "CREATE DATABASE clinic;"
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  }
  Write-Host "Postgres is running on localhost:5432"
}

if (-not (Test-Path "node_modules")) { npm install }
if (-not (Test-Path "backend\node_modules")) { npm install --prefix backend }
if (-not (Test-Path "mobile\node_modules")) { npm install --prefix mobile }

Write-Host ""
Write-Host "Halden is starting."
Write-Host "  Windows: press w in the Expo window"
Write-Host "  Android: install Expo Go and scan the QR code"
Write-Host "  iPhone:  install Expo Go and scan the QR code with the camera"
Write-Host "Phone and the Windows browser both need this computer's API on port 4000."
Write-Host "If a phone cannot connect, allow port 4000 through the Windows firewall."
Write-Host ""
npm start
