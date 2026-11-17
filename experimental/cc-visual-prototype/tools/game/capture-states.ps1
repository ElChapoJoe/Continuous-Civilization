# Screenshots each street-probe state (tools/game/street-probe.js) for table_score.py. Run before CCStreetProbe.start;
# usage: capture-states.ps1 -Out <folder> -States <views x 13> -TimeoutSec <s>. Nothing may cover the game window.
param([string]$Out, [int]$States = 26, [int]$TimeoutSec = 200, [double]$Settle = 3.6)
# Screenshots the primary screen once per probe state: the state number is read from the colour of the marker square
# the in-game probe draws in the window's corner (red = 10 + 4 * state, blue 255).
Add-Type -AssemblyName System.Drawing, System.Windows.Forms
Add-Type @'
using System; using System.Runtime.InteropServices;
public class W32 { [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h); }
'@
New-Item -ItemType Directory -Force $Out | Out-Null
$p = Get-Process | Where-Object { $_.MainWindowTitle -match "Civilization VII" } | Select-Object -First 1
if ($p) { [W32]::SetForegroundWindow($p.MainWindowHandle) | Out-Null }
$b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$one = New-Object System.Drawing.Bitmap 1, 1
$g1 = [System.Drawing.Graphics]::FromImage($one)
$saved = @{}; $cur = -1; $since = Get-Date; $end = (Get-Date).AddSeconds($TimeoutSec)
while ((Get-Date) -lt $end -and $saved.Count -lt $States) {
  $g1.CopyFromScreen(70, 110, 0, 0, $one.Size)
  $c = $one.GetPixel(0, 0)
  $k = -1
  if ($c.B -gt 235 -and $c.G -lt 40) { $k = [int][math]::Round(($c.R - 10) / 4.0) + 60 * [int][math]::Round($c.G / 3.0) }
  if ($k -ne $cur) { $cur = $k; $since = Get-Date }
  elseif ($k -ge 0 -and -not $saved.ContainsKey($k) -and ((Get-Date) - $since).TotalSeconds -ge $Settle) {
    $bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.CopyFromScreen($b.Location, [System.Drawing.Point]::Empty, $b.Size)
    $bmp.Save((Join-Path $Out ("s{0:d2}.bmp" -f $k)), [System.Drawing.Imaging.ImageFormat]::Bmp)
    $g.Dispose(); $bmp.Dispose(); $saved[$k] = 1
  }
  Start-Sleep -Milliseconds 250
}
"saved $($saved.Count) of $States states: $(($saved.Keys | Sort-Object) -join ',')  screen $($b.Width)x$($b.Height)"
