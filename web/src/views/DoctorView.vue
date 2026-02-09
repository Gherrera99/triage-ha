<script setup lang="ts">
//web/src/views/DoctorView.vue
import { onMounted, onBeforeUnmount } from "vue";
import { useDoctorStore } from "../stores/doctor";
import { useSocket } from "../composables/useSocket";

const d = useDoctorStore();
const { connect } = useSocket();

onMounted(async () => {
  connect();            // ✅ asegura socket conectado
  d.initRealtime();     // ✅ listeners 1 sola vez
  await d.fetchQueue(); // ✅ pega a /triage/doctor/waiting
});

onBeforeUnmount(() => {
  d.disposeRealtime();  // ✅ evita duplicados si vuelves a entrar
});
</script>

<template>
  <div class="p-6 grid grid-cols-12 gap-4">
    <div class="col-span-4 bg-white rounded-xl shadow p-4">
      <h2 class="font-semibold text-lg mb-3">Fila (Pagados)</h2>

      <div class="space-y-2 max-h-[70vh] overflow-auto">
        <button
            v-for="t in d.queue"
            :key="t.id"
            class="w-full text-left p-3 rounded-lg border hover:bg-gray-50"
            @click="d.select(t)"
        >
          <div class="flex justify-between">
            <span class="font-medium">{{ t.patient.fullName }}</span>
            <span class="text-sm"
                  :class="t.classification==='ROJO' ? 'text-red-600' : t.classification==='AMARILLO' ? 'text-yellow-600' : 'text-green-600'"
            >
              {{ t.classification }}
            </span>
          </div>
          <div class="text-xs text-gray-500">Triage: {{ t.triageAt }}</div>
          <div class="text-xs text-gray-500">Enfermero: {{ t.nurse?.name }}</div>
        </button>
      </div>
    </div>

    <div class="col-span-8 bg-white rounded-xl shadow p-4">
      <template v-if="d.current">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h2 class="font-semibold text-lg">{{ d.current.patient.fullName }}</h2>
            <p class="text-sm text-gray-500">Motivo: {{ d.current.motivoUrgencia }}</p>
          </div>
          <div class="flex gap-2">
            <button class="px-3 py-2 rounded-lg bg-blue-600 text-white" @click="d.startConsultation">
              Iniciar consulta
            </button>
            <button class="px-3 py-2 rounded-lg bg-emerald-600 text-white" @click="d.saveNote">
              Guardar nota
            </button>
            <button class="px-3 py-2 rounded-lg bg-gray-900 text-white" @click="d.openPdf">
              Imprimir PDF
            </button>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <textarea v-model="d.note.padecimientoActual" class="border rounded-lg p-2" rows="4" placeholder="Padecimiento actual" />
          <textarea v-model="d.note.antecedentes" class="border rounded-lg p-2" rows="4" placeholder="Antecedentes" />
          <textarea v-model="d.note.exploracionFisica" class="border rounded-lg p-2" rows="4" placeholder="Exploración física" />
          <textarea v-model="d.note.estudiosParaclinicos" class="border rounded-lg p-2" rows="4" placeholder="Estudios paraclínicos" />
          <textarea v-model="d.note.diagnostico" class="border rounded-lg p-2" rows="4" placeholder="Diagnóstico(s)" />
          <div class="space-y-2">
            <input v-model="d.note.diagnosisPrincipal" class="border rounded-lg p-2 w-full" placeholder="Diagnóstico principal (para reporte Excel)" />
            <textarea v-model="d.note.planTratamiento" class="border rounded-lg p-2 w-full" rows="6" placeholder="Plan / Tratamiento" />
          </div>
          <textarea v-model="d.note.contrarreferencia" class="border rounded-lg p-2" rows="3" placeholder="Contrarreferencia" />
          <textarea v-model="d.note.pronostico" class="border rounded-lg p-2" rows="3" placeholder="Pronóstico" />
        </div>
      </template>

      <template v-else>
        <div class="text-gray-500">Selecciona un paciente de la fila para comenzar.</div>
      </template>
    </div>
  </div>
</template>
