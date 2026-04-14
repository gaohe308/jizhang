$cli = "e:\w\wx_project\jizhang\tools\redis\bin\redis-cli.exe"

if (Test-Path $cli) {
  & $cli -h 127.0.0.1 -p 6379 shutdown
}
