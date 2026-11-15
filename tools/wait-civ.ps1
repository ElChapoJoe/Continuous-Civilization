# Waits until the game reaches a state, then exits 0 (1 on timeout, 2 if the game is not running).
# Usage:  powershell -ExecutionPolicy Bypass -File tools\wait-civ.ps1 -For menu|game [-TimeoutSec 300]
#   menu  the main menu is showing (UI page = shell)
#   game  a save or new game has finished loading since this script started (AppStateLoadGame.log); the
#         "Begin Game" button is then ready to press. Start this right after asking the game to load.
param([ValidateSet("menu", "game")][string]$For = "menu", [int]$TimeoutSec = 300)
. "$PSScriptRoot\civ7-common.ps1"
$start = Get-Date
$loadMark = Get-Civ7LoadMark
while (((Get-Date) - $start).TotalSeconds -lt $TimeoutSec) {
  if (-not (Get-Civ7Process)) { "Civ VII is not running."; exit 2 }
  $ready = if ($For -eq "menu") { (Get-Civ7UiPage) -eq "shell" } else { Test-Civ7LogSince $loadMark }
  if ($ready) { Start-Sleep -Seconds 3; "$For ready after $([int]((Get-Date) - $start).TotalSeconds) s"; exit 0 }
  Start-Sleep -Seconds 3
}
"Timed out after $TimeoutSec s waiting for $For (UI page: $(Get-Civ7UiPage))."; exit 1
