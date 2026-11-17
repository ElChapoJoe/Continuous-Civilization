# Screenshot helper for tools/pipeline/civ.mjs captureFast(): stays open and answers one line per command on stdin.
#   hello          -> ready
#   sample         -> 64 x 27 grey values of the game window, comma-separated (to tell when the picture has settled)
#   save <file>    -> saved   (the whole screen as a 24-bit BMP, as capture-states.ps1 does)
#   quit
# Nothing may cover the game window.
Add-Type -AssemblyName System.Drawing, System.Windows.Forms
Add-Type @'
using System; using System.Runtime.InteropServices;
public class W32cs { [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h); }
'@
$p = Get-Process | Where-Object { $_.MainWindowTitle -match "Civilization VII" } | Select-Object -First 1
if ($p) { [W32cs]::SetForegroundWindow($p.MainWindowHandle) | Out-Null }
$b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$small = New-Object System.Drawing.Bitmap 64, 27
while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line -or $line -eq "quit") { break }
  if ($line -eq "hello") { [Console]::Out.WriteLine("ready"); [Console]::Out.Flush(); continue }
  if ($line -eq "sample") {
    $full = New-Object System.Drawing.Bitmap $b.Width, $b.Height, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $g = [System.Drawing.Graphics]::FromImage($full); $g.CopyFromScreen($b.Location, [System.Drawing.Point]::Empty, $b.Size); $g.Dispose()
    $gs = [System.Drawing.Graphics]::FromImage($small)
    $gs.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBilinear
    $gs.DrawImage($full, 0, 0, 64, 27); $gs.Dispose(); $full.Dispose()
    $vals = New-Object System.Collections.Generic.List[int]
    for ($y = 0; $y -lt 27; $y++) { for ($x = 0; $x -lt 64; $x++) { $c = $small.GetPixel($x, $y); $vals.Add([int](($c.R + $c.G + $c.B) / 3)) } }
    [Console]::Out.WriteLine(($vals -join ",")); [Console]::Out.Flush(); continue
  }
  if ($line.StartsWith("save ")) {
    $file = $line.Substring(5)
    $full = New-Object System.Drawing.Bitmap $b.Width, $b.Height, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $g = [System.Drawing.Graphics]::FromImage($full); $g.CopyFromScreen($b.Location, [System.Drawing.Point]::Empty, $b.Size); $g.Dispose()
    $full.Save($file, [System.Drawing.Imaging.ImageFormat]::Bmp); $full.Dispose()
    [Console]::Out.WriteLine("saved"); [Console]::Out.Flush(); continue
  }
  [Console]::Out.WriteLine("unknown"); [Console]::Out.Flush()
}
