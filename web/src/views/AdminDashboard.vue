<script setup lang="ts">
import { onMounted, watch } from "vue";
import { useAdminReportsStore } from "../stores/adminReports";

const a = useAdminReportsStore();

function badge(c: string) {
  return c === "ROJO"
      ? "bg-red-600"
      : c === "AMARILLO"
          ? "bg-yellow-400 text-black"
          : "bg-green-600";
}

function fmtMerida(iso: string | Date) {
  const d = iso instanceof Date ? iso : new Date(iso);
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Merida",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

const vigilanciaOptions = [
  { key: "vigFiebre38", label: "Fiebre > 38°C" },
  { key: "vigConvulsiones", label: "Convulsiones" },
  { key: "vigAlteracionAlerta", label: "Alteración alerta" },
  { key: "vigSangradoActivo", label: "Sangrado activo" },
  { key: "vigDeshidratacion", label: "Deshidratación" },
  { key: "vigVomitosFrecuentes", label: "Vómitos frecuentes" },
  { key: "vigIrritabilidad", label: "Irritabilidad" },
  { key: "vigLlantoInconsolable", label: "Llanto que no cede" },
  { key: "vigDificultadRespiratoria", label: "Dificultad respiratoria" },
  { key: "vigChoque", label: "Datos de choque" },
  { key: "vigDeterioroNeurologico", label: "Deterioro neurológico" },
];

function ensureVigilancia(note: any) {
  if (!note) return;
  if (!note.vigilancia || typeof note.vigilancia !== "object") note.vigilancia = {};
  for (const o of vigilanciaOptions) {
    note.vigilancia[o.key] = !!note.vigilancia[o.key];
  }
}

// cada vez que abras el modal o cambie selected => asegura estructura reactiva
watch(
    () => a.selected,
    (v) => {
      if (v?.medicalNote) ensureVigilancia(v.medicalNote);
    },
    { immediate: true }
);

onMounted(async () => {
  a.setDefaultToday();
  await a.fetch();
});
</script>

<template>
  <div class="p-6 max-w-7xl mx-auto">
    <div class="bg-white rounded-2xl shadow p-6">
      <div class="flex items-center justify-between mb-4">
        <h1 class="text-2xl font-semibold">Administrador</h1>
        <div class="flex gap-2">
          <button class="px-4 py-2 rounded-xl border" @click="a.fetch">Refrescar</button>
          <button class="px-4 py-2 rounded-xl bg-emerald-600 text-white" @click="a.exportExcel">Exportar Excel</button>
        </div>
      </div>

      <!-- filtros -->
      <div class="grid grid-cols-12 gap-3 mb-5">
        <input v-model="a.q" class="col-span-4 border rounded-xl p-2" placeholder="Buscar: expediente / nombre / ID" />

        <select v-model="a.classification" class="col-span-2 border rounded-xl p-2">
          <option value="">Todos</option>
          <option value="VERDE">VERDE</option>
          <option value="AMARILLO">AMARILLO</option>
          <option value="ROJO">ROJO</option>
        </select>

        <input v-model="a.startDate" type="date" class="col-span-2 border rounded-xl p-2" />
        <input v-model="a.endDate" type="date" class="col-span-2 border rounded-xl p-2" />

        <button class="col-span-2 px-4 py-2 rounded-xl bg-blue-600 text-white" @click="a.fetch">
          Aplicar
        </button>
      </div>

      <!-- KPI -->
      <div v-if="a.kpi" class="grid grid-cols-3 gap-3 mb-5">
        <div class="border rounded-2xl p-4">
          <div class="font-semibold">VERDE</div>
          <div class="text-sm text-gray-600">Cumple SLA: {{ a.kpi.VERDE.ok }}/{{ a.kpi.VERDE.total }} ({{ a.kpi.VERDE.pct }}%)</div>
        </div>
        <div class="border rounded-2xl p-4">
          <div class="font-semibold">AMARILLO</div>
          <div class="text-sm text-gray-600">Cumple SLA: {{ a.kpi.AMARILLO.ok }}/{{ a.kpi.AMARILLO.total }} ({{ a.kpi.AMARILLO.pct }}%)</div>
        </div>
        <div class="border rounded-2xl p-4">
          <div class="font-semibold">ROJO</div>
          <div class="text-sm text-gray-600">Cumple SLA: {{ a.kpi.ROJO.ok }}/{{ a.kpi.ROJO.total }} ({{ a.kpi.ROJO.pct }}%)</div>
        </div>
      </div>

      <!-- tabla -->
      <div class="overflow-auto border rounded-2xl">
        <table class="w-full text-sm">
          <thead class="bg-gray-50">
          <tr class="text-left border-b">
            <th class="py-2 px-3">ID</th>
            <th class="py-2 px-3">Expediente</th>
            <th class="py-2 px-3">Paciente</th>
            <th class="py-2 px-3">Clasif.</th>
            <th class="py-2 px-3">Enfermero</th>
            <th class="py-2 px-3">Médico</th>
            <th class="py-2 px-3">Registro</th>
            <th class="py-2 px-3">Inicio consulta</th>
            <th class="py-2 px-3">Acción</th>
          </tr>
          </thead>

          <tbody>
          <tr v-for="r in a.rows" :key="r.id" class="border-b">
            <td class="py-2 px-3">{{ r.id }}</td>
            <td class="py-2 px-3">{{ r.patient?.expediente || "-" }}</td>
            <td class="py-2 px-3">{{ r.patient?.fullName }}</td>
            <td class="py-2 px-3">
              <span class="text-white text-xs px-2 py-1 rounded-full" :class="badge(r.classification)">
                {{ r.classification }}
              </span>
            </td>
            <td class="py-2 px-3">{{ r.nurse?.name }}</td>
            <td class="py-2 px-3">{{ r.medicalNote?.doctor?.name || "-" }}</td>
            <td class="py-2 px-3">{{ fmtMerida(r.triageAt) }}</td>
            <td class="py-2 px-3">{{ r.medicalNote?.consultationStartedAt ? fmtMerida(r.medicalNote.consultationStartedAt) : "-" }}</td>
            <td class="py-2 px-3">
              <button class="px-3 py-1 rounded-xl border text-xs" @click="a.open(r.id)">Ver / Editar</button>
            </td>
          </tr>
          <tr v-if="!a.rows.length">
            <td colspan="9" class="py-8 text-center text-gray-500">Sin registros</td>
          </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- MODAL -->
    <div v-if="a.modalOpen && a.selected" class="fixed inset-0 bg-black/40 flex items-center justify-center p-4" @click.self="a.modalOpen=false">
      <div class="w-full max-w-5xl bg-white rounded-2xl shadow p-6 max-h-[90vh] overflow-auto">
        <div class="flex items-start justify-between gap-3 mb-4">
          <div>
            <div class="text-lg font-semibold">Detalle paciente (ID: {{ a.selected.id }})</div>
            <div class="text-sm text-gray-500">{{ a.selected.patient?.fullName }}</div>
          </div>
          <div class="flex gap-2">
            <button class="px-4 py-2 rounded-xl border" @click="a.modalOpen=false">Cerrar</button>
            <button class="px-4 py-2 rounded-xl bg-blue-600 text-white disabled:opacity-50" :disabled="a.saving" @click="a.save">
              Guardar cambios
            </button>
          </div>
        </div>

        <!-- aquí puedes partirlo en secciones (Paciente / Triage / Pago / Nota médica) -->
        <div class="grid grid-cols-2 gap-4">
          <div class="border rounded-2xl p-4 space-y-2">
            <div class="font-semibold">Paciente</div>
            <input v-model="a.selected.patient.expediente" class="w-full border rounded-xl p-2" placeholder="Expediente" />
            <input v-model="a.selected.patient.fullName" class="w-full border rounded-xl p-2" placeholder="Nombre" />
            <input v-model.number="a.selected.patient.age" type="number" class="w-full border rounded-xl p-2" placeholder="Edad" />
            <input v-model="a.selected.patient.responsibleName" class="w-full border rounded-xl p-2" placeholder="Responsable" />
            <label class="flex items-center gap-2 text-sm">
              <input type="checkbox" v-model="a.selected.patient.mayaHabla" /> Habla Maya
            </label>
          </div>

          <div class="border rounded-2xl p-4 space-y-2">
            <div class="font-semibold">Triage / Signos vitales</div>
            <div class="grid grid-cols-2 gap-2">
              <input v-model.number="a.selected.weightKg" type="number" class="border rounded-xl p-2" placeholder="Peso" />
              <input v-model.number="a.selected.heightCm" type="number" class="border rounded-xl p-2" placeholder="Talla" />
              <input v-model.number="a.selected.temperatureC" type="number" class="border rounded-xl p-2" placeholder="Temp" />
              <input v-model.number="a.selected.heartRate" type="number" class="border rounded-xl p-2" placeholder="FC" />
              <input v-model.number="a.selected.respiratoryRate" type="number" class="border rounded-xl p-2" placeholder="FR" />
              <input v-model="a.selected.bloodPressure" class="border rounded-xl p-2" placeholder="TA" />
            </div>
          </div>
        </div>

        <div class="mt-4 border rounded-2xl p-4 space-y-2">
          <div class="font-semibold">Nota médica</div>
          <textarea v-model="a.selected.medicalNote.padecimientoActual" class="w-full border rounded-xl p-2" rows="2" placeholder="Padecimiento actual" />
          <textarea v-model="a.selected.medicalNote.antecedentes" class="w-full border rounded-xl p-2" rows="2" placeholder="Antecedentes" />
          <textarea v-model="a.selected.medicalNote.exploracionFisica" class="w-full border rounded-xl p-2" rows="2" placeholder="Exploración física" />
          <textarea v-model="a.selected.medicalNote.estudiosParaclinicos" class="w-full border rounded-xl p-2" rows="2" placeholder="Estudios paraclínicos" />
          <textarea v-model="a.selected.medicalNote.diagnostico" class="w-full border rounded-xl p-2" rows="2" placeholder="Diagnóstico(s)" />
          <textarea v-model="a.selected.medicalNote.planTratamiento" class="w-full border rounded-xl p-2" rows="2" placeholder="Plan / Tratamiento" />

          <!-- ✅ VIGILANCIA -->
          <div class="border rounded-xl p-4">
            <div class="font-semibold mb-2">Datos de alarma (Vigilancia)</div>
            <div class="grid grid-cols-2 gap-2 text-sm">
              <label v-for="o in vigilanciaOptions" :key="o.key" class="flex gap-2 items-center">
                <input type="checkbox" v-model="a.selected.medicalNote.vigilancia[o.key]" />
                {{ o.label }}
              </label>
            </div>
          </div>

          <textarea v-model="a.selected.medicalNote.pronostico" class="w-full border rounded-xl p-2" rows="2" placeholder="Pronóstico" />
        </div>
      </div>
    </div>
  </div>
</template>
