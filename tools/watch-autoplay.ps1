# Watches an AI autoplay from outside the game and prints one line per event, then exits:
#   DONE      the autoplay hit its turn limit (Autoplay.log)
#   TURN n    a new autosave was written (every -EveryTurns turns)
#   CRASH     the game process is gone
#   STALL     no new autosave for -StallMin minutes (the game may be waiting on a dialog, e.g. an Age screen in vanilla)
# Usage:  powershell -ExecutionPolicy Bypass -File tools\watch-autoplay.ps1 [-StallMin 6] [-EveryTurns 10]
# Meant for a background monitor: each printed line is an event.
param([int]$StallMin = 6, [int]$EveryTurns = 10)
. "$PSScriptRoot\civ7-common.ps1"

$autoLog = Join-Path $Civ7Logs "Autoplay.log"
$autoDir = Join-Path $Civ7Saves "Single\auto"
$logStart = if (Test-Path $autoLog) { (Get-Item $autoLog).Length } else { 0 }
$lastSave = Get-ChildItem $autoDir -Filter *.Civ7Save -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
$lastSaveTime = if ($lastSave) { $lastSave.LastWriteTime } else { Get-Date }
$lastReported = -1
while ($true) {
  Start-Sleep -Seconds 15
  if (-not (Get-Civ7Process)) { "CRASH game process is gone"; exit 2 }
  $newest = Get-ChildItem $autoDir -Filter *.Civ7Save -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if ($newest -and $newest.LastWriteTime -gt $lastSaveTime) {
    $lastSaveTime = $newest.LastWriteTime
    if ($newest.BaseName -match '_(\d+)$') {
      $turn = [int]$Matches[1]
      if ($turn -ge $lastReported + $EveryTurns) { "TURN $turn"; $lastReported = $turn }
    }
  }
  if ((Test-Path $autoLog) -and (Get-Item $autoLog).Length -lt $logStart) { $logStart = 0 }   # log restarted
  if ((Test-Path $autoLog) -and (Get-Item $autoLog).Length -gt $logStart) {
    $fs = [System.IO.File]::Open($autoLog, 'Open', 'Read', 'ReadWrite')
    $fs.Seek($logStart, 'Begin') | Out-Null
    $text = (New-Object System.IO.StreamReader($fs)).ReadToEnd(); $fs.Close()
    $logStart += [System.Text.Encoding]::UTF8.GetByteCount($text)
    if ($text -match 'Turn Limit Hit|Autoplay Inactive') { "DONE autoplay finished$(if ($lastReported -ge 0) { " (last autosave turn $lastReported)" })"; exit 0 }
  }
  if (((Get-Date) - $lastSaveTime).TotalMinutes -gt $StallMin) { "STALL no autosave for $StallMin min (last $($lastSaveTime.ToString('HH:mm')))"; exit 3 }
}
