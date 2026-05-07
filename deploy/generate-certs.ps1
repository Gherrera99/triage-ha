#requires -Version 5.1
<#
.SYNOPSIS
    Genera certificados TLS para el sistema triage-ha usando mkcert.

.DESCRIPTION
    Este script:
      1. Verifica que mkcert este instalado.
      2. Instala el CA raiz local de mkcert en el almacen de Windows
         (idempotente - si ya esta, no hace nada).
      3. Genera un certificado para los hostnames/IPs indicados.
      4. Copia los archivos resultantes a la carpeta -OutPath con nombres
         normalizados: server.crt, server.key, rootCA.pem.

    El rootCA.pem se redistribuye a las PCs cliente con el .bat de
    instalacion (ver deploy\instalar-certificado-cliente.bat).

.PARAMETER Hosts
    Lista de hostnames / IPs que cubre el certificado.
    Default: 192.168.1.30, localhost, 127.0.0.1

.PARAMETER OutPath
    Carpeta destino. Default: C:\triage-certs

.EXAMPLE
    .\deploy\generate-certs.ps1
    .\deploy\generate-certs.ps1 -Hosts @("192.168.1.30","triage.local") -OutPath "C:\triage-certs"

.NOTES
    Pre-requisito: instalar mkcert. Opciones:
      - Chocolatey:  choco install mkcert
      - Scoop:       scoop install mkcert
      - Manual:      https://github.com/FiloSottile/mkcert/releases
#>
[CmdletBinding()]
param(
    [string[]]$Hosts = @("192.168.1.30", "localhost", "127.0.0.1"),
    [string]$OutPath = "C:\triage-certs"
)

$ErrorActionPreference = "Stop"

function Write-Step($msg) {
    Write-Host "==> $msg" -ForegroundColor Cyan
}

# 1. Verificar mkcert
Write-Step "Verificando mkcert"
$mkcert = Get-Command mkcert -ErrorAction SilentlyContinue
if (-not $mkcert) {
    Write-Error @"
mkcert no esta instalado o no esta en PATH.

Instalalo con uno de estos metodos:
  choco install mkcert
  scoop install mkcert
  https://github.com/FiloSottile/mkcert/releases (binario manual)

Luego volve a correr este script.
"@
    exit 1
}
Write-Host "    mkcert encontrado: $($mkcert.Source)"

# 2. Instalar CA raiz local (idempotente)
Write-Step "Instalando CA raiz de mkcert en el almacen de Windows"
& mkcert -install
if ($LASTEXITCODE -ne 0) {
    Write-Error "mkcert -install fallo"
    exit 1
}

# 3. Localizar el CAROOT
$caroot = (& mkcert -CAROOT).Trim()
Write-Host "    CAROOT: $caroot"
if (-not (Test-Path "$caroot\rootCA.pem")) {
    Write-Error "No se encontro rootCA.pem en $caroot"
    exit 1
}

# 4. Crear carpeta destino
if (-not (Test-Path $OutPath)) {
    Write-Step "Creando carpeta destino: $OutPath"
    New-Item -ItemType Directory -Path $OutPath -Force | Out-Null
}

# 5. Generar el certificado en una carpeta temporal y mover/normalizar
Write-Step "Generando certificado para: $($Hosts -join ', ')"
$tmp = Join-Path $env:TEMP ("triage-mkcert-" + [Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $tmp | Out-Null
try {
    Push-Location $tmp
    & mkcert -cert-file "server.crt" -key-file "server.key" @Hosts
    if ($LASTEXITCODE -ne 0) {
        throw "mkcert fallo generando el certificado"
    }
    Pop-Location

    Move-Item -Force (Join-Path $tmp "server.crt") (Join-Path $OutPath "server.crt")
    Move-Item -Force (Join-Path $tmp "server.key") (Join-Path $OutPath "server.key")
    Copy-Item -Force (Join-Path $caroot "rootCA.pem") (Join-Path $OutPath "rootCA.pem")
}
finally {
    if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }
}

# 6. Resumen
Write-Step "Listo"
Write-Host ""
Write-Host "Archivos generados en $OutPath :" -ForegroundColor Green
Get-ChildItem $OutPath | Select-Object Name, Length, LastWriteTime | Format-Table -AutoSize

Write-Host @"

Siguientes pasos:

  1. Asegurate que el .env raiz tenga:
        CERTS_HOST_PATH=$($OutPath -replace '\\','/')

  2. Levanta (o reinicia) el stack:
        docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

  3. Para cada PC cliente del hospital, copia rootCA.pem y corre:
        deploy\instalar-certificado-cliente.bat
     (boton derecho > "Ejecutar como administrador")

  4. Reinicia Chrome/Edge en la PC cliente. El sitio debe mostrarse
     como seguro (candado).
"@ -ForegroundColor Yellow
