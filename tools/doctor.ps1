# Checks the whole dev setup before work or an overnight run, one line per check: OK, WARN or FAIL. Exit code 1 when
# anything FAILs.
# Usage:  powershell -ExecutionPolicy Bypass -File tools\doctor.ps1
. "$PSScriptRoot\civ7-common.ps1"
$fails = 0
function Ok($what, $detail = "")   { "OK    {0,-26} {1}" -f $what, $detail }
function Warn($what, $detail = "") { "WARN  {0,-26} {1}" -f $what, $detail }
function Fail($what, $detail = "") { $script:fails++; "FAIL  {0,-26} {1}" -f $what, $detail }
$Repo = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Proto = Join-Path $Repo "experimental\cc-visual-prototype"
$Park = Join-Path $env:USERPROFILE "CivModsParked"

# --- the game
$base = $env:CIV7_DIR
if (-not $base) {
  $roots = @()
  $vdf = Join-Path ${env:ProgramFiles(x86)} "Steam\steamapps\libraryfolders.vdf"
  if (Test-Path $vdf) { $roots += [regex]::Matches((Get-Content $vdf -Raw), '"path"\s+"([^"]+)"') | ForEach-Object { $_.Groups[1].Value -replace '\\\\', '\' } }
  foreach ($r in $roots) { $b = Join-Path $r "steamapps\common\Sid Meier's Civilization VII\Base"; if (Test-Path $b) { $base = $b; break } }
}
if ($base -and (Test-Path $base)) { Ok "Game installed" $base } else { Fail "Game installed" "not found through Steam; set CIV7_DIR" }
$opts = Join-Path $Civ7Data "AppOptions.txt"
if (Test-Path $opts) {
  # Commented-out lines mean the game's default, which leaves both on; only an explicit "off" breaks the tools.
  if (Select-String -Path $opts -Pattern '^\s*UIDebugger\s+0' -Quiet) { Fail "UI debugger" "UIDebugger 0 in AppOptions.txt: the run scripts need port 9444" } else { Ok "UI debugger" "on (port 9444)" }
  if (Select-String -Path $opts -Pattern '^\s*EnableTuner\s+2' -Quiet) { Warn "Tuner" "EnableTuner 2 (off): console tools fall back to the UI debugger" } else { Ok "Tuner" "default or on" }
} else { Warn "AppOptions.txt" "not found (start the game once)" }

$game = Get-Civ7Process; $reporter = Get-Civ7CrashReporter
if ($game) {
  $page = Get-Civ7UiPage
  if ($page) { Ok "Game running" "UI page: $page (debug port 9444 answers)" } else { Warn "Game running" "debug port 9444 does not answer yet" }
} else { Ok "Game running" "no" }
if ($reporter -and -not $game) { Fail "Crash reporter" "stuck (pid $($reporter.Id)): Steam will refuse to launch; tools\restart-civ.ps1 clears it" } else { Ok "Crash reporter" "not stuck" }

# --- mods
$diff = @(Get-Civ7DeployDiff)
if (-not (Test-Path $ModDeployed)) { Fail "continuous-civ deployed" "missing from the Mods folder" }
elseif ($diff.Count) { Warn "continuous-civ deployed" "$($diff.Count) file(s) differ from the project (tools\deploy.ps1)" }
else { Ok "continuous-civ deployed" "matches the project" }
$protoDeployed = Join-Path $Civ7Mods "cc-visual-prototype"
if (Test-Path $Proto) {
  if (-not (Test-Path $protoDeployed)) { Warn "Visual prototype" "not in the Mods folder (optional)" }
  else {
    $pd = @()
    foreach ($f in @(Get-ChildItem (Join-Path $Proto "ui") -File) + @(Get-Item (Join-Path $Proto "cc-visual-prototype.modinfo"))) {
      $rel = $f.FullName.Substring($Proto.Length).TrimStart('\'); $d = Join-Path $protoDeployed $rel
      if (-not (Test-Path $d) -or (Get-FileHash $f.FullName).Hash -ne (Get-FileHash $d).Hash) { $pd += $rel }
    }
    if ($pd.Count) { Warn "Visual prototype" "differs from the project: $($pd -join ', ')" } else { Ok "Visual prototype" "matches the project" }
  }
}
$parked = @(Get-ChildItem $Park -Directory -ErrorAction SilentlyContinue)
if ($parked.Count) { Fail "Parked mods" "still parked in $Park ($($parked.Name -join ', ')): a vanilla run did not restore them" } else { Ok "Parked mods" "none" }
$wsCopy = Get-ChildItem (Join-Path $Civ7Mods "*") -Directory -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -ne "continuous-civ" -and $_.Name -ne "cc-visual-prototype" -and (Test-Path (Join-Path $_.FullName "*.modinfo")) -and (Select-String -Path (Join-Path $_.FullName "*.modinfo") -SimpleMatch "id=""continuous-civ""" -Quiet) }
if ($wsCopy) { Warn "Other mod copies" "$($wsCopy.FullName -join ', ')" } else { Ok "Other mod copies" "none" }

# --- tools
$node = Get-Command node -ErrorAction SilentlyContinue
if ($node) {
  $v = (& node --version) -replace '^v', ''
  if ([int]($v.Split('.')[0]) -ge 22) { Ok "Node" $v } else { Fail "Node" "$v (22 or later needed for the run scripts)" }
} else { Fail "Node" "not found" }
$py = Get-Command python -ErrorAction SilentlyContinue
if ($py) { Ok "Python" ((& python --version) -join "") } else { Fail "Python" "not found (generators and checks need it)" }
$np = if ($env:CC_PYTHON) { $env:CC_PYTHON } else { "G:\SteamLibrary\steamapps\common\Blender\5.2\python\bin\python.exe" }
if (Test-Path $np) {
  $ok = & $np -I -c "import numpy; print(numpy.__version__)" 2>$null
  if ($LASTEXITCODE -eq 0) { Ok "Python with numpy" "$np (numpy $ok)" } else { Fail "Python with numpy" "$np cannot import numpy" }
} else { Warn "Python with numpy" "$np not found: set CC_PYTHON (screenshot scoring needs numpy)" }
$git = Get-Command git -ErrorAction SilentlyContinue
if ($git) {
  Push-Location $Repo
  $branch = (& git rev-parse --abbrev-ref HEAD); $dirty = @(& git status --porcelain).Count
  $ahead = (& git rev-list --count "@{u}..HEAD" 2>$null)
  Pop-Location
  Ok "Git" ("branch $branch, $dirty uncommitted, " + $(if ($ahead) { "$ahead unpushed" } else { "no upstream" }))
} else { Fail "Git" "not found" }
if (Get-Command gh -ErrorAction SilentlyContinue) {
  & gh auth status *> $null
  if ($LASTEXITCODE -eq 0) { Ok "GitHub CLI" "signed in" } else { Warn "GitHub CLI" "not signed in (gh auth login)" }
} else { Warn "GitHub CLI" "not found" }

# --- space
$drive = Get-PSDrive -Name ($env:USERPROFILE.Substring(0, 1))
$freeGb = [math]::Round($drive.Free / 1GB)
if ($freeGb -lt 10) { Fail "Disk space" "$freeGb GB free on $($drive.Name):" } elseif ($freeGb -lt 30) { Warn "Disk space" "$freeGb GB free on $($drive.Name): (a whole-map probe writes several GB)" } else { Ok "Disk space" "$freeGb GB free on $($drive.Name):" }
$shots = Join-Path $env:USERPROFILE "CivStreetShots"
if (Test-Path $shots) {
  $gb = [math]::Round(((Get-ChildItem $shots -Recurse -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum) / 1GB, 1)
  if ($gb -gt 50) { Warn "Screenshot folder" "$gb GB in $shots (old runs can go)" } else { Ok "Screenshot folder" "$gb GB in $shots" }
}

""
if ($fails) { "$fails check(s) failed." ; exit 1 } else { "All checks passed (warnings above are optional)." }
