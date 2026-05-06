# Runbook de despliegue — Hospital de la Amistad

Este documento describe el despliegue del sistema **triage-ha** en el servidor del Hospital de la Amistad. Sigue los pasos en orden. Cada paso indica quién lo ejecuta y cómo verificar que terminó bien.

> **Servidor destino:** `192.168.1.30` (Windows 11 Pro)
> **NAS de backups:** `\\192.168.1.10\informatica25\backups\triage`
> **Acceso final del usuario:** `http://192.168.1.30:<PUERTO_WEB>` (puerto a confirmar tras chequeo)

---

## 0. Pre-requisitos (antes del día D)

- [ ] **Docker Desktop** instalado y corriendo en el servidor (con WSL2 backend habilitado).
- [ ] **Git** instalado.
- [ ] El usuario que ejecuta los pasos es Administrador de Windows.
- [ ] El servidor tiene conectividad a `\\192.168.1.10\informatica25` (probar con `Test-Path`).
- [ ] Archivo `LISTADO USUARIOS SISTEMA TRIAGE 2026.xlsx` disponible en una ruta del servidor (NO se commitea al repo).
- [ ] Logos institucionales del hospital ya están en `api/src/assets/pdf/` (verificar que existen tras clonar).

---

## 1. Clonar el repositorio

En PowerShell, como Administrador, en la carpeta de trabajo elegida (ej. `C:\triage`):

```powershell
cd C:\
git clone https://github.com/Gherrera99/triage-ha.git triage
cd triage
```

**Verificación:** `Get-ChildItem` muestra `api/`, `web/`, `docker-compose.yml`, `deploy/`.

---

## 2. Chequeo de puertos ocupados

El servidor ya corre otro stack Docker + VMs. Antes de levantar nada, verificar que los puertos default no choquen.

```powershell
.\deploy\port-check.ps1
```

El script reporta el estado de los puertos `3000`, `3307`, `5173`, `8080`. Si alguno está ocupado:

1. Editar `docker-compose.yml` y cambiar el lado IZQUIERDO del mapeo (host:container).
   - Ejemplo: si `8080` está ocupado por Adminer del otro stack, cambiar `"8080:8080"` a `"8090:8080"`.
2. Si cambias el puerto de la API (`3000`), actualizar también:
   - `web/.env` → `VITE_API_URL` y `VITE_WS_URL`
   - `api/.env` → `CORS_ORIGIN` (debe apuntar al puerto del web)
3. Anotar los puertos finales en este runbook (sección "Estado del despliegue" abajo) y en el mail de credenciales.

---

## 3. Crear archivos `.env` de producción

> ⚠️ **Estos archivos NUNCA se commitean.** Están en `.gitignore`.

### 3.1 `.env` en raíz (passwords MySQL)

Copiar `deploy/root.env.production.example` a `.env` y reemplazar los placeholders:

```powershell
Copy-Item deploy\root.env.production.example .env
notepad .env
```

Generar passwords fuertes (16+ caracteres) — puedes usar:
```powershell
[System.Web.Security.Membership]::GeneratePassword(20, 4)
```

### 3.2 `api/.env`

Copiar `deploy/api.env.production.example` a `api/.env`:

```powershell
Copy-Item deploy\api.env.production.example api\.env
notepad api\.env
```

Reemplazar:
- `JWT_SECRET` → generar con:
  ```powershell
  docker run --rm node:20-alpine node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
  ```
- `DATABASE_URL` → la pwd de `triage` debe coincidir con `MYSQL_PASSWORD` del paso 3.1.
- `CORS_ORIGIN` → `http://192.168.1.30:5173` (ajustar puerto si cambió en paso 2).

### 3.3 `web/.env`

```powershell
Copy-Item deploy\web.env.production.example web\.env
notepad web\.env
```

Reemplazar:
- `VITE_API_URL=http://192.168.1.30:3000`
- `VITE_WS_URL=http://192.168.1.30:3000`

(ajustar puertos si cambiaron).

---

## 4. Levantar los contenedores

En el servidor del hospital se levanta combinando el compose base con el override de produccion:

```powershell
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

El override `docker-compose.prod.yml` aplica los siguientes cambios sobre el base:

- Adminer en puerto **8090** en vez de 8080 (en `192.168.1.30` el 8080 lo ocupa otro stack).
- `api` y `web` SIN bind mounts del codigo fuente (en Windows los bind mounts desde unidades de red mapeadas como `Z:` fallan parcialmente). La imagen ya trae el codigo via `COPY . .` del Dockerfile.
- `api` ejecuta `prisma migrate deploy` automaticamente al arrancar para aplicar migraciones pendientes.

Para **dev local** en otra maquina (sin el override) se usa el compose base solo:

```powershell
docker compose up -d --build
```

Esperar 1-2 min a que MySQL inicialice. Verificar:

```powershell
docker compose ps
```

Los 4 servicios (`mysql`, `adminer`, `api`, `web`) deben estar `Up`.

Logs en vivo (en otra ventana):
```powershell
docker compose logs -f api
```

---

## 5. Inicializar la base de datos

```powershell
# Permisos completos al usuario triage
docker compose exec mysql mysql -uroot -p"$env:MYSQL_ROOT_PASSWORD" -e "GRANT ALL PRIVILEGES ON *.* TO 'triage'@'%' WITH GRANT OPTION; FLUSH PRIVILEGES;"

