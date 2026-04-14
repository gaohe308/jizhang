$backendRoot = "e:\w\wx_project\jizhang\backend"
$runtimeDir = Join-Path $backendRoot "runtime"
$outLog = Join-Path $runtimeDir "backend.out.log"
$errLog = Join-Path $runtimeDir "backend.err.log"

New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null

$existing = Get-CimInstance Win32_Process | Where-Object {
  $_.CommandLine -like "*e:\\w\\wx_project\\jizhang\\backend\\dist\\main*"
}

if ($existing) {
  Write-Output "Backend is already running."
  exit 0
}

Push-Location $backendRoot
try {
  npm.cmd run build
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }

  Start-Process -FilePath node.exe `
    -ArgumentList "dist/main" `
    -WorkingDirectory $backendRoot `
    -RedirectStandardOutput $outLog `
    -RedirectStandardError $errLog `
    -WindowStyle Hidden

  Start-Sleep -Seconds 3

  try {
    $health = Invoke-WebRequest -Uri "http://127.0.0.1:3000/api/health" -UseBasicParsing -TimeoutSec 10
    Write-Output $health.Content
  } catch {
    Write-Output "Backend started, but health check did not respond yet."
  }
} finally {
  Pop-Location
}
