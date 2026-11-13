# Render docs/images/logo-shapes.json (from tools/make_logo.py) to the 1024 x 1024 Workshop preview.
# Usage:  powershell -ExecutionPolicy Bypass -File tools\render_logo.ps1 [-Out <path.jpg|.png>]
param([string]$Out = (Join-Path $PSScriptRoot "..\docs\images\workshop-preview.jpg"))
Add-Type -AssemblyName System.Drawing
$shapes = Get-Content (Join-Path $PSScriptRoot "..\docs\images\logo-shapes.json") -Raw | ConvertFrom-Json
$N = [int]$shapes.size
$bmp = New-Object System.Drawing.Bitmap $N, $N
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'; $g.InterpolationMode = 'HighQualityBicubic'; $g.PixelOffsetMode = 'HighQuality'

# background: dark radial glow
$bg = New-Object System.Drawing.Drawing2D.GraphicsPath
$bg.AddEllipse(-300, -330, $N + 600, $N + 600)
$pb = New-Object System.Drawing.Drawing2D.PathGradientBrush $bg
$pb.CenterColor = [System.Drawing.Color]::FromArgb(35, 42, 59)
$pb.SurroundColors = @([System.Drawing.Color]::FromArgb(12, 15, 23))
$g.Clear([System.Drawing.Color]::FromArgb(12, 15, 23))
$g.FillPath($pb, $bg)

$goldRect = New-Object System.Drawing.Rectangle 0, 140, $N, 760
$gold = New-Object System.Drawing.Drawing2D.LinearGradientBrush $goldRect, ([System.Drawing.Color]::FromArgb(246, 223, 152)), ([System.Drawing.Color]::FromArgb(168, 118, 42)), 90
$blend = New-Object System.Drawing.Drawing2D.ColorBlend 3
$blend.Colors = @([System.Drawing.Color]::FromArgb(246, 223, 152), [System.Drawing.Color]::FromArgb(214, 168, 79), [System.Drawing.Color]::FromArgb(168, 118, 42))
$blend.Positions = @(0.0, 0.55, 1.0)
$gold.InterpolationColors = $blend
$gold.WrapMode = [System.Drawing.Drawing2D.WrapMode]::TileFlipXY
$edge = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(125, 86, 28)), 2
$edge.LineJoin = 'Round'
$stemPen = New-Object System.Drawing.Pen $gold, 7
$stemPen.StartCap = 'Round'; $stemPen.EndCap = 'Round'

function To-Points($list) { [System.Drawing.PointF[]]@($list | ForEach-Object { New-Object System.Drawing.PointF ([single]$_[0]), ([single]$_[1]) }) }
foreach ($s in $shapes.stems) { $g.DrawLines($stemPen, (To-Points $s)) }
foreach ($l in $shapes.leaves) { $p = To-Points $l; $g.FillPolygon($gold, $p); $g.DrawPolygon($edge, $p) }

# the C, centred on its visible outline
$L = $shapes.letter
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$family = New-Object System.Drawing.FontFamily $L.font
$path.AddString($L.text, $family, [int][System.Drawing.FontStyle]::Bold, [single]$L.size, (New-Object System.Drawing.PointF 0, 0), [System.Drawing.StringFormat]::GenericTypographic)
$b = $path.GetBounds()
$m = New-Object System.Drawing.Drawing2D.Matrix
$m.Translate([single]($L.cx - $b.X - $b.Width / 2), [single]($L.cy - $b.Y - $b.Height / 2))
$path.Transform($m)
$shadow = $path.Clone(); $sm = New-Object System.Drawing.Drawing2D.Matrix; $sm.Translate(5, 7); $shadow.Transform($sm)
$g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(150, 0, 0, 0))), $shadow)
$g.FillPath($gold, $path)
$letterEdge = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(125, 86, 28)), 3
$letterEdge.LineJoin = 'Round'
$g.DrawPath($letterEdge, $path)

if ($Out.ToLower().EndsWith('.png')) {
  $bmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
} else {
  $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
  $ep = New-Object System.Drawing.Imaging.EncoderParameters 1
  $ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), 92L
  $bmp.Save($Out, $codec, $ep)
}
$g.Dispose(); $bmp.Dispose()
"Wrote $Out ($((Get-Item $Out).Length) bytes)"
