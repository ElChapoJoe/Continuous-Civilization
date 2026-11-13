# Render the 1920 x 1080 title card for the Steam Workshop gallery: laurel logo, title, tagline and the
# Antiquity -> Exploration -> Modern timeline (same look as docs/images/banner.svg and the logo).
# Usage:  powershell -ExecutionPolicy Bypass -File tools\render_title_card.ps1 [-Out <path.jpg>]
param([string]$Out = (Join-Path $PSScriptRoot "..\docs\images\workshop-title-card.jpg"))
Add-Type -AssemblyName System.Drawing
$W = 1920; $H = 1080
$shapes = Get-Content (Join-Path $PSScriptRoot "..\docs\images\logo-shapes.json") -Raw | ConvertFrom-Json
$bmp = New-Object System.Drawing.Bitmap $W, $H
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'; $g.TextRenderingHint = 'AntiAliasGridFit'; $g.PixelOffsetMode = 'HighQuality'
$C = { param($r, $gg, $b, $a = 255) [System.Drawing.Color]::FromArgb($a, $r, $gg, $b) }

# background: dark navy with a soft glow
$g.Clear((& $C 12 15 23))
$glow = New-Object System.Drawing.Drawing2D.GraphicsPath
$glow.AddEllipse(-200, -420, $W + 400, $H + 840)
$pb = New-Object System.Drawing.Drawing2D.PathGradientBrush $glow
$pb.CenterColor = (& $C 36 43 61); $pb.SurroundColors = @((& $C 12 15 23))
$g.FillPath($pb, $glow)

# thin gold frame
$goldColors = @((& $C 246 223 152), (& $C 214 168 79), (& $C 168 118 42))
function New-Gold($rect) {
  $b = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect, $goldColors[0], $goldColors[2], 90
  $cb = New-Object System.Drawing.Drawing2D.ColorBlend 3; $cb.Colors = $goldColors; $cb.Positions = @(0.0, 0.55, 1.0)
  $b.InterpolationColors = $cb; $b.WrapMode = [System.Drawing.Drawing2D.WrapMode]::TileFlipXY; $b
}
$framePen = New-Object System.Drawing.Pen ((& $C 214 168 79 120)), 3
$g.DrawRectangle($framePen, 36, 36, $W - 72, $H - 72)

# logo (from logo-shapes.json), scaled and placed above the title
$scale = 0.42; $ox = $W / 2 - 512 * $scale; $oy = 70
$gold = New-Gold (New-Object System.Drawing.Rectangle 0, ([int]$oy + 50), $W, ([int](800 * $scale)))
$edge = New-Object System.Drawing.Pen ((& $C 125 86 28)), 1.5
$stemPen = New-Object System.Drawing.Pen $gold, (7 * $scale); $stemPen.StartCap = 'Round'; $stemPen.EndCap = 'Round'
function To-Points($list) { [System.Drawing.PointF[]]@($list | ForEach-Object { New-Object System.Drawing.PointF ([single]($ox + $_[0] * $scale)), ([single]($oy + $_[1] * $scale)) }) }
foreach ($s in $shapes.stems) { $g.DrawLines($stemPen, (To-Points $s)) }
foreach ($l in $shapes.leaves) { $p = To-Points $l; $g.FillPolygon($gold, $p); $g.DrawPolygon($edge, $p) }
$L = $shapes.letter
$family = New-Object System.Drawing.FontFamily 'Georgia'
$cp = New-Object System.Drawing.Drawing2D.GraphicsPath
$cp.AddString('C', $family, [int][System.Drawing.FontStyle]::Bold, [single]($L.size * $scale), (New-Object System.Drawing.PointF 0, 0), [System.Drawing.StringFormat]::GenericTypographic)
$b = $cp.GetBounds(); $m = New-Object System.Drawing.Drawing2D.Matrix
$m.Translate([single]($ox + $L.cx * $scale - $b.X - $b.Width / 2), [single]($oy + $L.cy * $scale - $b.Y - $b.Height / 2)); $cp.Transform($m)
$g.FillPath($gold, $cp); $g.DrawPath($edge, $cp)

