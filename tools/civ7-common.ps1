# Shared paths and helpers for the Civilization VII dev scripts in tools/. Dot-source it: . "$PSScriptRoot\civ7-common.ps1"
$Civ7AppId    = 1295660
$Civ7Data     = Join-Path $env:LOCALAPPDATA "Firaxis Games\Sid Meier's Civilization VII"
$Civ7Logs     = Join-Path $Civ7Data "Logs"
$Civ7Mods     = Join-Path $Civ7Data "Mods"
$Civ7Saves    = Join-Path ([Environment]::GetFolderPath("MyDocuments")) "My Games\Sid Meier's Civilization VII\Saves"
$ModSource    = (Resolve-Path (Join-Path $PSScriptRoot "..\mod\continuous-civ")).Path
$ModDeployed  = Join-Path $Civ7Mods "continuous-civ"

function Get-Civ7Process { Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -like "Civ7_Win64_*" } }
function Get-Civ7CrashReporter { Get-Process -Name "FiraxisCrashReporter" -ErrorAction SilentlyContinue }

# Log marks: record a log's first line, size and the count of a marker line; Test-Civ7LogSince tells whether the
# marker has appeared since (the game starts new logs at launch, so a new first line or a shorter file counts as
# a new log, where any marker counts).
#   Main menu: UI.log "VM: Unable to find harness" (written as the shell starts; UI.log never says "main-menu").
#   Game loaded: AppStateLoadGame.log "AppStateLoadGame::End()" (a save or new game finished loading).
function Get-Civ7LogMark([string]$File, [string]$Marker) {
  $log = Join-Path $Civ7Logs $File
  if (-not (Test-Path $log)) { return @{ File = $File; Marker = $Marker; Length = 0; Count = 0; Head = "" } }
  return @{ File = $File; Marker = $Marker; Length = (Get-Item $log).Length
            Head = (Get-Content $log -TotalCount 1 -ErrorAction SilentlyContinue) -join ""
            Count = @(Select-String -Path $log -SimpleMatch $Marker -ErrorAction SilentlyContinue).Count }
}
function Test-Civ7LogSince($mark) {
  $now = Get-Civ7LogMark $mark.File $mark.Marker
  if ($now.Head -ne $mark.Head -or $now.Length -lt $mark.Length) { return $now.Count -ge 1 }
  return $now.Count -gt $mark.Count
}
function Get-Civ7UiLogMark { Get-Civ7LogMark "UI.log" "Unable to find harness" }
function Get-Civ7LoadMark { Get-Civ7LogMark "AppStateLoadGame.log" "AppStateLoadGame::End()" }

# The page the game's UI is showing, from its UI debugger (port 9444): "shell" (main menu and setup screens),
# "game" (loading screen or in a game), or $null while the game is starting or not running.
function Get-Civ7UiPage {
  try {
    $pages = (Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 "http://127.0.0.1:9444/json").Content | ConvertFrom-Json
    $url = @($pages)[0].url
    if ($url -like "*root-shell.html") { return "shell" }
    if ($url -like "*root-game.html") { return "game" }
    return $url
  } catch { return $null }
}

# Files that differ between the project's mod folder and the deployed copy (relative paths).
function Get-Civ7DeployDiff {
  $out = @()
  $src = Get-ChildItem -Recurse -File $ModSource
  foreach ($f in $src) {
    $rel = $f.FullName.Substring($ModSource.Length).TrimStart('\')
    $d = Join-Path $ModDeployed $rel
    if (-not (Test-Path $d)) { $out += "+ $rel"; continue }
    if ((Get-FileHash $f.FullName).Hash -ne (Get-FileHash $d).Hash) { $out += "~ $rel" }
  }
  if (Test-Path $ModDeployed) {
    foreach ($f in Get-ChildItem -Recurse -File $ModDeployed) {
      $rel = $f.FullName.Substring($ModDeployed.Length).TrimStart('\')
      if (-not (Test-Path (Join-Path $ModSource $rel))) { $out += "- $rel" }
    }
  }
  return $out
}
