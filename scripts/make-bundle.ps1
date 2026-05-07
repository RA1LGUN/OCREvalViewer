# Pack doc_exports/ + pdfs/ into a zip that can be dragged into the web app.
# Usage:
#   .\scripts\make-bundle.ps1                                  # pack everything
#   .\scripts\make-bundle.ps1 -DocFid 65d8ecd9-...             # only one doc
#   .\scripts\make-bundle.ps1 -Output my-bundle.zip
param(
    [string]$DocFid = "",
    [string]$Output = "sample-bundle.zip"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$manifestPath = Join-Path $root "doc_exports\manifest.json"
if (-not (Test-Path $manifestPath)) {
    throw "doc_exports\manifest.json not found. Put exported data there first."
}

$manifest = Get-Content -Raw $manifestPath | ConvertFrom-Json
if ($DocFid) {
    $manifest = @($manifest | Where-Object { $_.doc_fid -eq $DocFid })
    if ($manifest.Count -eq 0) { throw "doc_fid not found in manifest: $DocFid" }
}

$staging = Join-Path $env:TEMP ("ocr-bundle-" + [Guid]::NewGuid().ToString("N").Substring(0,8))
New-Item -ItemType Directory -Path $staging | Out-Null
New-Item -ItemType Directory -Path (Join-Path $staging "json") | Out-Null
New-Item -ItemType Directory -Path (Join-Path $staging "pdfs") | Out-Null

# Write the (possibly trimmed) manifest with original structure
$manifest | ConvertTo-Json -Depth 10 | Set-Content -Encoding UTF8 (Join-Path $staging "manifest.json")

foreach ($entry in $manifest) {
    $jsonName = Split-Path -Leaf $entry.json_file
    $srcJson = Join-Path $root "doc_exports\json\$jsonName"
    if (Test-Path $srcJson) {
        Copy-Item $srcJson (Join-Path $staging "json\$jsonName")
    } else {
        Write-Warning "missing json: $srcJson"
    }

    $pdfHits = Get-ChildItem -Recurse -Filter $entry.doc_name (Join-Path $root "pdfs") -ErrorAction SilentlyContinue
    if ($pdfHits) {
        Copy-Item $pdfHits[0].FullName (Join-Path $staging "pdfs\$($entry.doc_name)")
    } else {
        Write-Warning "missing pdf: $($entry.doc_name)"
    }
}

if (Test-Path $Output) { Remove-Item $Output }
Compress-Archive -Path (Join-Path $staging "*") -DestinationPath $Output -CompressionLevel Optimal
Remove-Item -Recurse -Force $staging

$size = (Get-Item $Output).Length
Write-Host ("OK: {0} ({1:N2} MB)" -f $Output, ($size / 1MB))
Write-Host "Drag it into the web app to load."
