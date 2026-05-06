<#
.SYNOPSIS
    Verifica si los puertos default del stack triage-ha estan ocupados en el servidor.

.DESCRIPTION
    El servidor del Hospital ya corre otro stack Docker + VMs. Este script revisa
    los 4 puertos que triage-ha mapea en docker-compose.yml y reporta si estan
    libres u ocupados, mostrando que proceso los tiene si es posible.

    Si algun puerto esta ocupado, edita docker-compose.yml cambiando el LADO
    IZQUIERDO del mapeo (ej. "8080:8080" -> "8090:8080") y re-corre este script
    hasta que todos esten libres.
#>

$ports = @(
    @{ Name = "API (Express)";      Port = 3000 },
    @{ Name = "MySQL host";         Port = 3307 },
    @{ Name = "Web (Vite)";         Port = 5173 },
    @{ Name = "Adminer (DB UI)";    Port = 8080 }
)

Write-Output ""
Write-Output "=== Chequeo de puertos para triage-ha ==="
Write-Output ""

foreach ($p in $ports) {
    $conn = Get-NetTCPConnection -LocalPort $p.Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($conn) {
        $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
        $procName = if ($proc) { $proc.ProcessName } else { "PID $($conn.OwningProcess)" }
        Write-Output ("[OCUPADO]  Puerto {0,-5} ({1}) -> {2}" -f $p.Port, $p.Name, $procName)
    } else {
        Write-Output ("[LIBRE]    Puerto {0,-5} ({1})" -f $p.Port, $p.Name)
    }
}

Write-Output ""
Write-Output "Si algun puerto esta OCUPADO, edita docker-compose.yml:"
Write-Output "  - Cambia el lado izquierdo del mapeo (host:container)"
Write-Output "  - Si cambias 3000 (API), actualiza tambien web/.env y api/.env"
Write-Output "  - Si cambias 5173 (Web), comunicaselo a los usuarios"
Write-Output ""
