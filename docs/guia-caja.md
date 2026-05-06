# Guía rápida — Caja

> Rol: **CASHIER**
> Vista: pantalla de caja al ingresar.

## Tu trabajo en el sistema

1. Atender el cobro de los pacientes que enfermería ya registró.
2. Si el paciente no quiere pagar, marcarlo como tal.
3. Capturar/agregar el número de expediente si llega después.

---

## 1. Iniciar sesión

- URL: `http://192.168.1.30:5173`
- Usuario y contraseña personales.

`[SCREENSHOT: Pantalla de login]`

---

## 2. Pacientes en espera de cobro

Al entrar verás la lista de pacientes pendientes:

`[SCREENSHOT: Vista principal de caja con lista de pacientes en espera]`

Cada renglón muestra:
- Nombre del paciente.
- Clasificación (color).
- Edad.
- Motivo de consulta.
- Hora de registro.

Cuando enfermería registre un paciente nuevo escucharás un anuncio de voz **"Nuevo paciente en espera"** y aparecerá automáticamente en la lista.

---

## 3. Cobrar un paciente

`[SCREENSHOT: Modal de cobro con monto y método de pago]`

1. Clic en el botón **Cobrar** del paciente.
2. Llena:
   - **Monto** cobrado.
   - **Método de pago** (efectivo, tarjeta, transferencia).
   - **Folio** del recibo si aplica.
3. **Confirmar cobro**.

El paciente desaparece de tu lista y queda disponible para que el médico lo tome.

---

## 4. Marcar "No quiso pagar"

Si el paciente decide no pagar y se va:

`[SCREENSHOT: Botón "No quiso pagar" en una fila de paciente]`

1. Clic en el botón **No quiso pagar**.
2. Confirma la acción en el modal.

El paciente pasa a la pestaña **NO ATENDIDO** con la marca correspondiente; ya no aparece para cobro ni para el médico.

> ⚠️ Esta acción **no se puede deshacer** desde la vista de caja. Si fue por error, contacta al administrador.

---

## 5. Agregar expediente posterior

Si el paciente fue registrado sin expediente y luego lo trae:

`[SCREENSHOT: Botón "Agregar expediente"]`

1. Clic en el botón **Agregar expediente** del paciente.
2. Captura el número de expediente.
3. **Guardar**.

---

## 6. Casos especiales

- **Paciente urgente (ROJO):** prioriza el cobro o pasa al médico inmediato según protocolo del hospital. El médico puede atender antes del cobro si es emergencia (consulta con el admin para cómo registrar después).
- **Si la página se ve trabada:** refresca con F5; los datos están guardados en el servidor.

---

## ¿Dudas?

- Administrador: **[nombre]**
- TI: **[contacto]**
