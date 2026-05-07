@echo off
REM ============================================================
REM  Sistema Triage - Hospital de la Amistad
REM  Instalacion del certificado raiz en una PC cliente.
REM
REM  Uso: clic derecho > "Ejecutar como administrador"
REM
REM  Que hace:
REM    Instala rootCA.pem en el almacen "Entidades de certificacion
REM    raiz de confianza" de Windows. A partir de ese momento Chrome,
REM    Edge e Internet Explorer confian en los certificados emitidos
REM    para https://192.168.1.30:5173 (el sistema deja de aparecer
REM    como "No seguro").
REM
REM  Pre-requisito:
REM    El archivo rootCA.pem debe estar en la MISMA carpeta que este
REM    .bat. Lo entrega el equipo de TI junto con este instalador.
REM ============================================================

setlocal

REM Verificar privilegios de administrador
net session >nul 2>&1
if errorlevel 1 (
    echo.
    echo [ERROR] Este script debe ejecutarse como Administrador.
    echo.
    echo   Cierra esta ventana, hace clic DERECHO sobre el archivo
    echo   "instalar-certificado-cliente.bat" y elegi
    echo   "Ejecutar como administrador".
    echo.
    pause
    exit /b 1
)

set "CERT=%~dp0rootCA.pem"

if not exist "%CERT%" (
    echo.
    echo [ERROR] No se encuentra rootCA.pem en la carpeta:
    echo   %~dp0
    echo.
    echo Pedile al equipo de TI el archivo rootCA.pem y copialo
    echo junto a este .bat antes de volver a ejecutarlo.
    echo.
    pause
    exit /b 1
)

echo.
echo ==> Instalando certificado raiz del Sistema Triage...
echo     Origen: %CERT%
echo.

certutil -addstore -f "ROOT" "%CERT%"
if errorlevel 1 (
    echo.
    echo [ERROR] certutil fallo. Revisa el mensaje de arriba.
    echo.
    pause
    exit /b 1
)

echo.
echo ============================================================
echo  LISTO
echo ============================================================
echo.
echo  El certificado raiz quedo instalado en este equipo.
echo.
echo  Cierra TODAS las ventanas de Chrome / Edge y volve a abrirlas.
echo  Cuando entres a https://192.168.1.30:5173 ya no debe aparecer
echo  "No seguro" - veras el icono de candado.
echo.

pause
endlocal
