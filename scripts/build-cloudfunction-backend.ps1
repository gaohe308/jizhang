$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $projectRoot 'backend'
$functionDir = Join-Path $projectRoot 'cloudfunctions\backend-http'

$sourcePaths = @{
  Dist = Join-Path $backendDir 'dist'
  Generated = Join-Path $backendDir 'generated'
  Prisma = Join-Path $backendDir 'prisma'
  NodeModules = Join-Path $backendDir 'node_modules'
}

$targetPaths = @{
  Dist = Join-Path $functionDir 'dist'
  Generated = Join-Path $functionDir 'generated'
  Prisma = Join-Path $functionDir 'prisma'
  NodeModules = Join-Path $functionDir 'node_modules'
}

function Assert-PathExists {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [Parameter(Mandatory = $true)]
    [string]$Label
  )

  if (-not (Test-Path -LiteralPath $Path)) {
    throw "$Label not found: $Path"
  }
}

function Reset-Path {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  if (Test-Path -LiteralPath $Path) {
    Remove-Item -LiteralPath $Path -Recurse -Force
  }
}

function Copy-Directory {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Source,
    [Parameter(Mandatory = $true)]
    [string]$Destination
  )

  $destinationParent = Split-Path -Parent $Destination

  if ($destinationParent -and -not (Test-Path -LiteralPath $destinationParent)) {
    New-Item -ItemType Directory -Path $destinationParent -Force | Out-Null
  }

  Copy-Item -LiteralPath $Source -Destination $Destination -Recurse -Force
}

Assert-PathExists -Path $backendDir -Label 'Backend directory'
Assert-PathExists -Path $functionDir -Label 'Cloud function directory'
Assert-PathExists -Path (Join-Path $functionDir 'index.js') -Label 'Cloud function entry'
Assert-PathExists -Path (Join-Path $functionDir 'package.json') -Label 'Cloud function package.json'
Assert-PathExists -Path (Join-Path $functionDir 'scf_bootstrap') -Label 'Cloud function scf_bootstrap'
Assert-PathExists -Path (Join-Path $backendDir 'package.json') -Label 'Backend package.json'

Push-Location $backendDir
try {
  Write-Output '[build-cloudfunction-backend] Generating Prisma client...'
  & '.\node_modules\.bin\prisma.cmd' generate --schema '.\prisma\schema.prisma'
  if ($LASTEXITCODE -ne 0) {
    throw 'Prisma client generation failed.'
  }

  Write-Output '[build-cloudfunction-backend] Building Nest backend...'
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) {
    throw 'Nest build failed.'
  }
} finally {
  Pop-Location
}

Assert-PathExists -Path $sourcePaths.Dist -Label 'Backend dist output'
Assert-PathExists -Path $sourcePaths.Generated -Label 'Backend generated Prisma client'
Assert-PathExists -Path $sourcePaths.Prisma -Label 'Backend prisma directory'
Assert-PathExists -Path $sourcePaths.NodeModules -Label 'Backend node_modules'

Reset-Path -Path $targetPaths.Dist
Reset-Path -Path $targetPaths.Generated
Reset-Path -Path $targetPaths.Prisma
Reset-Path -Path $targetPaths.NodeModules

Write-Output '[build-cloudfunction-backend] Copying dist...'
Copy-Directory -Source $sourcePaths.Dist -Destination $targetPaths.Dist

Write-Output '[build-cloudfunction-backend] Copying generated Prisma client...'
Copy-Directory -Source $sourcePaths.Generated -Destination $targetPaths.Generated

Write-Output '[build-cloudfunction-backend] Copying prisma schema and migrations...'
Copy-Directory -Source $sourcePaths.Prisma -Destination $targetPaths.Prisma

Write-Output '[build-cloudfunction-backend] Copying runtime node_modules...'
Copy-Directory -Source $sourcePaths.NodeModules -Destination $targetPaths.NodeModules

Write-Output '[build-cloudfunction-backend] Pruning dev dependencies from cloud function package...'
Push-Location $functionDir
try {
  & npm.cmd prune --omit=dev
  if ($LASTEXITCODE -ne 0) {
    throw 'npm prune --omit=dev failed.'
  }
} finally {
  Pop-Location
}

Write-Output '[build-cloudfunction-backend] Verifying generated Prisma client files...'
$linuxEnginePath = Join-Path $targetPaths.Generated 'client\libquery_engine-rhel-openssl-1.1.x.so.node'
Assert-PathExists -Path $linuxEnginePath -Label 'Linux Prisma engine'

$distFileCount = (Get-ChildItem -LiteralPath $targetPaths.Dist -Recurse -File | Measure-Object).Count
$generatedFileCount = (Get-ChildItem -LiteralPath $targetPaths.Generated -Recurse -File | Measure-Object).Count
$nodeModuleCount = (Get-ChildItem -LiteralPath $targetPaths.NodeModules -Recurse -File | Measure-Object).Count

Write-Output "[build-cloudfunction-backend] Ready: $functionDir"
Write-Output "[build-cloudfunction-backend] dist files: $distFileCount"
Write-Output "[build-cloudfunction-backend] generated files: $generatedFileCount"
Write-Output "[build-cloudfunction-backend] node_modules files: $nodeModuleCount"
Write-Output "[build-cloudfunction-backend] verified engine: $linuxEnginePath"
