# `deploy/` — Artefactos de despliegue al Hospital de la Amistad

Esta carpeta contiene scripts y plantillas para desplegar `triage-ha` en el servidor del Hospital de la Amistad (`192.168.1.30`, Windows 11 Pro).

## Archivos

| Archivo | Para qué sirve | Cuándo se usa |
|---|---|---|
| `runbook.md` | Pasos paso a paso del despliegue | Día del go-live |
| `port-check.ps1` | Detecta puertos ocupados antes de levantar el stack | Antes del despliegue |
| `root.env.production.example` | Plantilla del `.env` raíz (passwords MySQL) | Una vez, al instalar |
| `api.env.production.example` | Plantilla de `api/.env` (JWT_SECRET, DATABASE_URL, CORS) | Una vez, al instalar |
| `web.env.production.example` | Plantilla de `web/.env` (URLs API/WS) | Una vez, al instalar |
| `backup.ps1` | Backup diario de MySQL a la NAS | Lo dispara la tarea programada |
| `setup-backup-task.ps1` | Registra la tarea programada en Task Scheduler | Una vez, después de instalar |
| `restore.ps1` | Restaura la BD desde un backup `.sql.gz` | Solo en emergencia |

## Antes de ejecutar `setup-backup-task.ps1`

Registrar la credencial de la NAS en Windows Credential Manager (una sola vez, en el servidor):

```powershell
cmdkey /add:192.168.1.10 /user:Administrador /pass
```

PowerShell pedirá la contraseña de forma interactiva. Esto guarda la credencial localmente para que `backup.ps1` pueda hacer `net use` sin pwd inline.

## Documentación de usuario

Las guías para los usuarios finales (enfermería, caja, médico, consultor) y el manual del admin están en `../docs/`.