# Generar cliente Prisma
docker compose exec api npx prisma generate

# Aplicar migraciones
docker compose exec api npx prisma migrate deploy
```

> Nota: usar `prisma migrate deploy` (NO `migrate dev`) — no inventa migraciones nuevas, solo aplica las existentes.

---

## 6. Cargar los 73 usuarios reales

Copiar el archivo Excel al contenedor api (sin commitearlo):

```powershell
docker cp "C:\ruta\al\LISTADO USUARIOS SISTEMA TRIAGE 2026.xlsx" triage-api:/app/scripts/users.xlsx
docker compose exec api npx ts-node scripts/load_users.ts
```

**Verificación:**
```powershell
docker compose exec mysql mysql -utriage -p"$env:MYSQL_PASSWORD" triage_db -e "SELECT role, COUNT(*) FROM User GROUP BY role;"
```

Debe mostrar: 4 ADMIN, 11 CASHIER, 8 CONSULTOR, 20 DOCTOR, 30 NURSE_TRIAGE = 73 total.

---

## 7. Smoke test post-instalación

Probar el flujo crítico antes de dar acceso a usuarios:

1. **Login admin** desde otra PC en la LAN del hospital:
   - Abrir `http://192.168.1.30:5173`
   - Login con un admin del Excel y su pwd `primernombre2026*`
   - Debe redirigir a `/cambiar-password` (porque `mustChangePassword=true`)
   - Cambiar la pwd a una válida → debe entrar al dashboard
2. **Crear un paciente de prueba** desde la vista de enfermería (con un usuario NURSE_TRIAGE).
3. **Cobrar** desde la vista de caja (con un usuario CASHIER).
4. **Tomar consulta y finalizar** desde la vista de médico (con un usuario DOCTOR).
5. **Generar el reporte de turno (PDF)** desde la vista de enfermería para validar logos y formato.
6. **Borrar el paciente de prueba** (Adminer en `http://192.168.1.30:8080` → tabla `Patient`).

---

## 8. Configurar backups automáticos

Una sola vez:

```powershell
# Registrar credencial de la NAS en Windows Credential Manager
cmdkey /add:192.168.1.10 /user:Administrador /pass

# (PowerShell pedirá la pwd interactivamente — más seguro que pasarla en línea)

# Registrar la tarea programada de backup diario
.\deploy\setup-backup-task.ps1
```

**Verificación:**
- Abrir `taskschd.msc` → carpeta raíz → debe aparecer la tarea `triage-ha-backup-daily`.
- Ejecutarla manualmente la primera vez (Run) y verificar que aparece un archivo en `\\192.168.1.10\informatica25\backups\triage\`.

---

## 9. Entrega de credenciales

1. Generar el listado de los 73 usuarios con pwd inicial:
   ```powershell
   docker compose exec mysql mysql -utriage -p"$env:MYSQL_PASSWORD" triage_db -e "SELECT name, email FROM User WHERE active=1 AND mustChangePassword=1 ORDER BY role, name;" > usuarios_para_mail.tsv
   ```
2. Para cada usuario, enviar mail individual usando `docs/plantilla-mail-credenciales.md` (la pwd inicial se calcula como `primernombre2026*`, en minúsculas).
3. Adjuntar al mail la guía corta de su rol (`docs/guia-<rol>.md` exportada a PDF) y `docs/cambio-primera-pwd.md`.

---

## 10. Capacitación in situ

- Sesión por rol con el material de `docs/guia-*.md`.
- El admin recibe además `docs/manual-admin.md` y demostración del panel.

---

## 11. Verificación final

- [ ] Tarea programada de backup ejecutada al menos una vez con éxito (archivo en NAS).
- [ ] Smoke test completo OK.
- [ ] Todos los usuarios admin cambiaron su pwd inicial.
- [ ] El equipo de TI tiene acceso al servidor para soporte.

---

## Estado del despliegue (a llenar el día D)

| Campo | Valor |
|---|---|
| Fecha de go-live | _______ |
| Versión / commit | _______ |
| Puerto Web (host) | _______ |
| Puerto API (host) | _______ |
| Puerto MySQL (host) | _______ |
| Puerto Adminer (host) | _______ |
| Backup probado | [ ] |
| Smoke test OK | [ ] |
| Responsable en sitio | Gustavo Herrera + equipo TI |

---

## Apéndice A — Rollback de emergencia

Si algo sale mal y necesitas volver a un estado anterior:

1. **Detener todo:** `docker compose down`
2. **Restaurar BD desde el último backup OK:**
   ```powershell
   .\deploy\restore.ps1 -BackupFile "\\192.168.1.10\informatica25\backups\triage\triage_YYYY-MM-DD_HHmm.sql.gz"
   ```
3. **Volver al commit anterior:**
   ```powershell
   git log --oneline -5
   git checkout <hash>
   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
   ```
4. Notificar a usuarios.

## Apéndice B — Comandos de diagnóstico frecuentes

```powershell
# Ver logs
docker compose logs -f api
docker compose logs -f web
docker compose logs --tail=200 api

# Reiniciar un servicio
docker compose restart api

# Entrar al contenedor
docker compose exec api sh
docker compose exec mysql mysql -utriage -p triage_db

# Ver uso de disco de los volúmenes
docker system df -v
```
