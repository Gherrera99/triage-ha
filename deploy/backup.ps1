<#
.SYNOPSIS
    Backup diario de la base de datos triage_db a la NAS del hospital.

.DESCRIPTION
    1. Genera un dump SQL del contenedor MySQL del stack triage-ha.
    2. Lo comprime con gzip.
    3. Monta la carpeta compartida \\192.168.1.10\informatica25 usando la credencial
       previamente almacenada en Windows Credential Manager (cmdkey).
    4. Copia el archivo a \\192.168.1.10\informatica25\backups\triage.
    5. Mantiene los últimos 14 días en local; en la NAS no rota (histórico completo).

.NOTES
    - La credencial debe haber sido guardada una vez con:
        cmdkey /add:192.168.1.10 /user:Administrador /pass
    - Este script lo ejecuta la tarea programada `triage-ha-backup-daily`
      registrada por setup-backup-task.ps1.
    - El proyecto debe estar en la ruta indicada por $ProjectPath.
#>

param(
    [string]$ProjectPath  = "C:\triage",
    [string]$LocalBackupDir = "C:\triage\backups",
    [string]$RemoteShare  = "\\192.168.1.10\informatica25",
    [string]$RemoteSubDir = "backups\triage",
    [int]$RetentionDays   = 14
)

$ErrorActionPreference = "Stop"
$timestamp = Get-Date -Format "yyyy-MM-dd_HHmm"
$dumpName  = "triage_$timestamp.sql"
$gzName    = "$dumpName.gz"
$logFile   = Join-Path $LocalBackupDir "backup.log"

function Log($msg) {
    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $msg"
    Write-Output $line
    Add-Content -Path $logFile -Value $line -Encoding utf8
}

# 0. Crear carpeta local si no existe
if (-not (Test-Path $LocalBackupDir)) {
    New-Item -ItemType Directory -Path $LocalBackupDir -Force | Out-Null
}

Log "=== Backup START ==="

try {
    Set-Location $ProjectPath

    # 1. Leer la pwd de MySQL del .env
    $envContent = Get-Content (Join-Path $ProjectPath ".env") -ErrorAction Stop
    $mysqlRootPwd = ($envContent | Select-String '^MYSQL_ROOT_PASSWORD=(.+)$').Matches.Groups[1].Value
    if (-not $mysqlRootPwd) {
        throw "No pude leer MYSQL_ROOT_PASSWORD de $ProjectPath\.env"
    }

    # 2. Dump dentro del contenedor y volcar a archivo local
    $localDump = Join-Path $LocalBackupDir $dumpName
    Log "Generando dump -> $localDump"
    docker compose exec -T mysql mysqldump -uroot "-p$mysqlRootPwd" --single-transaction --routines --triggers triage_db | Out-File -FilePath $localDump -Encoding ascii
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $localDump) -or (Get-Item $localDump).Length -eq 0) {
        throw "mysqldump falló o produjo archivo vacío"
    }

    # 3. Comprimir
    $localGz = Join-Path $LocalBackupDir $gzName
    Log "Comprimiendo -> $localGz"
    $inFs  = [System.IO.File]::OpenRead($localDump)
    $outFs = [System.IO.File]::Create($localGz)
    $gzFs  = New-Object System.IO.Compression.GzipStream($outFs, [System.IO.Compression.CompressionLevel]::Optimal)
    $inFs.CopyTo($gzFs)
    $gzFs.Close(); $outFs.Close(); $inFs.Close()
    Remove-Item $localDump -Force

    # 4. Montar share usando cmdkey ya registrado (no pasamos pwd inline)
    $remotePath = Join-Path $RemoteShare $RemoteSubDir
    Log "Montando share $RemoteShare"
    & net use $RemoteShare /persistent:no | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "No se pudo montar $RemoteShare. Verifica que cmdkey tenga la credencial registrada."
    }

    if (-not (Test-Path $remotePath)) {
        New-Item -ItemType Directory -Path $remotePath -Force | Out-Null
    }

    # 5. Copiar a NAS
    Log "Copiando a $remotePath"
    Copy-Item -Path $localGz -Destination $remotePath -Force

    # Verificar tamaño
    $localSize  = (Get-Item $localGz).Length
    $remoteSize = (Get-Item (Join-Path $remotePath $gzName)).Length
    if ($localSize -ne $remoteSize) {
        throw "Tamaño del archivo en NAS no coincide ($localSize vs $remoteSize)"
    }
    Log "Copia OK ($([math]::Round($localSize/1MB,2)) MB)"

    # 6. Rotación local
    $cutoff = (Get-Date).AddDays(-$RetentionDays)
    Get-ChildItem $LocalBackupDir -Filter "triage_*.sql.gz" | Where-Object { $_.LastWriteTime -lt $cutoff } | ForEach-Object {
        Log "Rotando local: $($_.Name)"
        Remove-Item $_.FullName -Force
    }

    # 7. Desmontar share
    & net use $RemoteShare /delete | Out-Null

    Log "=== Backup OK ==="
    exit 0

} catch {
    Log "ERROR: $($_.Exception.Message)"
    Log "=== Backup FAIL ==="
    exit 1
}
