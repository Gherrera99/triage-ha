# Guía rápida — Médico

> Rol: **DOCTOR**
> Vista: dashboard de médico al ingresar.

## Tu trabajo en el sistema

1. Tomar pacientes en espera (ya cobrados).
2. Capturar la nota médica de la consulta.
3. Finalizar la consulta cuando termines.
4. Marcar al paciente como "No se presentó" si no responde al llamado.

---

## 1. Iniciar sesión

- URL: `http://192.168.1.30:5173`
- Usuario y contraseña personales.

`[SCREENSHOT: Pantalla de login]`

---

## 2. Dashboard del médico

Al entrar verás tres pestañas:

`[SCREENSHOT: Pestañas ESPERA / CONSULTA / ATENDIDO en vista médico]`

- **ESPERA** — pacientes ya cobrados, listos para que cualquier médico los tome.
- **CONSULTA** — pacientes que **TÚ** estás atendiendo en este momento.
- **ATENDIDO** — pacientes que ya finalizaste (consulta cerrada).

Cuando un paciente termina de pagar en caja, escucharás el anuncio de voz **"Nuevo paciente en espera"** y aparecerá en la pestaña ESPERA.

---

## 3. Tomar un paciente

`[SCREENSHOT: Botón "Tomar paciente" en la pestaña ESPERA]`

1. En la pestaña **ESPERA**, identifica al siguiente paciente (ordenados por prioridad ROJO > AMARILLO > VERDE y luego por hora).
2. Clic en el botón **Tomar paciente**.
3. El paciente pasa a tu pestaña **CONSULTA** y queda bloqueado para otros médicos.

> ⚠️ Una vez que tomas a un paciente, otros médicos no pueden hacerlo. Si te equivocaste, ve al apartado de "Cambio de médico" abajo.

---

## 4. Capturar la nota médica

`[SCREENSHOT: Vista de consulta con campos de nota médica]`

Mientras estás con el paciente:

1. Clic en el paciente desde la pestaña **CONSULTA**.
2. Captura los campos:
   - **Padecimiento actual**.
   - **Exploración física**.
   - **Diagnóstico**.
   - **Plan / Tratamiento**.
   - **Indicaciones**.
   - **Pronóstico**.
   - **Vigilancia** (texto libre — qué vigilar tras egreso).
   - **Contra-referencia** (si aplica) — sí/no, fecha y observaciones.
   - **Seguimiento**.
3. Los cambios se **guardan automáticamente** mientras escribes (auto-save).

---

## 5. Finalizar consulta

Cuando hayas terminado con el paciente:

`[SCREENSHOT: Botón "Finalizar consulta"]`

1. Verifica que la nota esté completa.
2. Clic en **Finalizar consulta**.
3. Confirma la acción.

El paciente pasa a tu pestaña **ATENDIDO** y queda cerrado (no se puede modificar la nota después).

> ⚠️ Una vez finalizada, la consulta es **inalterable**. Esto es por trazabilidad médico-legal.

---

## 6. Marcar "No se presentó al llamado"

Si llamas al paciente varias veces y no responde:

`[SCREENSHOT: Botón "No se presentó al llamado" con modal de justificación]`

1. Clic en el botón **No se presentó al llamado** del paciente (en pestaña ESPERA o CONSULTA).
2. Captura la **justificación** en el modal (ej. "Llamado 3 veces sin respuesta", "Paciente abandonó la sala").
3. Confirmar.

El paciente pasa a **NO ATENDIDO** con tu nombre, fecha/hora y la justificación registrada.

---

## 7. Imprimir nota / receta

`[SCREENSHOT: Botón "Imprimir PDF" en la consulta]`

Desde la consulta (mientras está abierta o después de finalizarla), clic en **Imprimir** para generar el PDF con membrete y nota completa.

---

## 8. Casos especiales

- **Cambio de médico:** si tomaste a un paciente por error, contacta al admin para que lo libere — el sistema no permite a otro médico tomarlo mientras esté en tu pestaña CONSULTA.
- **Caída del sistema durante la consulta:** las notas guardadas previamente están seguras (auto-save). Al volver, encuentras al paciente en CONSULTA con el texto guardado hasta el último auto-save.

---

## ¿Dudas?

- Administrador: **[nombre]**
- TI: **[contacto]**
