$ErrorActionPreference = 'Stop'
$projectDir = Split-Path $PSScriptRoot -Parent
Set-Location $projectDir
$mysqlId = (docker compose ps -q mysql | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or -not $mysqlId) { throw 'La base de données doit être démarrée.' }
$apiId = (docker compose ps -q api1 | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or -not $apiId) { throw 'Le serveur doit être démarré.' }
$stamp = [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss-fff')
$destination = Join-Path $projectDir "backups/$stamp"
New-Item -ItemType Directory -Path $destination | Out-Null
if ($env:OS -eq 'Windows_NT') {
    $acl = Get-Acl -LiteralPath $destination
    $acl.SetAccessRuleProtection($true, $false)
    $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
    $rule = New-Object System.Security.AccessControl.FileSystemAccessRule($identity, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
    $acl.AddAccessRule($rule)
    Set-Acl -LiteralPath $destination -AclObject $acl
} else {
    chmod 700 $destination
    if ($LASTEXITCODE -ne 0) { throw 'Impossible de protéger le dossier de sauvegarde.' }
}
Copy-Item -LiteralPath (Join-Path $projectDir '.env') -Destination (Join-Path $destination 'configuration.env')
if ($env:OS -ne 'Windows_NT') {
    chmod 600 (Join-Path $destination 'configuration.env')
    if ($LASTEXITCODE -ne 0) { throw 'Impossible de protéger la configuration sauvegardée.' }
}

function Quote-ProcessArgument([string] $Value) {
    if ($Value -and $Value -notmatch '[\s"]') { return $Value }
    $escaped = [regex]::Replace($Value, '(\\*)"', '$1$1\"')
    $escaped = [regex]::Replace($escaped, '(\\+)$', '$1$1')
    return '"' + $escaped + '"'
}

function Save-DockerOutput([string[]] $CommandArguments, [string] $Path, [bool] $Compress = $false) {
    $info = New-Object System.Diagnostics.ProcessStartInfo
    $info.FileName = 'docker'
    $info.Arguments = (($CommandArguments | ForEach-Object { Quote-ProcessArgument $_ }) -join ' ')
    $info.UseShellExecute = $false
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    $info.CreateNoWindow = $true
    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $info
    $file = [System.IO.File]::Create($Path + '.partial')
    $stream = $file
    if ($Compress) { $stream = New-Object System.IO.Compression.GZipStream($file, [System.IO.Compression.CompressionMode]::Compress) }
    try {
        if (-not $process.Start()) { throw 'Impossible de démarrer Docker.' }
        $errors = $process.StandardError.ReadToEndAsync()
        $process.StandardOutput.BaseStream.CopyTo($stream)
        $process.WaitForExit()
        $diagnostic = $errors.GetAwaiter().GetResult()
        if ($process.ExitCode -ne 0) { throw "La sauvegarde a échoué : $diagnostic" }
    } finally {
        $stream.Dispose()
        $file.Dispose()
        $process.Dispose()
    }
    Move-Item -LiteralPath ($Path + '.partial') -Destination $Path
}

Write-Host 'Sauvegarde de la base…'
Save-DockerOutput -CommandArguments @('exec', $mysqlId, 'sh', '-c', 'MYSQL_PWD=$MYSQL_ROOT_PASSWORD exec mysqldump -uroot --single-transaction --routines --triggers --no-tablespaces qweillo') -Path (Join-Path $destination 'qweillo.sql.gz') -Compress $true
Write-Host 'Sauvegarde des fichiers…'
Save-DockerOutput -CommandArguments @('exec', $apiId, 'tar', '-czf', '-', '--exclude=uploads/.tmp', '-C', '/data', 'uploads') -Path (Join-Path $destination 'uploads.tar.gz')
Save-DockerOutput -CommandArguments @('exec', $apiId, 'tar', '-czf', '-', '-C', '/data', 'control') -Path (Join-Path $destination 'control.tar.gz')
$encoding = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Join-Path $destination 'INFO.txt'), "Qweillo`nDate UTC : $stamp`n", $encoding)
$lines = @('qweillo.sql.gz', 'uploads.tar.gz', 'control.tar.gz', 'configuration.env', 'INFO.txt') | ForEach-Object {
    $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $destination $_)).Hash.ToLowerInvariant()
    "$hash  $_"
}
[System.IO.File]::WriteAllText((Join-Path $destination 'SHA256SUMS'), ($lines -join "`n") + "`n", $encoding)
Write-Host "Sauvegarde terminée : $destination"
