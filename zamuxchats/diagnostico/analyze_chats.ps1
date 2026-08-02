# analyze_chats.ps1 — Diagnostico masivo de chats Zamux (WhatsApp export)
# Procesa los 518 zips SIN cargar nada en el LLM. Escribe agregados a /diagnostico.
Add-Type -AssemblyName System.IO.Compression.FileSystem

$root   = Split-Path -Parent $PSScriptRoot   # ...\zamuxchats
$outDir = $PSScriptRoot
$zips   = Get-ChildItem -Path $root -Filter *.zip

# Regex de linea de mensaje: [M/D/YY, H:MM:SS AM/PM] Sender: text
$lineRx = [regex]'^\[(\d{1,2}/\d{1,2}/\d{2}),\s*(\d{1,2}:\d{2}:\d{2})\s*([AP]M)\]\s(.*?):\s?(.*)$'

# Marcadores de multimedia / sistema (ES)
$mediaImg  = '<imagen omitida>|<image omitted>'
$mediaAud  = '<audio omitido>|audio omitido|\.opus|PTT|nota de voz'
$mediaVid  = '<video omitido>|<video omitted>'
$mediaDoc  = '<documento omitido>|archivo adjunto|\.pdf|\.xlsx|\.xls|\.docx'
$mediaStk  = '<sticker omitido>|sticker omitido'
$mediaMult = '<Multimedia omitido>|Multimedia omitido'
$callRx    = '\[Llamada\]|\[Videollamada\]|llamada perdida'
$locRx     = 'Ubicaci.n:|maps\.google|location'

# Keywords de intencion
$kw = @{
  precio      = 'precio|cotiz|cu[aá]nto|cu[aá]nto vale|valor|cuesta|vale\b'
  envio       = 'domicilio|env[ií]o|mensajer|picap|rappi|transportadora|env[ií]a\b|guia|gu[ií]a'
  pago        = 'comprobante|pago|transferen|nequi|daviplata|bancolombia|consignaci|pagu[eé]|abono'
  stock       = 'disponib|stock|hay\b|tienen|queda|inventario|referencia|c[oó]digo'
  humano      = 'asesor|humano|persona|hablar con|comunicar'
  horario     = 'horario|abierto|cerrado|atienden|atenci[oó]n|domingo|festivo'
  sede        = 'sede|tienda|direcci[oó]n|ubicad|santo tomas|javeriana|bulevar|presencial|local'
  factura     = 'factura|orden de compra|\bOC\b|RUT|NIT|electr[oó]nica|cotizaci[oó]n formal'
  saludo_bot  = 'Gracias por tu mensaje.*horario'
}

$rows = @()
$cannedCount = @{}
$totalMsgs = 0
$i = 0

