<#
.SYNOPSIS
  Prepara una foto para el sitio de Meraki: la endereza, la reduce y crea dos tamaños.

.DESCRIPTION
  Crea dos archivos JPG livianos (pensados para que la página cargue rápido con datos móviles):
    <nombre>-m.jpg   miniatura   (lado más largo: 640 px)  -> tarjetas y listas
    <nombre>-g.jpg   grande      (lado más largo: 1400 px) -> página de la obra y zoom
  Nunca agranda una imagen: si la foto original es más chica, se queda con su tamaño.

.EXAMPLE
  # Una obra
  .\tools\optimizar-imagen.ps1 -Entrada "C:\fotos\venom.jpg" -Nombre venom -Tipo obras

  # El retrato de un artista
  .\tools\optimizar-imagen.ps1 -Entrada "C:\fotos\alana.jpg" -Nombre alana-cortes -Tipo artistas

  # Recortar primero (x, y, ancho, alto, en píxeles de la foto original)
  .\tools\optimizar-imagen.ps1 -Entrada foto.jpg -Nombre gato -Recorte 30,590,380,380
#>
param(
  [Parameter(Mandatory = $true)][string]$Entrada,
  [Parameter(Mandatory = $true)][string]$Nombre,
  [ValidateSet('obras', 'artistas', 'inspiracion')][string]$Tipo = 'obras',
  [int[]]$Recorte,
  [int]$Calidad = 82
)

Add-Type -AssemblyName System.Drawing

if ($Nombre -notmatch '^[a-z0-9]+(-[a-z0-9]+)*$') {
  throw "El nombre debe ir en minúsculas, sin tildes ni espacios (usa guiones). Ejemplo: el-mundo-de-colores"
}

$raiz = Split-Path -Parent $PSScriptRoot
$carpeta = Join-Path $raiz "public\meraki\img\$Tipo"
New-Item -ItemType Directory -Force -Path $carpeta | Out-Null

$origen = [System.Drawing.Bitmap]::FromFile((Resolve-Path $Entrada))

# Los celulares guardan la foto "acostada" y anotan la rotación en el archivo (EXIF). La aplicamos.
if ($origen.PropertyIdList -contains 0x0112) {
  $orientacion = [BitConverter]::ToUInt16($origen.GetPropertyItem(0x0112).Value, 0)
  switch ($orientacion) {
    3 { $origen.RotateFlip([System.Drawing.RotateFlipType]::Rotate180FlipNone) }
    6 { $origen.RotateFlip([System.Drawing.RotateFlipType]::Rotate90FlipNone) }
    8 { $origen.RotateFlip([System.Drawing.RotateFlipType]::Rotate270FlipNone) }
  }
}

if ($Recorte -and $Recorte.Count -eq 4) {
  $rect = New-Object System.Drawing.Rectangle $Recorte[0], $Recorte[1], $Recorte[2], $Recorte[3]
  $recortada = $origen.Clone($rect, $origen.PixelFormat)
  $origen.Dispose()
  $origen = $recortada
}

$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$parametros = New-Object System.Drawing.Imaging.EncoderParameters 1
$parametros.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), ([long]$Calidad)

function Guardar([System.Drawing.Bitmap]$bmp, [int]$ladoMaximo, [string]$sufijo) {
  $escala = [Math]::Min(1.0, $ladoMaximo / [Math]::Max($bmp.Width, $bmp.Height))
  $w = [int][Math]::Round($bmp.Width * $escala)
  $h = [int][Math]::Round($bmp.Height * $escala)
  $nuevo = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($nuevo)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.DrawImage($bmp, 0, 0, $w, $h)
  $g.Dispose()
  $ruta = Join-Path $carpeta "$Nombre-$sufijo.jpg"
  $nuevo.Save($ruta, $codec, $parametros)
  $nuevo.Dispose()
  $kb = [Math]::Round((Get-Item $ruta).Length / 1KB)
  Write-Host ("  {0}  {1}x{2}  {3} KB" -f (Split-Path $ruta -Leaf), $w, $h, $kb)
}

Write-Host "Listo, imágenes creadas en $carpeta"
Guardar $origen 640 'm'
Guardar $origen 1400 'g'
$origen.Dispose()
