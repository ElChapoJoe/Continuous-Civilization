# Saves a screenshot of the primary screen as PNG (the game runs full screen or borderless there).
# Usage:  powershell -ExecutionPolicy Bypass -File tools\screenshot.ps1 OUT.png
param([Parameter(Mandatory = $true)][string]$Out)
Add-Type -AssemblyName System.Drawing, System.Windows.Forms
$b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($b.Location, [System.Drawing.Point]::Empty, $b.Size)
New-Item -ItemType Directory -Force (Split-Path -Parent ([System.IO.Path]::GetFullPath($Out))) | Out-Null
$bmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
"Saved $Out"
