$ErrorActionPreference = 'Stop'
$projectDir = $PSScriptRoot
Set-Location $projectDir
if ($args -contains '--help') {
    Write-Host 'Usage : .\qweillo.ps1 [--yes] [--name Nom] [--url http://localhost:8080]'
    Write-Host 'Sans argument : assistant interactif au clavier. --yes : valeurs locales par défaut.'
    Write-Host 'Actions : --action start|status|backup|stop'
    exit 0
}
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'Installez Docker Desktop, démarrez-le, puis relancez cette commande.'
}
docker compose version *> $null
if ($LASTEXITCODE -ne 0) { throw 'Docker Compose v2 ou ultérieur est requis.' }
docker info *> $null
if ($LASTEXITCODE -ne 0) { throw 'Démarrez Docker Desktop, puis relancez cette commande.' }
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$useNode = $false
if ($nodeCommand) {
    $nodeVersion = (node --version).TrimStart('v').Split('.')[0]
    $useNode = [int]$nodeVersion -ge 22
}
if ($useNode) {
    node scripts/setup.mjs --local-only @args
} else {
    $terminalOptions = @()
    if (-not [Console]::IsInputRedirected -and -not [Console]::IsOutputRedirected) { $terminalOptions = @('-it') }
    docker run --rm @terminalOptions -v "${projectDir}:/app" -w /app node:22-alpine node scripts/setup.mjs --local-only @args
}
if ($LASTEXITCODE -eq 130) { exit 130 }
if ($LASTEXITCODE -ne 0) { throw 'La configuration a échoué.' }
$mode = (Get-Content .runtime/start-mode -Raw).Trim()
$action = (Get-Content .runtime/action -Raw).Trim()
if ($action -eq 'exit') { exit 0 }
if ($mode -eq 'production') { throw 'Le profil Internet utilise un serveur Linux.' }
if ($action -eq 'status') {
    docker compose ps
    if ($LASTEXITCODE -ne 0) { throw 'Impossible de lire l''état des services.' }
    Write-Host "Adresse de l’instance : $((Get-Content .runtime/start-url -Raw).Trim())"
    exit 0
}
if ($action -eq 'stop') {
    docker compose stop
    if ($LASTEXITCODE -ne 0) { throw 'L''arrêt a échoué.' }
    Write-Host 'Instance arrêtée. Les données sont conservées.'
    exit 0
}
if ($action -eq 'backup') {
    & (Join-Path $projectDir "scripts/backup.ps1")
    if ($LASTEXITCODE -ne 0) { throw 'La sauvegarde a échoué.' }
    exit 0
}
if ($action -ne 'start') { throw 'Action inconnue. Relancez cette commande.' }
Write-Host 'Préparation du serveur, des données et de la voix…'
Write-Host 'La première installation peut prendre quelques minutes.'
docker compose up -d --build --wait --wait-timeout 180 *> .runtime/install.log
if ($LASTEXITCODE -ne 0) {
    Get-Content .runtime/install.log -Tail 25
    throw 'Le démarrage a échoué. Le journal est disponible dans .runtime/install.log.'
}
$url = (Get-Content .runtime/start-url -Raw).Trim()
Write-Host "Qweillo est prêt : $url"
Write-Host 'Créez votre compte. Le menu Instances permet de partager son adresse et son code QR.'
Write-Host 'Relancez cette commande pour gérer votre installation.'
Start-Process $url
