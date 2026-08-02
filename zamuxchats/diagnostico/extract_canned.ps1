# extract_canned.ps1 — Une lineas de continuacion y cuenta mensajes del negocio repetidos literalmente
Add-Type -AssemblyName System.IO.Compression.FileSystem
$root   = Split-Path -Parent $PSScriptRoot
$outDir = $PSScriptRoot
$zips   = Get-ChildItem -Path $root -Filter *.zip
$lineRx = [regex]'^\[(\d{1,2}/\d{1,2}/\d{2}),\s*(\d{1,2}:\d{2}:\d{2})\s*([AP]M)\]\s(.*?):\s?(.*)$'

$tally = @{}
foreach ($z in $zips) {
  try {
    $zip = [System.IO.Compression.ZipFile]::OpenRead($z.FullName)
    $entry = $zip.Entries | Where-Object { $_.FullName -eq 'chat.txt' } | Select-Object -First 1
    if (-not $entry) { $zip.Dispose(); continue }
    $sr = New-Object System.IO.StreamReader($entry.Open(), [System.Text.Encoding]::UTF8)
    $txt = $sr.ReadToEnd(); $sr.Close(); $zip.Dispose()
  } catch { continue }

  $lines = $txt -split "`r?`n"
  $curSender = $null; $curBody = $null
  $msgs = New-Object System.Collections.ArrayList
  foreach ($ln in $lines) {
    $m = $lineRx.Match($ln)
    if ($m.Success) {
      if ($curSender) { [void]$msgs.Add(@($curSender,$curBody)) }
      $curSender = $m.Groups[4].Value
      $curBody = $m.Groups[5].Value
    } else {
      if ($curSender) { $curBody = $curBody + " " + $ln }
    }
  }
  if ($curSender) { [void]$msgs.Add(@($curSender,$curBody)) }
  foreach ($pair in $msgs) {
    $s = $pair[0]; $b = $pair[1]
    $isBiz = ($s -eq 'Tu') -or ($s.Length -eq 2 -and [int][char]$s[0] -eq 84 -and [int][char]$s[1] -eq 250)
    if ($isBiz) {
      $norm = ($b -replace '\s+',' ').Trim()
      if ($norm.Length -ge 40) {
        $key = $norm.Substring(0,[Math]::Min(200,$norm.Length))
        if ($tally.ContainsKey($key)) { $tally[$key]++ } else { $tally[$key]=1 }
      }
    }
  }
}

Write-Output ("Total keys en tally: " + $tally.Count)
$top = $tally.GetEnumerator() | Where-Object { $_.Value -ge 4 } | Sort-Object Value -Descending
$out = foreach ($c in $top) { "==== repetido $($c.Value) veces ====`r`n$($c.Key)`r`n" }
$out | Out-File -FilePath (Join-Path $outDir '_canned_responses.txt') -Encoding UTF8
Write-Output ("Plantillas >=4x: " + ($top | Measure-Object).Count)
