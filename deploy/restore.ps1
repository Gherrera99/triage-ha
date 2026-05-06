<#
.SYNOPSIS
    Restaura la base de datos triage_db desde un dump .sql.gz.

.DESCRIPTION
    Operación destructiva — DROP/RECREATE de triage_db y carga del dump indicado.
    Pide confirmación interactiva. Detiene los contenedores api/web durante la operación
    para evitar escrituras concurrentes.

.PARAMETER BackupFile
    Ruta al archivo .sql.gz a restaurar. Puede ser local o UNC.

.PARAMETER ProjectPath
    Ruta del proyecto. Default: C:\triage

.EXAMPLE
    .\deploy\restore.ps1 -BackupFile "\\192.168.1.10\informatica25\backups\triage\triage_2026-05-10_0200.sql.gz"
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$BackupFile,
    [string]$ProjectPath = "C:\triage"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $BackupFile)) {
    Write-Output "ERROR: No existe el archivo $BackupFile"
    exit 1
}

Set-Location $ProjectPath

# Leer pwd MySQL
$envContent = Get-Content (Join-Path $ProjectPath ".env") -ErrorAction Stop
$mysqlRootPwd = ($envContent | Select-String '^MYSQL_ROOT_PASSWORD=(.+)$').Matches.Groups[1].Value
if (-not $mysqlRootPwd) {
    Write-Output "ERROR: No pude leer MYSQL_ROOT_PASSWORD de $ProjectPath\.env"
    exit 1
}

Write-Output ""
Write-Output "=========================================================="
Write-Output " RESTAURAR BASE DE DATOS - OPERACION DESTRUCTIVA"
Write-Output "=========================================================="
Write-Output " Archivo:   $BackupFile"
Write-Output " Proyecto:  $ProjectPath"
Write-Output " Esto BORRARA todos los datos actuales y los reemplazara"
Write-Output " con los del backup. Los contenedores api y web se"
Write-Output " detendran durante la operacion."
Write-Output "=========================================================="
$confirm = Read-Host "Escribe RESTAURAR para continuar"
if ($confirm -ne "RESTAURAR") {
    Write-Output "Cancelado."
    exit 0
}

# Descomprimir a archivo temporal
$tmpSql = Join-Path $env:TEMP "triage_restore_$(Get-Date -Format 'yyyyMMddHHmmss').sql"
Write-Output ""
Write-Output "Descomprimiendo dump..."
$inFs = [System.IO.File]::OpenRead($BackupFile)
$gzFs = New-Object System.IO.Compression.GzipStream($inFs, [System.IO.Compression.CompressionMode]::Decompress)
$outFs = [System.IO.File]::Create($tmpSql)
$gzFs.CopyTo($outFs)
$outFs.Close(); $gzFs.Close(); $inFs.Close()

try {
    Write-Output "Deteniendo api y web..."
    docker compose stop api web | Out-Null

    Write-Output "Recreando triage_db..."
    docker compose exec -T mysql mysql -uroot "-p$mysqlRootPwd" -e "DROP DATABASE IF EXISTS triage_db; CREATE DATABASE triage_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

    Write-Output "Cargando dump..."
    Get-Content $tmpSql | docker compose exec -T mysql mysql -uroot "-p$mysqlRootPwd" triage_db
    if ($LASTEXITCODE -ne 0) {
        throw "mysql restore falló (exit $LASTEXITCODE)"
    }

    Write-Output "Restableciendo api y web..."
    docker compose start api web | Out-Null

    Write-Output ""
    Write-Output "Restauracion OK. Verifica con:"
    Write-Output "  docker compose exec mysql mysql -utriage -p triage_db -e ""SELECT COUNT(*) AS users FROM User;"""

} finally {
    Remove-Item $tmpSql -Force -ErrorAction SilentlyContinue
}
