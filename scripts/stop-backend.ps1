$targets = Get-CimInstance Win32_Process | Where-Object {
  $_.CommandLine -like "*e:\\w\\wx_project\\jizhang\\backend\\dist\\main*"
}

if (-not $targets) {
  Write-Output "Backend is not running."
  exit 0
}

$targets | ForEach-Object {
  Stop-Process -Id $_.ProcessId -Force
}

Write-Output "Backend stopped."
