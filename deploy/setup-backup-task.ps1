<#
.SYNOPSIS
    Registra la tarea programada `triage-ha-backup-daily` en Windows Task Scheduler.

.DESCRIPTION
    La tarea ejecuta deploy\backup.ps1 todos los días a las 02:00 AM.
    Corre como SYSTEM para sobrevivir cierres de sesión y reinicios.
    Se ejecuta una sola vez como Administrador.

.NOTES
    Antes de ejecutar este script, registra la credencial de la NAS:
        cmdkey /add:192.168.1.10 /user:Administrador /pass
    (PowerShell pedirá la pwd interactivamente).
#>

param(
    [string]$ProjectPath = "C:\triage",
    [string]$Time        = "02:00",
    [string]$TaskName    = "triage-ha-backup-daily"
)

$ErrorActionPreference = "Stop"

# Verificar que Administrador
$current = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($current)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)) {
    Write-Output "ERROR: Ejecuta este script como Administrador."
    exit 1
}

$scriptPath = Join-Path $ProjectPath "deploy\backup.ps1"
if (-not (Test-Path $scriptPath)) {
    Write-Output "ERROR: No existe $scriptPath"
    exit 1
}

# Eliminar la tarea si ya existe
$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Output "Eliminando tarea previa $TaskName..."
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

$action    = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -NoProfile -File `"$scriptPath`""
$trigger   = New-ScheduledTaskTrigger -Daily -At $Time
$principalSys = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings  = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopOnIdleEnd -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 1)

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principalSys -Settings $settings -Description "Backup diario de triage_db a la NAS del hospital"

Write-Output ""
Write-Output "Tarea $TaskName registrada. Verifica con:"
Write-Output "  Get-ScheduledTask -TaskName $TaskName"
Write-Output ""
Write-Output "Para ejecutarla manualmente la primera vez:"
Write-Output "  Start-ScheduledTask -TaskName $TaskName"
Write-Output ""
Write-Output "Logs en: $ProjectPath\backups\backup.log"