# title (centred text paths, so letter spacing and gradient are exact)
function Draw-Centered($text, $size, $style, $y, $brush, $spacing = 0, $outline = $null) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $x = 0.0
  foreach ($ch in $text.ToCharArray()) {
    $one = New-Object System.Drawing.Drawing2D.GraphicsPath
    $one.AddString([string]$ch, $family, [int]$style, [single]$size, (New-Object System.Drawing.PointF ([single]$x), 0), [System.Drawing.StringFormat]::GenericTypographic)
    if ($one.PointCount -gt 0) { $path.AddPath($one, $false) }  # a space has no outline
    if ($ch -eq ' ') { $x += $size * 0.3 + $spacing; continue }  # MeasureString ignores a lone space
    $x += $g.MeasureString([string]$ch, (New-Object System.Drawing.Font $family, ([single]$size), ([System.Drawing.FontStyle]$style), ([System.Drawing.GraphicsUnit]::Pixel)), (New-Object System.Drawing.PointF 0, 0), [System.Drawing.StringFormat]::GenericTypographic).Width + $spacing
  }
  $bb = $path.GetBounds(); $mm = New-Object System.Drawing.Drawing2D.Matrix
  $mm.Translate([single]($W / 2 - $bb.X - $bb.Width / 2), [single]($y - $bb.Y)); $path.Transform($mm)
  $g.FillPath($brush, $path)
  if ($outline) { $g.DrawPath($outline, $path) }
}
$titleGold = New-Gold (New-Object System.Drawing.Rectangle 0, 500, $W, 110)
Draw-Centered 'CONTINUOUS CIVILIZATION' 104 ([System.Drawing.FontStyle]::Regular) 505 $titleGold 10 (New-Object System.Drawing.Pen ((& $C 125 86 28)), 1.5)
$cream = New-Object System.Drawing.SolidBrush (& $C 228 223 211)
Draw-Centered 'One Civilization. One Timeline. No Forced Age Transitions.' 40 ([System.Drawing.FontStyle]::Italic) 650 $cream 0

# Age timeline
$y = 840; $x1 = 480; $x2 = 960; $x3 = 1440
$line = New-Object System.Drawing.Drawing2D.LinearGradientBrush (New-Object System.Drawing.Rectangle $x1, ($y - 4), ($x3 - $x1), 8), (& $C 201 137 74), (& $C 141 111 201), 0
$cb = New-Object System.Drawing.Drawing2D.ColorBlend 3; $cb.Colors = @((& $C 201 137 74), (& $C 79 143 191), (& $C 141 111 201)); $cb.Positions = @(0.0, 0.5, 1.0); $line.InterpolationColors = $cb
$g.FillRectangle($line, $x1, $y - 4, $x3 - $x1, 8)
$ages = @(@($x1, 'ANTIQUITY', (& $C 201 137 74), (& $C 217 164 107)), @($x2, 'EXPLORATION', (& $C 79 143 191), (& $C 127 179 220)), @($x3, 'MODERN', (& $C 141 111 201), (& $C 179 156 230)))
$ageFont = New-Object System.Drawing.Font $family, 30, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
$fmt = New-Object System.Drawing.StringFormat; $fmt.Alignment = 'Center'
foreach ($a in $ages) {
  $g.FillEllipse((New-Object System.Drawing.SolidBrush (& $C 12 15 23)), $a[0] - 19, $y - 19, 38, 38)
  $g.DrawEllipse((New-Object System.Drawing.Pen $a[2], 7), $a[0] - 19, $y - 19, 38, 38)
  $g.DrawString(($a[1].ToCharArray() -join [char]0x2009), $ageFont, (New-Object System.Drawing.SolidBrush $a[3]), (New-Object System.Drawing.RectangleF ($a[0] - 250), ($y + 38), 500, 50), $fmt)
}

$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$ep = New-Object System.Drawing.Imaging.EncoderParameters 1
$ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), 92L
$bmp.Save($Out, $codec, $ep); $g.Dispose(); $bmp.Dispose()
"Wrote $Out ($((Get-Item $Out).Length) bytes)"
