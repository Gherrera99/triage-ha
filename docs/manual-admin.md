# Manual del Administrador — Sistema de Triage

> Rol: **ADMIN**
> Audiencia: administrador del sistema en el Hospital de la Amistad.

Este manual cubre las tareas operativas del administrador: gestión de usuarios, reportes, recuperación de cuentas y troubleshooting básico.

---

## Tabla de contenido

1. [Acceso al panel](#1-acceso-al-panel)
2. [Gestión de usuarios](#2-gestión-de-usuarios)
3. [Reportes](#3-reportes)
4. [Backups y restauración](#4-backups-y-restauración)
5. [Troubleshooting](#5-troubleshooting)
6. [Contactos de escalamiento](#6-contactos-de-escalamiento)

---

## 1. Acceso al panel

- URL: `http://192.168.1.30:5173`
- Login con tu usuario admin (`primernombre.apellidopaterno`) y tu pwd personal.
- Al entrar verás el menú principal con dos secciones grandes: **Reportes** y **Gestión de Usuarios**.

`[SCREENSHOT: Dashboard inicial del admin]`

---

## 2. Gestión de usuarios

Desde el menú **Gestión de Usuarios**.

`[SCREENSHOT: Vista de Gestión de Usuarios con la tabla y filtros]`

### 2.1 Filtros y búsqueda

- **Buscar:** por nombre o usuario (busca en ambos).
- **Rol:** filtra por NURSE_TRIAGE / CASHIER / DOCTOR / ADMIN / CONSULTOR.
- **Conectado:** muestra solo los que están en línea / desconectados ahora mismo (presencia en tiempo real).
- **Estado:** activo / desactivado.

Clic en **Aplicar** después de cambiar filtros de servidor (búsqueda y rol).

### 2.2 Crear un usuario nuevo

1. Clic en **Nuevo usuario**.
2. Llena:
   - **Nombre completo** (en MAYÚSCULAS por convención).
   - **Correo / usuario** (formato `primernombre.apellidopaterno`).
   - **Rol**.
   - **Cédula** (solo aplica para médicos).
   - **Contraseña** — debe cumplir la política:
     - 8+ caracteres
     - Una mayúscula
     - Un carácter especial (`!`, `*`, `@`, `#`, `?`...)
     - No más de 2 dígitos iguales seguidos
3. **Crear usuario**.

> El usuario nuevo entra con `mustChangePassword=true` automáticamente — debe cambiar su pwd en el primer ingreso.

`[SCREENSHOT: Modal "Crear usuario" con campos llenos]`

### 2.3 Editar un usuario

Botón **Editar** del usuario:
- Cambiar nombre, email, rol, cédula.
- Si llenas el campo **Nueva contraseña**, se reemplaza la actual (debe cumplir política). Dejarlo vacío no la cambia.
- **El usuario afectado NO recibe la nueva pwd automáticamente** — comunícasela personalmente y considera marcarle `mustChangePassword` (ver "Resetear contraseña" más abajo, que es la opción más limpia).

### 2.4 Resetear contraseña (recomendado para olvidos)

`[SCREENSHOT: Botón "Resetear pwd" + modal con la temporal generada]`

1. En la fila del usuario, clic en **Resetear pwd**.
2. Aparece un modal con la **contraseña temporal generada** (ej. `9D8uZVEp8dL!`).
3. **Cópiala antes de cerrar el modal — solo se muestra una vez.** Usa el botón **Copiar**.
4. Comunícasela al usuario por un canal seguro (mail, mensaje directo, en persona).
5. El usuario, al ingresar con esta temporal, será forzado a cambiarla por una nueva.

> Esta acción también:
> - Desconecta automáticamente al usuario si tenía sesión activa.
> - Reactiva la cuenta si estaba bloqueada por intentos fallidos.

### 2.5 Desactivar un usuario

`[SCREENSHOT: Botón "Desactivar" + modal de confirmación con razón]`

1. Clic en **Desactivar**.
2. Opcionalmente captura la **razón** (ej. "Baja del personal", "Fin de contrato"). Queda registrada.
3. **Confirmar**.

El usuario pierde acceso inmediatamente:
- Si tiene sesión activa, es expulsado en tiempo real.
- Si intenta loguearse, recibe el mensaje "Usuario desactivado, comunícate con TI".

### 2.6 Reactivar un usuario

Si el usuario quedó desactivado (por bloqueo automático tras 5 intentos fallidos, o por desactivación manual):

`[SCREENSHOT: Botón "Reactivar" en la fila del usuario]`

1. Clic en **Reactivar**.
2. La cuenta vuelve a estar activa, con `failedAttempts=0` y sin `deactivatedReason`.

> Si el bloqueo fue por intentos fallidos, **considera resetear la pwd también** — el usuario probablemente la olvidó.

### 2.7 Eliminar un usuario (con cuidado)

Botón **Eliminar**.

> ⚠️ Solo funciona si el usuario **NO tiene registros relacionados** (triages, notas médicas, pagos). Si los tiene, el sistema te dirá que lo desactives en su lugar (recomendado para preservar trazabilidad).
> ⚠️ No puedes eliminar tu propio usuario.

### 2.8 Indicadores en la tabla

- **Punto verde "En línea"** — el usuario tiene una sesión activa con el servidor.
- **"Debe cambiar contraseña"** (texto naranja bajo el nombre) — aún no ha hecho su primer cambio.
- **Renglón en gris** — usuario desactivado; muestra la razón abajo del estado.

---

## 3. Reportes

Desde el menú **Reportes**.

### 3.1 Filtros

- Rango de fechas (desde / hasta) — zona horaria Mérida (UTC-06:00).
- Clasificación.
- Estado final.

### 3.2 Excel completo

`[SCREENSHOT: Botón "Descargar Excel" en reportes]`

Genera un Excel con TODAS las columnas: paciente, expediente, edad, motivo, clasificación, fechas (registro, cobro, consulta inicio/fin), médico, estado final, observaciones, vigilancia, contra-referencia, etc.

### 3.3 Reporte PDF de turno de enfermería

Cada enfermera/o genera el suyo desde su vista. El admin no lo dispara — solo los enfermeros tienen el botón. Si necesitas un reporte equivalente desde admin, usa el Excel filtrado por enfermero.

---

## 4. Backups y restauración

### 4.1 Verificar que el backup diario corra

- Tarea programada: **`triage-ha-backup-daily`** en Task Scheduler del servidor (`taskschd.msc`).
- Hora: 02:00 AM diario.
- Logs: `C:\triage\backups\backup.log` en el servidor.
- Destino: `\\192.168.1.10\informatica25\backups\triage\`

**Una vez por semana**, verifica:

1. Que aparezcan archivos nuevos en la NAS con el patrón `triage_YYYY-MM-DD_HHmm.sql.gz`.
2. Que el log no muestre errores recientes (busca "ERROR" o "FAIL" en `backup.log`).

### 4.2 Restaurar desde un backup (emergencia)

Solo en caso de pérdida grave de datos. Lo ejecuta el admin del servidor (Gustavo + equipo TI), no desde el panel del sistema.

```powershell
cd C:\triage
.\deploy\restore.ps1 -BackupFile "\\192.168.1.10\informatica25\backups\triage\triage_2026-05-10_0200.sql.gz"
```

El script pide confirmación escribiendo `RESTAURAR`. Detiene los servicios api y web durante la restauración.

> ⚠️ Esto **borra todos los datos actuales** y carga los del backup. Notifica a los usuarios antes.

---

## 5. Troubleshooting

### 5.1 "Un usuario no puede entrar"

Pregunta:
1. **¿Qué mensaje recibe?**
   - "El usuario ingresado no existe" → revisa que el email esté escrito correctamente y exista en el panel.
   - "La contraseña ingresada es incorrecta" + número de intentos restantes → es pwd incorrecta. Si ya lo intentó muchas veces, prevenle del bloqueo y resetea pwd.
   - "Usuario desactivado, comunícate con TI" → la cuenta está desactivada (por 5 intentos fallidos o desactivación manual). Reactiva y resetea pwd.
   - "Debes cambiar tu contraseña" → es flujo normal del primer ingreso o tras reset.

### 5.2 "El sistema está lento"

1. Verifica logs: en el servidor, `docker compose logs --tail=200 api` y `docker compose logs --tail=200 web`.
2. Verifica recursos: Task Manager → CPU / RAM. Si el servidor está saturado por las VMs (Issabel + Mint), revisa cuál está consumiendo.
3. Reinicia los servicios:
   ```powershell
   cd C:\triage
   docker compose restart api web
   ```

### 5.3 "No suena la alerta de voz en caja/médico"

- Verifica que el navegador del usuario tenga permitido el audio (icono de candado / "Permitir sonido").
- El usuario debe haber hecho login al menos una vez en esa pestaña (se requiere gesto del usuario para activar Web Speech API).
- En Windows, el usuario del sistema operativo debe tener una voz en español instalada (Configuración → Hora e idioma → Voz).

### 5.4 "El sistema se cayó"

1. Verificar contenedores: `docker compose ps` (en el servidor).
2. Si alguno está caído, levantar: `docker compose up -d`.
3. Si MySQL no levanta, revisar `docker compose logs mysql` por errores de disco o corrupción.
4. Si todo falla, restaurar desde el último backup OK (sección 4.2).

### 5.5 "Quiero ver los datos directamente en la BD"

`[SCREENSHOT: Adminer]`

URL: `http://192.168.1.30:8080`

- Sistema: MySQL
- Servidor: `mysql`
- Usuario: `triage`
- Pwd: la del `.env` raíz (`MYSQL_PASSWORD`).
- Base de datos: `triage_db`

> Solo lectura recomendada. NO edites datos directamente; usa el panel.

---

## 6. Contactos de escalamiento

- **Soporte primer nivel:** equipo de TI del hospital — [soporte.hamistad@yucatan.gob.mx - tel: ext 165]
- **Desarrollador / mantenimiento:** Gustavo Herrera — [gustavo.herrera@yucatan.gob.mx / ext 165]
- **NAS / red:** equipo de TI — [soporte.hamistad@yucatan.gob.mx, alan.noh@yucatan.gob.mx, rafael.uc@yucatan.gob.mx y gustavo.herrera@yucatan.gob.mx]
