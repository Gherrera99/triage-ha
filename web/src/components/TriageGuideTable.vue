<template>
  <details class="border rounded-2xl bg-white">
    <summary class="cursor-pointer px-4 py-3 font-semibold select-none">
      Guía visual de clasificación (Apariencia / Respiración / Circulación)
      <span class="text-sm font-normal text-gray-500"> — clic para abrir/cerrar</span>
    </summary>

    <div class="px-4 pb-4">
      <div class="overflow-x-auto">
        <table class="min-w-[980px] w-full text-xs border-collapse">
          <caption class="caption-top text-xs text-gray-600 mb-2">
            Se deberá seleccionar la casilla según lo observado en cada uno de los parámetros y subrayar lo que se observe.
          </caption>

          <thead>
          <tr>
            <th class="border bg-slate-200 px-3 py-2 text-left w-[180px]">PARAMETROS:</th>
            <th class="border bg-green-500 text-white px-3 py-2 text-center text-lg">VERDE</th>
            <th class="border bg-yellow-300 text-black px-3 py-2 text-center text-lg">AMARILLO</th>
            <th class="border bg-red-500 text-white px-3 py-2 text-center text-lg">ROJO</th>
          </tr>
          </thead>

          <tbody>
          <tr>
            <th class="border px-3 py-3 text-left font-semibold">APARIENCIA</th>
            <td class="border bg-green-200 px-3 py-3 align-top">
              Despierto, atento, consciente, con respuesta a estímulos, sonriente.
            </td>
            <td class="border bg-yellow-200 px-3 py-3 align-top">
              Somnoliento, desconectado con el medio, irritable (llanto inconsolable), luce sin fuerzas,
              lenguaje pobre o incoherente, no responde, despierta solo a estímulos.
            </td>
            <td class="border bg-red-200 px-3 py-3 align-top">
              Inconsciente, convulsiones, mirada perdida, sin respuesta a estímulos, mal aspecto, no despierta.
            </td>
          </tr>

          <tr>
            <th class="border px-3 py-3 text-left font-semibold">RESPIRACION</th>
            <td class="border bg-green-200 px-3 py-3 align-top">
              Respiración rítmica, tranquila, sin dificultad respiratoria.
            </td>
            <td class="border bg-yellow-200 px-3 py-3 align-top">
              Rápida o lenta (según la edad), tiene signos de dificultad respiratoria, se escuchan ruidos respiratorios
              (estridor, sibilancias, ronquido, disfonía).
            </td>
            <td class="border bg-red-200 px-3 py-3 align-top">
              No respira (apnea), quejido respiratorio, dificultad respiratoria severa.
            </td>
          </tr>

          <tr>
            <th class="border px-3 py-3 text-left font-semibold">CIRCULACION</th>
            <td class="border bg-green-200 px-3 py-3 align-top">
              Tegumentos rosados normales, mucosas hidratadas.
            </td>
            <td class="border bg-yellow-200 px-3 py-3 align-top">
              Palidez, mucosas secas, signos de deshidratación, hemorragia contenida.
            </td>
            <td class="border bg-red-200 px-3 py-3 align-top">
              Cianosis, hemorragia activa, piel marmórea, diaforesis, palidez intensa.
            </td>
          </tr>

          <!-- Bloque de clasificación final -->
          <tr>
            <th class="border bg-sky-200 px-3 py-3 text-left font-semibold" rowspan="2">
              CLASIFICACION DE LA URGENCIA
            </th>

            <td class="border bg-green-500 text-white px-3 py-3 text-center">
              <div class="text-lg font-extrabold">VERDE</div>
              <div class="font-semibold uppercase text-xs">URGENCIA NO CALIFICADA</div>
            </td>

            <td class="border bg-yellow-300 text-black px-3 py-3 text-center">
              <div class="text-lg font-extrabold">AMARILLO</div>
              <div class="font-semibold uppercase text-xs">URGENCIAS CALIFICADA</div>
            </td>

            <td class="border bg-red-500 text-white px-3 py-3 text-center">
              <div class="text-lg font-extrabold">ROJO</div>
              <div class="font-semibold uppercase text-xs">EMERGENCIA O CRITICO</div>
            </td>
          </tr>

          <tr>
            <td class="border bg-green-200 px-3 py-3 align-top">
              Atención según disponibilidad del servicio, hasta 120 minutos de tiempo de espera,
              puede ser referido a su CS en caso necesario.
            </td>
            <td class="border bg-yellow-200 px-3 py-3 align-top">
              Se actúa según el caso: pasa a consultorio o cama de observación, se toman signos vitales,
              tiene atención prioritaria, la respuesta debe ser de 15 a 60 minutos.
            </td>
            <td class="border bg-red-200 px-3 py-3 align-top">
              Eventos que ponen en peligro su vida. Ingresa a cama de choque o reanimación para atención inmediata.
            </td>
          </tr>
          </tbody>
        </table>
      </div>
    </div>
  </details>
</template>

<script setup lang="ts"></script>
