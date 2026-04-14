$redisRoot = "e:\w\wx_project\jizhang\tools\redis"
$redisExe = Join-Path $redisRoot "bin\redis-server.exe"
$configPath = Join-Path $redisRoot "redis.local.conf"
$dataDir = Join-Path $redisRoot "data"

if (-not (Test-Path $redisExe)) {
  Write-Error "redis-server.exe not found: $redisExe"
  exit 1
}

New-Item -ItemType Directory -Force -Path $dataDir | Out-Null

$existing = Get-Process redis-server -ErrorAction SilentlyContinue
if ($existing) {
  Write-Output "Redis is already running."
  exit 0
}

Start-Process -FilePath $redisExe -ArgumentList $configPath -WindowStyle Hidden
Start-Sleep -Seconds 2

& (Join-Path $redisRoot "bin\redis-cli.exe") -h 127.0.0.1 -p 6379 ping
