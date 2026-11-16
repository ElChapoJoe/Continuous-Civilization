# Summarises errors in the game logs, mod-related ones first. Vanilla noise that shows up in every game (unit flag
# lookups, missing UI textures, HTML parser warnings) is counted but not listed.
# Usage:  powershell -ExecutionPolicy Bypass -File tools\scan-logs.ps1 [-All]
param([switch]$All)
. "$PSScriptRoot\civ7-common.ps1"

$noise = 'Failed attempt to get a unit|Expected this\.unit to be non-null|Failed loading resource|Failed to open file|HTML Parser Error|createBorderOverlay failed|findCityCenterIndexForPlotIndex|waitUntilValue'
$sections = @(
  @{ File = "Database.log"; Pattern = 'ERROR:|ERROR |Invalid Reference|no such (table|column)|Failed Validation'; Case = $true },
  @{ File = "Modding.log";  Pattern = 'ERROR|Failed|could not'; Case = $true },
  @{ File = "UI.log";       Pattern = 'error|exception|uncaught|failed' },
  @{ File = "Scripting.log"; Pattern = 'error|exception' },
  @{ File = "GameCore.log"; Pattern = 'error|assert' }
)
$found = 0
foreach ($s in $sections) {
  $path = Join-Path $Civ7Logs $s.File
  if (-not (Test-Path $path)) { continue }
  $hits = Select-String -Path $path -Pattern $s.Pattern -CaseSensitive:([bool]$s.Case) -ErrorAction SilentlyContinue
  $mod = @($hits | Where-Object { $_.Line -match 'cc-|continuous|CC_|cc_' })
  $other = @($hits | Where-Object { $_.Line -notmatch 'cc-|continuous|CC_|cc_' -and ($All -or $_.Line -notmatch $noise) })
  $noiseCount = @($hits).Count - $mod.Count - $other.Count
  "== $($s.File): $($mod.Count) mod-related, $($other.Count) other, $noiseCount vanilla noise"
  $group = { param($lines) $lines | ForEach-Object { ($_.Line -replace '^\[[^\]]*\]\s*', '') -replace '\d+', 'N' } | Group-Object | Sort-Object Count -Descending | Select-Object -First 15 | ForEach-Object { "   {0,5}x {1}" -f $_.Count, $_.Name.Substring(0, [Math]::Min(180, $_.Name.Length)) } }
  if ($mod.Count) { "  mod-related:"; & $group $mod; $found += $mod.Count }
  if ($other.Count) { "  other:"; & $group $other; if ($s.File -eq "Database.log") { $found += $other.Count } }
}
if ($found) { exit 1 }
