# Copies the mod from the project into the Civilization VII user Mods folder (mirror: removed files are removed).
# Usage:  powershell -ExecutionPolicy Bypass -File tools\deploy.ps1 [-Remove] [-DryRun]
# Prints what changed and what the game needs to pick it up:
#   - a changed .modinfo (new or removed files): a full game restart (tools\restart-civ.ps1)
#   - SQL/XML data: a new game or loading a save (game-wide modifiers only attach in games started after the change)
#   - UI scripts only: a UI reload is enough
param([switch]$Remove, [switch]$DryRun)
. "$PSScriptRoot\civ7-common.ps1"

if ($Remove) {
  if (Test-Path $ModDeployed) { Remove-Item -Recurse -Force $ModDeployed }
  "Removed $ModDeployed"; return
}
$diff = @(Get-Civ7DeployDiff)
if ($diff.Count -eq 0) { "Deployed copy is already up to date."; return }
"Changes ($($diff.Count)):"
$diff | ForEach-Object { "  $_" }
if ($DryRun) { return }

New-Item -ItemType Directory -Force $Civ7Mods | Out-Null
robocopy $ModSource $ModDeployed /MIR /NJH /NJS /NDL /NP /NFL | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy failed with exit code $LASTEXITCODE" }
$left = @(Get-Civ7DeployDiff)
if ($left.Count) { throw "Deploy incomplete, still different: $($left -join ', ')" }
"Deployed to $ModDeployed"

$paths = $diff | ForEach-Object { $_.Substring(2) }
if ($paths | Where-Object { $_ -like "*.modinfo" }) {
  "NEXT: the .modinfo changed -> restart the game (tools\restart-civ.ps1)."
} elseif ($paths | Where-Object { $_ -like "data\*" -or $_ -like "text\*" -or $_ -like "*.sql" -or $_ -like "*.xml" }) {
  "NEXT: data changed -> start a new game (Network.restartGame()) or load a save; game-wide rules only attach in new games."
} elseif ($paths | Where-Object { $_ -like "ui\*" }) {
  "NEXT: UI scripts only -> reload the UI."
}
