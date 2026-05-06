# Guía rápida — Enfermería (Triage)

> Rol: **NURSE_TRIAGE**
> Vista: pantalla principal de triage al ingresar.

## Tu trabajo en el sistema

1. Registrar al paciente que llega al servicio de urgencias.
2. Clasificarlo por color (VERDE / AMARILLO / ROJO) según la severidad.
3. Mandarlo a caja para el cobro.
4. Generar el reporte PDF de tu turno cuando termines.

---

## 1. Iniciar sesión

`[SCREENSHOT: Pantalla de login]`

- URL: `http://192.168.1.30:5173`
- Usuario: tu correo (`primernombre.apellidopaterno`)
- Contraseña: la que estableciste al primer ingreso (ver guía de cambio de contraseña).

---

## 2. Registrar un paciente nuevo

`[SCREENSHOT: Vista principal de enfermería con botón "Nuevo paciente"]`

1. Clic en **Nuevo paciente** (arriba a la derecha).
2. Llena los datos:
   - **Expediente** (si lo tiene; si no, deja vacío).
   - **Nombre completo del paciente**.
   - **Fecha de nacimiento** — usa el calendario; el sistema calcula la edad en años y meses automáticamente.
   - **Motivo de consulta** — selecciona de la lista o escribe.
   - **Signos vitales** (TA, FC, FR, T°, SpO2) si están disponibles.
   - **Responsable** (acompañante/familiar).
   - **Datos de alarma** (texto libre — síntomas relevantes que ayuden al médico).
3. **Clasificación** — selecciona el color VERDE / AMARILLO / ROJO según la guía clínica.
   `[SCREENSHOT: Tabla de ayuda visual de clasificación]`
4. Clic en **Guardar**.

El paciente aparece automáticamente en la pestaña **ESPERA** y se notifica a caja en tiempo real (escucharán un anuncio de voz "Nuevo paciente en espera").

---

## 3. Pestañas de pacientes

`[SCREENSHOT: Pestañas ESPERA / CONSULTA / ATENDIDO / NO ATENDIDO]`

- **ESPERA** — pacientes que registraste y aún no pasan a consulta.
- **CONSULTA** — pacientes que están con un médico en este momento.
- **ATENDIDO** — pacientes ya atendidos por médico.
- **NO ATENDIDO** — pacientes que no se presentaron al llamado o no quisieron pagar.

---

## 4. Editar un paciente en espera

Si te equivocaste en algún dato:

`[SCREENSHOT: Botón Editar en una fila de paciente]`

1. Clic en el botón **Editar** del paciente (solo disponible mientras esté en ESPERA y antes de cobro).
2. Corrige los campos necesarios.
3. **Guardar**.

> Una vez que el paciente fue cobrado o atendido, ya no se puede editar.

---

## 5. Reporte de turno (PDF)

Al finalizar tu turno, genera el reporte de pacientes que registraste:

`[SCREENSHOT: Botón "Reporte de turno" en la cabecera]`

1. Clic en **Reporte de turno**.
2. Se descarga un PDF con:
   - Logos institucionales.
   - Tu nombre y la fecha.
   - Lista de todos los pacientes que registraste hoy con su clasificación.
3. Imprime y entrega según el procedimiento del hospital.

> El reporte filtra automáticamente solo los pacientes del **día actual** registrados por ti.

---

## 6. Casos especiales

- **Paciente que no quiere esperar:** no requiere acción de tu parte; caja o el médico lo marcan según corresponda.
- **Paciente con expediente repetido:** el sistema detecta y reutiliza el expediente; verifica que el nombre coincida.
- **Si pierdes conexión:** la página se recargará sola al volver. No se pierden los datos ya guardados.

---

## ¿Dudas?

- Administrador: **[nombre]**
- TI: **[contacto]**
