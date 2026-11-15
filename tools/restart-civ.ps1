# Starts (or restarts) Civilization VII and waits until its main menu has loaded.
# Usage:  powershell -ExecutionPolicy Bypass -File tools\restart-civ.ps1 [-Kill] [-TimeoutSec 300]
#   If the game is running, it is left alone unless -Kill is given (unsaved progress is lost). To close it cleanly
#   first, run engine.call("exitToDesktop") on the debug console; this script then waits for it to exit.
# Handles the stuck relaunch: after the game exits, FiraxisCrashReporter.exe can stay running, Steam then treats
# Civ VII as still running and every launch "completes" without starting it. The reporter is stopped first.
param([switch]$Kill, [int]$TimeoutSec = 300)
. "$PSScriptRoot\civ7-common.ps1"

$running = Get-Civ7Process
if ($running) {
  if (-not $Kill) {
    "Civ VII is running (pid $($running.Id)). Waiting up to 60 s for it to exit (or pass -Kill)..."
    $deadline = (Get-Date).AddSeconds(60)
    while ((Get-Civ7Process) -and (Get-Date) -lt $deadline) { Start-Sleep -Seconds 2 }
    if (Get-Civ7Process) { throw "Civ VII is still running. Close it (engine.call('exitToDesktop')) or pass -Kill." }
  } else {
    "Stopping Civ VII (pid $($running.Id))..."
    $running | Stop-Process -Force
    Start-Sleep -Seconds 3
  }
}

$reporter = Get-Civ7CrashReporter
if ($reporter) {
  "Stopping leftover FiraxisCrashReporter (pid $($reporter.Id)) so Steam can launch the game."
  $reporter | Stop-Process -Force
  Start-Sleep -Seconds 3
}

$mark = Get-Civ7UiLogMark
"Launching through Steam..."
cmd /c start "" "steam://rungameid/$Civ7AppId"

$launchedAt = Get-Date
$deadline = $launchedAt.AddSeconds($TimeoutSec)
$started = $false
$retried = $false
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Seconds 3
  if (-not $started -and (Get-Civ7Process)) { $started = $true; "Game process started." }
  if ($started -and (Test-Civ7LogSince $mark) -and (Get-Civ7UiPage) -eq "shell") {
    # The shell logs its marker as it starts; give the menu a few seconds to finish building.
    Start-Sleep -Seconds 8
    "Main menu loaded ($([int]((Get-Date) - $launchedAt).TotalSeconds) s)."; exit 0
  }
  # Not started after 45 s: clear a crash reporter that came back and launch once more.
  if (-not $started -and -not $retried -and ((Get-Date) - $launchedAt).TotalSeconds -gt 45) {
    $retried = $true
    Get-Civ7CrashReporter | Stop-Process -Force -ErrorAction SilentlyContinue
    "Not started yet; launching once more."
    cmd /c start "" "steam://rungameid/$Civ7AppId"
  }
}
if (-not $started) { throw "Civ VII did not start within $TimeoutSec s. Check Steam (a launch-option or update dialog may be waiting)." }
throw "Civ VII started but the main menu did not load within $TimeoutSec s."