foreach ($z in $zips) {
  $i++
  $txt = $null
  try {
    $zip = [System.IO.Compression.ZipFile]::OpenRead($z.FullName)
    $entry = $zip.Entries | Where-Object { $_.FullName -eq 'chat.txt' } | Select-Object -First 1
    if ($entry) {
      $sr = New-Object System.IO.StreamReader($entry.Open(), [System.Text.Encoding]::UTF8)
      $txt = $sr.ReadToEnd(); $sr.Close()
    }
    $zip.Dispose()
  } catch { continue }
  if (-not $txt) { continue }

  $lines = $txt -split "`r?`n"
  $msgsCust = 0; $msgsBiz = 0
  $imgCust = 0; $audCust = 0; $vidCust = 0; $docCust = 0; $stk = 0; $mult = 0
  $calls = 0; $loc = 0
  $firstDate = $null; $lastDate = $null
  $lastSender = $null; $custText = New-Object System.Text.StringBuilder
  $fullLower = $txt.ToLower()

  foreach ($ln in $lines) {
    $m = $lineRx.Match($ln)
    if (-not $m.Success) { continue }
    $date = $m.Groups[1].Value
    $sender = $m.Groups[4].Value
    $body = $m.Groups[5].Value
    if (-not $firstDate) { $firstDate = $date }
    $lastDate = $date
    $isBiz = ($sender -eq 'Tu') -or ($sender.Length -eq 2 -and [int][char]$sender[0] -eq 84 -and [int][char]$sender[1] -eq 250)
    $isSys = ($sender -eq '-')
    if ($isSys) {
      if ($body -match $callRx) { $calls++ }
      continue
    }
    if ($isBiz) {
      $msgsBiz++
      $lastSender = 'biz'
      # contar respuestas canned (mensajes largos del negocio, se repiten literal)
      if ($body.Length -gt 60) {
        $key = ($body.Substring(0,[Math]::Min(120,$body.Length))).Trim()
        if ($cannedCount.ContainsKey($key)) { $cannedCount[$key]++ } else { $cannedCount[$key] = 1 }
      }
    } else {
      $msgsCust++
      $lastSender = 'cust'
      [void]$custText.Append(' ').Append($body.ToLower())
    }
    # media
    if ($body -match $mediaImg)  { if (-not $isBiz) { $imgCust++ } }
    if ($body -match $mediaAud)  { if (-not $isBiz) { $audCust++ } }
    if ($body -match $mediaVid)  { if (-not $isBiz) { $vidCust++ } }
    if ($body -match $mediaDoc)  { if (-not $isBiz) { $docCust++ } }
    if ($body -match $mediaStk)  { $stk++ }
    if ($body -match $mediaMult) { $mult++ }
    if ($body -match $locRx)     { $loc++ }
  }

  $total = $msgsCust + $msgsBiz
  $totalMsgs += $total

  # clasificacion de intenciones (sobre texto completo)
  $intents = @()
  foreach ($k in $kw.Keys) { if ($fullLower -match $kw[$k].ToLower()) { $intents += $k } }

  # heuristicas de tipo/ruido/outcome
  $isProvB2B = ($fullLower -match 'orden de compra|\boc\b|proveedor|cotizaci.n formal|nit|rut')
  $noise = ($total -le 2)                       # muy corto = ruido probable
  $onlyBot = ($msgsCust -le 1 -and $msgsBiz -ge 1)  # cliente escribio 1 y solo respondio el bot
  $unfinished = ($lastSender -eq 'cust')        # ultimo mensaje del cliente sin respuesta = quedo colgado
  $needsHuman = ($fullLower -match 'comprobante|pago|transferen|nequi|daviplata|consignaci|mensajero.*foto|foto.*mensajero')

  $rows += [pscustomobject]@{
    file        = $z.Name
    total       = $total
    cust        = $msgsCust
    biz         = $msgsBiz
    img_cust    = $imgCust
    aud_cust    = $audCust
    vid_cust    = $vidCust
    doc_cust    = $docCust
    calls       = $calls
    loc         = $loc
    first       = $firstDate
    last        = $lastDate
    intents     = ($intents -join '|')
    b2b_prov    = $isProvB2B
    noise       = $noise
    only_bot    = $onlyBot
    unfinished  = $unfinished
    needs_human = $needsHuman
  }
}

# ---- Export index CSV ----
$rows | Sort-Object total -Descending | Export-Csv -Path (Join-Path $outDir '_chats_index.csv') -NoTypeInformation -Encoding UTF8

# ---- Canned responses (top repetidas) ----
$canned = $cannedCount.GetEnumerator() | Where-Object { $_.Value -ge 3 } | Sort-Object Value -Descending
$cannedOut = foreach ($c in $canned) { "[$($c.Value)x] $($c.Key)" }
$cannedOut | Out-File -FilePath (Join-Path $outDir '_canned_responses.txt') -Encoding UTF8

# ---- Stats globales ----
$intentTally = @{}
foreach ($r in $rows) { foreach ($it in ($r.intents -split '\|')) { if ($it) { if ($intentTally.ContainsKey($it)) { $intentTally[$it]++ } else { $intentTally[$it]=1 } } } }

$stats = [ordered]@{
  total_chats        = $rows.Count
  total_messages     = $totalMsgs
  chats_con_imagen   = ($rows | Where-Object { $_.img_cust -gt 0 }).Count
  chats_con_audio    = ($rows | Where-Object { $_.aud_cust -gt 0 }).Count
  chats_con_video    = ($rows | Where-Object { $_.vid_cust -gt 0 }).Count
  chats_con_doc      = ($rows | Where-Object { $_.doc_cust -gt 0 }).Count
  chats_con_llamada  = ($rows | Where-Object { $_.calls -gt 0 }).Count
  chats_con_ubicacion= ($rows | Where-Object { $_.loc -gt 0 }).Count
  chats_ruido        = ($rows | Where-Object { $_.noise }).Count
  chats_solo_bot     = ($rows | Where-Object { $_.only_bot }).Count
  chats_sin_cerrar   = ($rows | Where-Object { $_.unfinished }).Count
  chats_b2b_prov     = ($rows | Where-Object { $_.b2b_prov }).Count
  chats_needs_human  = ($rows | Where-Object { $_.needs_human }).Count
  intents            = $intentTally
}
$stats | ConvertTo-Json -Depth 4 | Out-File -FilePath (Join-Path $outDir '_stats_global.json') -Encoding UTF8

Write-Output "OK. Procesados $($rows.Count) chats, $totalMsgs mensajes."
Write-Output "Salidas en: $outDir"
