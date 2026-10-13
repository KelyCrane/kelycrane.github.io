$ErrorActionPreference='Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$resolved=(Get-Item -LiteralPath '.').FullName
if($resolved.StartsWith('C:',[StringComparison]::OrdinalIgnoreCase)){throw '请将项目放在非 C 盘。'}
$env:TEMP=Join-Path $resolved '.storage\tmp'
$env:TMP=$env:TEMP
$env:npm_config_cache=Join-Path $resolved '.storage\cache\npm'
$env:ASTRO_TELEMETRY_DISABLED='1'
New-Item -ItemType Directory -Force -Path $env:TEMP,$env:npm_config_cache | Out-Null
npm.cmd run dev