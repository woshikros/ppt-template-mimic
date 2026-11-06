param([Parameter(Mandatory=$true)][string]$InputPptx,[Parameter(Mandatory=$true)][string]$OutputDirectory)
$ErrorActionPreference='Stop'
$resolvedInput=(Resolve-Path -LiteralPath $InputPptx).Path
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$resolvedOutput=(Resolve-Path -LiteralPath $OutputDirectory).Path
$app=$null;$deck=$null;$completed=$false
try {
  $app=New-Object -ComObject PowerPoint.Application
  $deck=$app.Presentations.Open($resolvedInput,-1,0,0)
  $pixelHeight=[int][Math]::Round(1600*$deck.PageSetup.SlideHeight/$deck.PageSetup.SlideWidth)
  for($i=1;$i -le $deck.Slides.Count;$i++){$deck.Slides.Item($i).Export((Join-Path $resolvedOutput ('slide-'+$i+'.png')),'PNG',1600,$pixelHeight)}
  $completed=$true
  [pscustomobject]@{Slides=$deck.Slides.Count;Width=$deck.PageSetup.SlideWidth;Height=$deck.PageSetup.SlideHeight;Rendered=$resolvedOutput}|ConvertTo-Json
} finally {
  if($null -ne $deck){try{$deck.Close()}catch{if(-not $completed){Write-Warning $_}};[void][Runtime.InteropServices.Marshal]::ReleaseComObject($deck)}
  if($null -ne $app){try{$app.Quit()}catch{if(-not $completed){Write-Warning $_}};[void][Runtime.InteropServices.Marshal]::ReleaseComObject($app)}
}
