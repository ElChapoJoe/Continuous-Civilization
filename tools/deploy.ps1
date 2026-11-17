# Copies the mod from the project into the Civilization VII user Mods folder (mirror: removed files are removed).
# Usage:  powershell -ExecutionPolicy Bypass -File tools\deploy.ps1 [-Remove] [-DryRun] [-SkipCheck]
# Runs tools\check_mod.py first and stops on any error (a broken SQL file makes the game roll back the whole mod);
# -SkipCheck deploys anyway (only for testing a broken state on purpose).
# Prints what changed and what the game needs to pick it up:
#   - a changed .modinfo (new or removed files): a full game restart (tools\restart-civ.ps1)
#   - SQL/XML data: a new game or loading a save (game-wide modifiers only attach in games started after the change)
#   - UI scripts only: a UI reload is enough
param([switch]$Remove, [switch]$DryRun, [switch]$SkipCheck)
. "$PSScriptRoot\civ7-common.ps1"

if ($Remove) {
  if (Test-Path $ModDeployed) { Remove-Item -Recurse -Force $ModDeployed }
  "Removed $ModDeployed"; return
}
if (-not $SkipCheck) {
  $py = (Get-Command python -ErrorAction SilentlyContinue).Source
  if (-not $py) { throw "python not found: install it or deploy with -SkipCheck" }
  & $py -I "$PSScriptRoot\check_mod.py"
  if ($LASTEXITCODE -ne 0) { throw "check_mod.py found errors: not deployed (fix them, or -SkipCheck to deploy anyway)" }
  # Generated SQL out of date (a game update, or a generator changed without re-running): warn, don't block.
  & $py -I "$PSScriptRoot\check_generated.py"
  if ($LASTEXITCODE -eq 1) { "WARNING: generated SQL is out of date (see above): python -I tools\check_generated.py --update, then commit" }
  elseif ($LASTEXITCODE -ne 0) { "WARNING: check_generated.py could not run the generators (see above)" }
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
