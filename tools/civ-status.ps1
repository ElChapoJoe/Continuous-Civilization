# One-glance status of the dev setup: is the game running, is a crash reporter stuck, is the deployed mod current,
# newest saves and crash dumps.
# Usage:  powershell -ExecutionPolicy Bypass -File tools\civ-status.ps1
. "$PSScriptRoot\civ7-common.ps1"

$game = Get-Civ7Process
$reporter = Get-Civ7CrashReporter
"Game:            " + $(if ($game) { "running (pid $($game.Id), since $($game.StartTime)), UI page: $(Get-Civ7UiPage)" } else { "not running" })
"Crash reporter:  " + $(if ($reporter -and -not $game) { "STUCK (pid $($reporter.Id)) - Steam will refuse to launch; tools\restart-civ.ps1 clears it" } elseif ($reporter) { "running with the game" } else { "not running" })

$diff = @(Get-Civ7DeployDiff)
"Deployed mod:    " + $(if (-not (Test-Path $ModDeployed)) { "NOT DEPLOYED" } elseif ($diff.Count) { "$($diff.Count) file(s) differ from the project - run tools\deploy.ps1" } else { "matches the project" })
$diff | Select-Object -First 10 | ForEach-Object { "                   $_" }

$wsCopy = Get-ChildItem (Join-Path $Civ7Mods "*") -Directory -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -ne "continuous-civ" -and (Test-Path (Join-Path $_.FullName "*.modinfo")) -and (Select-String -Path (Join-Path $_.FullName "*.modinfo") -SimpleMatch "continuous-civ" -Quiet) }
if ($wsCopy) { "WARNING:         another copy of the mod is installed: $($wsCopy.FullName -join ', ') (turn the Workshop copy off)" }

"Newest saves:"
Get-ChildItem -Recurse -File (Join-Path $Civ7Saves "Single") -Filter *.Civ7Save -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending | Select-Object -First 5 |
  ForEach-Object { "  {0:yyyy-MM-dd HH:mm}  {1}" -f $_.LastWriteTime, $_.FullName.Substring($Civ7Saves.Length + 1) }

$dumps = Get-ChildItem -Directory (Join-Path $Civ7Data "Dumps") -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 3
if ($dumps) { "Newest crash dumps:"; $dumps | ForEach-Object { "  {0:yyyy-MM-dd HH:mm}  {1}" -f $_.LastWriteTime, $_.Name } }
