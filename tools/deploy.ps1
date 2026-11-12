# Copies the mod from the project into the Civilization VII user Mods folder.
# Usage:  powershell -ExecutionPolicy Bypass -File tools\deploy.ps1 [-Remove]
param([switch]$Remove)
$src  = Join-Path $PSScriptRoot "..\mod\continuous-civ"
$mods = Join-Path $env:LOCALAPPDATA "Firaxis Games\Sid Meier's Civilization VII\Mods"
$dst  = Join-Path $mods "continuous-civ"
if (Test-Path $dst) { Remove-Item -Recurse -Force $dst }
if ($Remove) { "Removed $dst"; return }
New-Item -ItemType Directory -Force $mods | Out-Null
Copy-Item -Recurse $src $dst
"Deployed to $dst"
Get-ChildItem -Recurse $dst | Select-Object -ExpandProperty FullName
