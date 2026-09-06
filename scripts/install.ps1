$ErrorActionPreference = 'Stop'
$powerShell = (Get-Process -Id $PID).Path
$destination = if ($env:QWEILLO_INSTALL_DIR) { $env:QWEILLO_INSTALL_DIR } else { Join-Path ([Environment]::GetFolderPath('UserProfile')) 'qweillo' }
if (Test-Path $destination) {
    $entrypoint = Join-Path $destination 'qweillo.ps1'
    if (-not (Test-Path $entrypoint)) { throw "$destination existe déjà. Choisissez un autre dossier avec QWEILLO_INSTALL_DIR." }
    & $powerShell -NoProfile -ExecutionPolicy Bypass -File $entrypoint @args
    return
}
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Installez Docker Desktop, démarrez-le, puis relancez cette commande.' }
$temporary = Join-Path ([IO.Path]::GetTempPath()) ('qweillo-' + [Guid]::NewGuid().ToString('N'))
try {
    New-Item -ItemType Directory -Path $temporary | Out-Null
    $archive = Join-Path $temporary 'qweillo.zip'
    Invoke-WebRequest -Uri 'https://github.com/RedBlockers/qweillo/archive/refs/heads/dev-leka.zip' -OutFile $archive
    Expand-Archive -Path $archive -DestinationPath (Join-Path $temporary 'source')
    $source = Get-ChildItem (Join-Path $temporary 'source') -Directory | Select-Object -First 1
    if (-not $source -or -not (Test-Path (Join-Path $source.FullName 'qweillo.ps1'))) { throw 'Le téléchargement est incomplet.' }
    Move-Item -Path $source.FullName -Destination $destination
    & $powerShell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $destination 'qweillo.ps1') @args
} finally {
    if (Test-Path $temporary) { Remove-Item -LiteralPath $temporary -Recurse -Force }
}
