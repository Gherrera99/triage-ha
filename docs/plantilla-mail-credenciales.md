# Plantilla de mail — Entrega de credenciales iniciales

> Usar este texto base para enviar el correo individual a cada uno de los 73 usuarios cargados.
> Reemplazar los marcadores `{{...}}` por los datos del destinatario.
> Adjuntar al mail: `cambio-primera-pwd.md` y la guía del rol correspondiente, ambos exportados a PDF.

---

## Asunto

```
Tu acceso al Sistema de Triage del Hospital de la Amistad
```

---

## Cuerpo del mail

```
Buen día, {{NOMBRE_USUARIO}}:

Te damos la bienvenida al Sistema de Triage del Servicio de Urgencias del
Hospital de la Amistad. A continuación encontrarás tus datos de acceso:

  Sistema:        http://192.168.1.30:5173
  Usuario:        {{USUARIO}}
  Contraseña inicial: {{PRIMER_NOMBRE_MINUSCULAS}}2026*

  Rol asignado:   {{ROL_LEGIBLE}}

IMPORTANTE — Primer ingreso

Al ingresar por primera vez el sistema te pedirá cambiar tu contraseña
inicial por una nueva que solo tú conozcas. La nueva contraseña debe:

  - Tener al menos 8 caracteres
  - Incluir al menos una letra mayúscula
  - Incluir al menos un carácter especial (! * @ # ? ...)
  - No tener más de 2 dígitos iguales seguidos

Adjunto encontrarás dos documentos:

  1. "Cambio de contraseña en el primer ingreso" — paso a paso para tu
     primer login.
  2. "Guía rápida — {{ROL_LEGIBLE}}" — cómo usar el sistema en tu rol.

Recomendaciones de seguridad

  - No compartas tu contraseña con NADIE, ni siquiera con el personal
    de TI. Si la pierdes, el administrador puede generarte una temporal.
  - Después de 5 intentos fallidos tu cuenta se bloquea automáticamente;
    si te pasa, contacta al administrador.
  - El sistema cierra sesión automáticamente después de 12 horas; vuelve
    a loguearte cuando regreses.

Soporte

Si tienes alguna duda al ingresar o al usar el sistema, contacta a:

  - Administrador del sistema:  {{Gustavo Herrera}} — {{gustavo.herrera@yucatan.gob.mx}}
  - Equipo de TI del hospital:  {{soporte.hamistad@yucatan.gob.mx, alan.noh@yucatan.gob.mx, rafael.uc@yucatan.gob.mx y gustavo.herrera@yucatan.gob.mx}}

Saludos cordiales,
{{Gustavo Herrera}}
```

---

## Cómo se llenan los marcadores

| Marcador | De dónde sale | Ejemplo |
|---|---|---|
| `{{NOMBRE_USUARIO}}` | Campo `name` del usuario, formato natural | `Yazmín Quintal` |
| `{{USUARIO}}` | Campo `email` del usuario | `yazmin.quintal` |
| `{{PRIMER_NOMBRE_MINUSCULAS}}` | Primera palabra de `name` en minúsculas, sin acentos | `yazmin` |
| `{{ROL_LEGIBLE}}` | Etiqueta amigable del rol | `Enfermería` / `Caja` / `Médico` / `Administrador` / `Consultor` |
| `{{NOMBRE_ADMIN}}` | Nombre del admin de contacto | (definir) |
| `{{CONTACTO_ADMIN}}` | Mail/teléfono del admin | (definir) |
| `{{CONTACTO_TI}}` | Contacto del equipo TI | (definir) |
| `{{NOMBRE_QUE_FIRMA}}` | Quién envía los mails | `Gustavo Herrera` |

## Mapeo rol → etiqueta legible

| Rol en sistema | Etiqueta para el mail | Guía a adjuntar |
|---|---|---|
| `NURSE_TRIAGE` | Enfermería | `guia-enfermeria.pdf` |
| `CASHIER` | Caja | `guia-caja.pdf` |
| `DOCTOR` | Médico | `guia-medico.pdf` |
| `ADMIN` | Administrador | `manual-admin.pdf` |
| `CONSULTOR` | Consultor | `guia-consultor.pdf` |

---

## Generar el listado para envío masivo

En el servidor, ejecutar:

```powershell
docker compose exec mysql mysql -utriage -p"$env:MYSQL_PASSWORD" triage_db `
  -e "SELECT name, email, role FROM User WHERE active=1 AND mustChangePassword=1 ORDER BY role, name;" `
  > usuarios_para_mail.tsv
```

Importar el TSV a Excel y agregar columnas con los marcadores calculados (formula tipo: `=LOWER(LEFT(A1,FIND(" ",A1)-1))` para `PRIMER_NOMBRE_MINUSCULAS`).

> Considera usar mail-merge de Outlook o Word para automatizar el envío.
