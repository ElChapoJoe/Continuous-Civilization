# Summarises errors in the game logs, mod-related ones first. Vanilla noise that shows up in every game (unit flag
# lookups, missing UI textures, HTML parser warnings) is counted but not listed.
# With a baseline (errors a normal game always prints, saved once from a good run), only NEW errors are listed and
# count towards the exit code; known ones are only counted. Lines are compared with numbers replaced by N.
# Usage:  powershell -ExecutionPolicy Bypass -File tools\scan-logs.ps1 [-All] [-SaveBaseline] [-NoBaseline] [-Baseline FILE]
#   -All           list the vanilla noise and the baseline's known errors too
#   -SaveBaseline  record every error in the current logs as known (after a game you checked is fine), then exit
#   -NoBaseline    ignore the baseline for this scan
#   -Baseline      the baseline file (default %USERPROFILE%\CivRuns\log-baseline.txt; kept out of the repo, as it
#                  is made of game log lines)
# Exit code 1 when there are new mod-related errors or new Database.log errors.
param([switch]$All, [switch]$SaveBaseline, [switch]$NoBaseline, [string]$Baseline)
. "$PSScriptRoot\civ7-common.ps1"

if (-not $Baseline) {
  $runs = if ($env:CC_RUNS) { $env:CC_RUNS } else { Join-Path $env:USERPROFILE "CivRuns" }
  $Baseline = Join-Path $runs "log-baseline.txt"
}
$noise = 'Failed attempt to get a unit|Expected this\.unit to be non-null|Failed loading resource|Failed to open file|HTML Parser Error|createBorderOverlay failed|findCityCenterIndexForPlotIndex|waitUntilValue'
$modPattern = 'cc-|continuous|CC_|cc_'
$sections = @(
  @{ File = "Database.log"; Pattern = 'ERROR:|ERROR |Invalid Reference|no such (table|column)|Failed Validation'; Case = $true },
  @{ File = "Modding.log";  Pattern = 'ERROR|Failed|could not'; Case = $true },
  @{ File = "UI.log";       Pattern = 'error|exception|uncaught|failed' },
  @{ File = "Scripting.log"; Pattern = 'error|exception' },
  @{ File = "GameCore.log"; Pattern = 'error|assert' }
)
# A line's key: no [timestamp] prefix, every number as N (turns, ids, coordinates change from game to game).
function Get-Key($line) { ($line -replace '^\[[^\]]*\]\s*', '') -replace '\d+', 'N' }

if ($SaveBaseline) {
  $keys = foreach ($s in $sections) {
    $path = Join-Path $Civ7Logs $s.File
    if (-not (Test-Path $path)) { continue }
    Select-String -Path $path -Pattern $s.Pattern -CaseSensitive:([bool]$s.Case) -ErrorAction SilentlyContinue |
      ForEach-Object { "$($s.File)`t$(Get-Key $_.Line)" }
  }
  $keys = @($keys | Sort-Object -Unique)
  New-Item -ItemType Directory -Force (Split-Path $Baseline) | Out-Null
  $head = "# scan-logs baseline, $(Get-Date -Format s): <log file><TAB><error line with numbers as N>"
  Set-Content -Path $Baseline -Value (@($head) + $keys) -Encoding utf8
  "Saved $($keys.Count) known error line(s) to $Baseline"
  if (@($keys | Where-Object { $_ -match $modPattern }).Count) { "NOTE: the baseline includes mod-related lines; they will no longer be listed as new." }
  exit 0
}

$known = @{}
$useBaseline = (-not $NoBaseline) -and (Test-Path $Baseline)
if ($useBaseline) {
  Get-Content $Baseline -Encoding utf8 | Where-Object { $_ -and -not $_.StartsWith("#") } | ForEach-Object { $known[$_] = $true }
  "Baseline: $($known.Count) known line(s) from $Baseline (from $((Get-Item $Baseline).LastWriteTime.ToString('yyyy-MM-dd')))"
} elseif (-not $NoBaseline) { "No baseline yet ($Baseline): every error is listed. Save one after a good game with -SaveBaseline." }

$found = 0
foreach ($s in $sections) {
  $path = Join-Path $Civ7Logs $s.File
  if (-not (Test-Path $path)) { continue }
  $hits = @(Select-String -Path $path -Pattern $s.Pattern -CaseSensitive:([bool]$s.Case) -ErrorAction SilentlyContinue)
  $isKnown = { param($h) $useBaseline -and $known.ContainsKey("$($s.File)`t$(Get-Key $h.Line)") }
  $knownHits = @($hits | Where-Object { & $isKnown $_ })
  $fresh = @($hits | Where-Object { -not (& $isKnown $_) })
  $mod = @($fresh | Where-Object { $_.Line -match $modPattern })
  $other = @($fresh | Where-Object { $_.Line -notmatch $modPattern -and ($All -or $_.Line -notmatch $noise) })
  $noiseCount = $fresh.Count - $mod.Count - $other.Count
  $label = if ($useBaseline) { "new " } else { "" }
  "== $($s.File): $($mod.Count) ${label}mod-related, $($other.Count) ${label}other, $noiseCount vanilla noise$(if ($useBaseline) { ", $($knownHits.Count) known" })"
  $group = { param($lines) $lines | ForEach-Object { Get-Key $_.Line } | Group-Object | Sort-Object Count -Descending | Select-Object -First 15 | ForEach-Object { "   {0,5}x {1}" -f $_.Count, $_.Name.Substring(0, [Math]::Min(180, $_.Name.Length)) } }
  if ($mod.Count) { "  mod-related:"; & $group $mod; $found += $mod.Count }
  if ($other.Count) { "  other:"; & $group $other; if ($s.File -eq "Database.log") { $found += $other.Count } }
  if ($All -and $knownHits.Count) { "  known (baseline):"; & $group $knownHits }
}
if ($found) { exit 1 }
