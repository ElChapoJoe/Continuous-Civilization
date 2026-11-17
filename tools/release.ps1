# Release checklist: checks that a release is ready, then (with switches) does the local steps and the publishing.
#   powershell -ExecutionPolicy Bypass -File tools\release.ps1                 # checks only, changes nothing
#   powershell -ExecutionPolicy Bypass -File tools\release.ps1 -Prepare        # + deploy, Workshop placeholders, local tag
#   powershell -ExecutionPolicy Bypass -File tools\release.ps1 -Publish        # + push the tag, GitHub pre-release
# The version comes from the top CHANGELOG.md entry ("## 0.2.1-beta (23) - title"); the number in brackets must be
# the version in continuous-civ.modinfo. The Workshop upload stays manual (the uploader is GUI-only): the script
# prints the change note to paste. Steps and fields: docs/workshop/README.md.
param([switch]$Prepare, [switch]$Publish)
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
$fail = @()
function Ok($m) { "  ok    $m" }
function Bad($m) { "  FAIL  $m"; $script:fail += $m }

"Release checks"
# 1. Branch and working tree
$branch = (git branch --show-current).Trim()
if ($branch -eq "main") { Ok "on main" } else { Bad "on '$branch', not main (releases come from main)" }
if (-not (git status --porcelain)) { Ok "working tree clean" } else { Bad "uncommitted changes (commit or stash them first)" }
git fetch -q origin main 2>$null
$behind = [int](git rev-list --count "HEAD..origin/main" 2>$null)
if ($behind -eq 0) { Ok "not behind origin/main" } else { Bad "$behind commit(s) behind origin/main (pull first)" }

# 2. Version: CHANGELOG top entry vs modinfo
$top = Select-String -Path CHANGELOG.md -Pattern '^## (\S+) \((\d+)\)' | Select-Object -First 1
if (-not $top) { Bad "no '## <version> (<number>)' entry in CHANGELOG.md"; $version = $null }
else {
  $version = $top.Matches[0].Groups[1].Value; $build = $top.Matches[0].Groups[2].Value
  $modinfo = Get-Content mod\continuous-civ\continuous-civ.modinfo -Raw
  $mv = [regex]::Match($modinfo, '<Mod id="continuous-civ" version="(\d+)"').Groups[1].Value
  if ($mv -eq $build) { Ok "CHANGELOG $version ($build) matches modinfo version $mv" }
  else { Bad "CHANGELOG says ($build) but continuous-civ.modinfo has version=""$mv"" (bump one of them)" }
}

# 3. Workshop change note and tag
$short = if ($version) { $version -replace '-beta$', '' } else { "?" }
$note = Select-String -Path docs\workshop\README.md -Pattern ("^\| Change note \(" + [regex]::Escape($short) + "\) \| ``(.+)`` \|") | Select-Object -First 1
if ($note) { Ok "Workshop change note for $short in docs/workshop/README.md" }
else { Bad "no 'Change note ($short)' row in docs/workshop/README.md (the text pasted into the uploader)" }
$tag = "v$version"
if ($version -and -not (git tag -l $tag)) { Ok "tag $tag not used yet" } elseif ($version) {
  if ($Prepare -or $Publish) { Ok "tag $tag already exists (re-run: kept)" } else { Bad "tag $tag already exists (version not bumped?)" }
}

# 4. Static mod check
& python -I tools\check_mod.py | Select-Object -Last 1 | ForEach-Object { "        $_" }
if ($LASTEXITCODE -eq 0) { Ok "check_mod.py" } else { Bad "check_mod.py found errors" }

if ($fail.Count) { "`n$($fail.Count) problem(s): fix them and run again."; exit 1 }
if (-not ($Prepare -or $Publish)) { "`nAll checks passed. Next: -Prepare (deploy, placeholders, local tag), then -Publish."; exit 0 }

# 5. Prepare: deploy, placeholders, local tag
"`nPrepare"
& powershell -ExecutionPolicy Bypass -File "$PSScriptRoot\deploy.ps1"
if ($LASTEXITCODE) { throw "deploy failed" }
& python -I tools\workshop_placeholders.py
if (-not (git tag -l $tag)) { git tag -a $tag -m "Continuous Civilization $version"; Ok "tagged $tag (local)" }
"`nWorkshop upload (manual, see docs/workshop/README.md 'Updates'):"
"  1. Start the Mod Uploader, pick the deployed folder, item 3838777743."
"  2. Change note to paste:"
"     $($note.Matches[0].Groups[1].Value)"
if (-not $Publish) { "`nAfter the upload: run again with -Publish to push the tag and create the GitHub release."; exit 0 }

# 6. Publish: push the tag, GitHub pre-release with the CHANGELOG entry as notes
"`nPublish"
$lines = Get-Content CHANGELOG.md
$start = ($lines | Select-String -Pattern ('^## ' + [regex]::Escape($version) + ' ') | Select-Object -First 1).LineNumber
$end = ($lines | Select-Object -Skip $start | Select-String -Pattern '^## ' | Select-Object -First 1).LineNumber
$body = ($lines[$start..($start + $(if ($end) { $end - 2 } else { $lines.Count }))] -join "`n").Trim()
$notes = Join-Path $env:TEMP "cc-release-notes.md"
Set-Content -Path $notes -Value $body -Encoding utf8
git push origin $tag
if ($LASTEXITCODE) { throw "tag push failed" }
gh release create $tag --title "Continuous Civilization $version" --prerelease --notes-file $notes
if ($LASTEXITCODE) { throw "gh release create failed" }
Ok "released $tag on GitHub"
