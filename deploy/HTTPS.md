# HTTPS en el sistema triage-ha (mkcert)

Esta guía explica cómo el sistema sirve HTTPS sin Active Directory ni dominio público, usando **mkcert** para generar un CA raíz local que se instala en cada PC del hospital.

## Por qué este enfoque

- El sistema corre en una IP de LAN privada (`192.168.1.30`). Let's Encrypt no puede emitir certificados para IPs ni dominios privados sin DNS público.
- El hospital no tiene Active Directory, así que no podemos distribuir un CA por GPO.
- mkcert genera un CA raíz "casero" + certificados para los hosts/IPs que indiquemos. Si instalamos ese CA en cada PC cliente, los navegadores muestran candado verde sin advertencias.

## Arquitectura

```
servidor (192.168.1.30)
  C:\triage-certs\
    server.crt      <-- emitido por el CA local de mkcert para 192.168.1.30
    server.key
    rootCA.pem      <-- CA raiz, se redistribuye a cada PC cliente

  docker-compose.prod.yml monta C:\triage-certs:/certs:ro
  api  (Express)  arranca en HTTPS si /certs/server.{crt,key} existen
  web  (Vite)     idem

PC cliente (10-20 maquinas en el hospital)
  Una sola vez: ejecutar instalar-certificado-cliente.bat como admin
                -> instala rootCA.pem en "Entidades de certificacion
                   raiz de confianza" de Windows
                -> Chrome / Edge / IE confian en https://192.168.1.30:5173
```

## En el servidor (una sola vez)

1. **Instalar mkcert**:
   ```powershell
   choco install mkcert
   ```
   o descargar el binario de https://github.com/FiloSottile/mkcert/releases y dejarlo en el PATH.

2. **Generar los certificados** (genera `C:\triage-certs\` con `server.crt`, `server.key`, `rootCA.pem`):
   ```powershell
   .\deploy\generate-certs.ps1
   ```

   Si el servidor del hospital cambia de IP en el futuro, regenerar con:
   ```powershell
   .\deploy\generate-certs.ps1 -Hosts @("192.168.1.30","triage.local","localhost","127.0.0.1")
   ```

3. **Verificar el `.env` raíz**: la línea
   ```
   CERTS_HOST_PATH=C:/triage-certs
   ```
   debe estar presente (con `/`, NO `\`). Está en `deploy/root.env.production.example`.

4. **Levantar / reiniciar el stack**:
   ```powershell
   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
   ```

   Verificar logs:
   ```powershell
   docker compose logs api | Select-String "API on"
   docker compose logs web | Select-String "Local"
   ```
   Deben mostrar `https://`.

5. **Probar desde el navegador del propio servidor** (que ya tiene el CA raíz instalado por `mkcert -install`):
   ```
   https://192.168.1.30:5173
   ```
   Debe mostrar candado.

## En cada PC cliente (una sola vez por máquina)

1. Copiar a la PC los dos archivos:
   - `rootCA.pem`  (de `C:\triage-certs\` del servidor)
   - `instalar-certificado-cliente.bat`  (de `deploy\` del repo)

   Pueden ir en cualquier carpeta, pero los DOS archivos deben estar en la **misma carpeta**.

2. Clic DERECHO sobre `instalar-certificado-cliente.bat` → **Ejecutar como administrador**.

3. Aceptar el UAC. El script imprime "LISTO" si se instaló bien.

4. Cerrar y reabrir Chrome / Edge.

5. Entrar a `https://192.168.1.30:5173` — debe mostrar candado.

> Si la PC ya tenía Firefox y se quiere usarlo, Firefox tiene su propio almacén de CAs y necesita pasos adicionales. La recomendación oficial del hospital es usar Edge o Chrome.

## Renovación

Los certificados de mkcert duran ~825 días (≈ 2 años y 3 meses). Para renovar:

1. En el servidor: `.\deploy\generate-certs.ps1` (sobreescribe `server.crt` / `server.key`).
2. Reiniciar el stack: `docker compose restart api web`.

**No hace falta tocar las PCs cliente** mientras no se cambie el CA raíz. mkcert reusa el mismo `rootCA.pem` indefinidamente.

## Volver a HTTP plano (rollback)

Si por algún motivo se necesita desactivar HTTPS:

1. Quitar el bind mount de `/certs` en `docker-compose.prod.yml` (o vaciar `CERTS_HOST_PATH` apuntando a una carpeta vacía).
2. Cambiar `VITE_API_URL`, `VITE_WS_URL` en `web/.env` y `CORS_ORIGIN` en `api/.env` a `http://`.
3. `docker compose up -d --build`.

El código detecta automáticamente la ausencia de certificados y arranca en HTTP plano.
