<script setup lang="ts">
import { onMounted, onBeforeUnmount, watch, computed } from "vue";
import { useAdminReportsStore } from "../stores/adminReports";
import { useAuthStore } from "../stores/auth";
import { useSocket } from "../composables/useSocket";

const a = useAdminReportsStore();
const auth = useAuthStore();
const { socket } = useSocket();

const isConsultor = auth.user?.role === "CONSULTOR";

function badge(c: string) {
  return c === "ROJO" ? "badge-rojo" : c === "AMARILLO" ? "badge-amarillo" : "badge-verde";
}

function tabClass(active: boolean) {
  return active ? "tab-btn tab-btn-active" : "tab-btn tab-btn-inactive";
}

function tabCancelledClass(active: boolean) {
  return active ? "tab-btn bg-red-600 border-red-600 text-white" : "tab-btn tab-btn-inactive";
}

function tabNursingClass(active: boolean) {
  return active ? "tab-btn bg-purple-600 border-purple-600 text-white" : "tab-btn tab-btn-inactive";
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

watch(
    () => a.selected,
    (v) => {
      if (v?.medicalNote) ensureVigilancia(v.medicalNote);
    },
    { immediate: true }
);

function calcAgeParts(birthDate: string | null | undefined) {
  if (!birthDate) return null;
  const birth = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  if (now.getDate() < birth.getDate()) months -= 1;
  if (months < 0) { years -= 1; months += 12; }
  if (years < 0) return null;
  return { years, months };
}

function formatFullAge(birthDate: string | null | undefined) {
  const p = calcAgeParts(birthDate);
  if (!p) return "";
  return `${p.years} ${p.years === 1 ? "año" : "años"} y ${p.months} ${p.months === 1 ? "mes" : "meses"}`;
}

const modalAgePreview = computed(() => formatFullAge(a.selected?.patient?.birthDate));

watch(
    () => a.selected?.patient?.birthDate,
    (v) => {
      if (!a.selected?.patient) return;
      const parts = calcAgeParts(v);
      a.selected.patient.age = parts
          ? `${parts.years} ${parts.years === 1 ? "año" : "años"} y ${parts.months} ${parts.months === 1 ? "mes" : "meses"}`
          : "";
    }
);

function refreshCurrent() {
  if (a.tab === "ATTENDED") a.fetch();
  else if (a.tab === "CANCELLED") a.fetchCancelled();
  else a.fetchCashierClosed();
}

onMounted(async () => {
  a.setDefaultToday();
  await a.fetch();

  socket.on("report:updated", refreshCurrent);
});

onBeforeUnmount(() => {
  socket.off("report:updated", refreshCurrent);
});
</script>

<template>
  <div class="p-6">
    <!-- Page header -->
    <div class="mb-6 flex items-start justify-between gap-4">
      <div>
        <div class="flex items-center gap-2 mb-1">
          <div class="w-2.5 h-2.5 rounded-full bg-gray-600"></div>
          <span class="text-xs font-semibold uppercase tracking-wider text-gray-600">Administrador</span>
        </div>
        <h1 class="text-2xl font-bold text-gray-800">Reportes y Registros</h1>
        <p class="text-sm text-gray-500 mt-0.5">Historial de pacientes atendidos y no atendidos</p>
      </div>

      <div class="flex items-center gap-2">
        <button
            class="btn-secondary flex items-center gap-2"
            @click="refreshCurrent"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
          Refrescar
        </button>
        <button
            class="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            @click="a.exportExcel"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          Exportar Excel
        </button>
      </div>
    </div>

    <!-- Tabs -->
    <div class="flex gap-2 mb-5">
      <button
          :class="tabClass(a.tab==='ATTENDED')"
          @click="a.tab='ATTENDED'; a.fetch()"
      >Atendidos</button>
      <button
          :class="tabCancelledClass(a.tab==='CANCELLED')"
          @click="a.tab='CANCELLED'; a.fetchCancelled()"
      >No atendidos</button>
      <button
          :class="tabNursingClass(a.tab==='CASHIER_CLOSED')"
          @click="a.tab='CASHIER_CLOSED'; a.fetchCashierClosed()"
      >Solo Enfermería</button>
    </div>

    <!-- Filtros -->
    <div class="card p-4 mb-5">
      <div class="grid grid-cols-12 gap-3">
        <input v-model="a.q" class="input-base col-span-4" placeholder="Buscar: expediente / nombre" />

        <select v-model="a.classification" class="input-base col-span-2">
          <option value="">Todas las clasificaciones</option>
          <option value="VERDE">VERDE</option>
          <option value="AMARILLO">AMARILLO</option>
          <option value="ROJO">ROJO</option>
        </select>

        <div class="col-span-2">
          <input v-model="a.startDate" type="date" class="input-base" />
        </div>
        <div class="col-span-2">
          <input v-model="a.endDate" type="date" class="input-base" />
        </div>

        <button
            class="col-span-2 btn-primary"
            @click="refreshCurrent"
        >
          Aplicar filtros
        </button>
      </div>
    </div>

    <!-- TAB ATENDIDOS -->
    <template v-if="a.tab==='ATTENDED'">
      <!-- KPI cards -->
      <div v-if="a.kpi" class="grid grid-cols-3 gap-4 mb-5">
        <div class="card p-5 border-l-4 border-l-emerald-500">
          <div class="flex items-center justify-between mb-3">
            <span class="badge-verde">VERDE</span>
            <span class="text-2xl font-bold text-gray-800">{{ a.kpi.VERDE.pct }}%</span>
          </div>
          <div class="text-sm text-gray-600">
            Cumple SLA: <span class="font-semibold">{{ a.kpi.VERDE.ok }}</span> / {{ a.kpi.VERDE.total }}
          </div>
          <div class="mt-2 h-1.5 bg-gray-100 rounded-full">
            <div class="h-1.5 bg-emerald-500 rounded-full transition-all" :style="`width:${a.kpi.VERDE.pct}%`"></div>
          </div>
        </div>

        <div class="card p-5 border-l-4 border-l-amber-400">
          <div class="flex items-center justify-between mb-3">
            <span class="badge-amarillo">AMARILLO</span>
            <span class="text-2xl font-bold text-gray-800">{{ a.kpi.AMARILLO.pct }}%</span>
          </div>
          <div class="text-sm text-gray-600">
            Cumple SLA: <span class="font-semibold">{{ a.kpi.AMARILLO.ok }}</span> / {{ a.kpi.AMARILLO.total }}
          </div>
          <div class="mt-2 h-1.5 bg-gray-100 rounded-full">
            <div class="h-1.5 bg-amber-400 rounded-full transition-all" :style="`width:${a.kpi.AMARILLO.pct}%`"></div>
          </div>
        </div>

        <div class="card p-5 border-l-4 border-l-red-500">
          <div class="flex items-center justify-between mb-3">
            <span class="badge-rojo">ROJO</span>
            <span class="text-2xl font-bold text-gray-800">{{ a.kpi.ROJO.pct }}%</span>
          </div>
          <div class="text-sm text-gray-600">
            Cumple SLA: <span class="font-semibold">{{ a.kpi.ROJO.ok }}</span> / {{ a.kpi.ROJO.total }}
          </div>
          <div class="mt-2 h-1.5 bg-gray-100 rounded-full">
            <div class="h-1.5 bg-red-500 rounded-full transition-all" :style="`width:${a.kpi.ROJO.pct}%`"></div>
          </div>
        </div>
      </div>

      <div class="card overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 border-b border-gray-100">
          <tr>
            <th class="th">Expediente</th>
            <th class="th">Paciente</th>
            <th class="th">Clasif.</th>
            <th class="th">Enfermero</th>
            <th class="th">Médico</th>
            <th class="th">Registro</th>
            <th class="th">Inicio consulta</th>
            <th class="th">Acción</th>
          </tr>
          </thead>
          <tbody class="divide-y divide-gray-50">
          <tr v-for="r in a.rows" :key="r.id" class="hover:bg-gray-100 transition-colors">
            <td class="td font-mono text-xs">{{ r.patient?.expediente || "—" }}</td>
            <td class="td font-semibold text-gray-800">{{ r.patient?.fullName }}</td>
            <td class="td"><span :class="badge(r.classification)">{{ r.classification }}</span></td>
            <td class="td text-gray-500">{{ r.nurse?.name }}</td>
            <td class="td text-gray-500">{{ r.medicalNote?.doctor?.name || "—" }}</td>
            <td class="td text-gray-500 text-xs whitespace-nowrap">{{ fmtMerida(r.triageAt) }}</td>
            <td class="td text-gray-500 text-xs whitespace-nowrap">
              {{ r.medicalNote?.consultationStartedAt ? fmtMerida(r.medicalNote.consultationStartedAt) : "—" }}
            </td>
            <td class="td">
              <button
                  class="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  :disabled="isConsultor"
                  @click="a.open(r.id)"
              >{{ isConsultor ? "Solo lectura" : "Ver / Editar" }}</button>
            </td>
          </tr>
          <tr v-if="!a.rows.length">
            <td colspan="8" class="py-12 text-center text-gray-400">
              <p class="text-sm">Sin registros para los filtros seleccionados</p>
            </td>
          </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- TAB NO ATENDIDOS -->
    <template v-else-if="a.tab==='CANCELLED'">
      <div class="card overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 border-b border-gray-100">
          <tr>
            <th class="th">Fecha/Hora</th>
            <th class="th">Expediente</th>
            <th class="th">Paciente</th>
            <th class="th">Motivo</th>
            <th class="th">Clasif.</th>
            <th class="th">Enfermero</th>
            <th class="th">Razón</th>
            <th class="th">Detalle</th>
            <th class="th">Fecha cierre</th>
          </tr>
          </thead>
          <tbody class="divide-y divide-gray-50">
          <tr v-for="r in a.cancelledRows" :key="r.id" class="hover:bg-gray-100 transition-colors">
            <td class="td text-gray-500 text-xs whitespace-nowrap">{{ fmtMerida(r.triageAt) }}</td>
            <td class="td font-mono text-xs">{{ r.patient?.expediente || "—" }}</td>
            <td class="td font-semibold text-gray-800">{{ r.patient?.fullName }}</td>
            <td class="td text-gray-500">{{ r.motivoUrgencia }}</td>
            <td class="td"><span :class="badge(r.classification)">{{ r.classification }}</span></td>
            <td class="td text-gray-500">{{ r.nurse?.name }}</td>
            <td class="td">
              <span v-if="r.noShow" class="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">No se presentó</span>
              <span v-else-if="r.refusedPayment" class="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">No quiso pagar</span>
            </td>
            <td class="td text-xs text-gray-500">
              <div v-if="r.noShowReason">{{ r.noShowReason }}</div>
              <div v-if="r.noShowDoctor" class="text-gray-400">Dr. {{ r.noShowDoctor.name }}</div>
            </td>
            <td class="td text-gray-500 text-xs whitespace-nowrap">{{ r.closedAt ? fmtMerida(r.closedAt) : '—' }}</td>
          </tr>
          <tr v-if="!a.cancelledRows.length">
            <td colspan="9" class="py-12 text-center text-gray-400">
              <p class="text-sm">Sin registros de pacientes no atendidos</p>
            </td>
          </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- TAB SOLO ENFERMERÍA -->
    <template v-else>
      <div class="card overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 border-b border-gray-100">
          <tr>
            <th class="th">Fecha/Hora</th>
            <th class="th">Expediente</th>
            <th class="th">Paciente</th>
            <th class="th">Motivo</th>
            <th class="th">Clasif.</th>
            <th class="th">Enfermero</th>
            <th class="th">Cajero</th>
            <th class="th">Fecha cierre</th>
          </tr>
          </thead>
          <tbody class="divide-y divide-gray-50">
          <tr v-for="r in a.cashierClosedRows" :key="r.id" class="hover:bg-gray-100 transition-colors">
            <td class="td text-gray-500 text-xs whitespace-nowrap">{{ fmtMerida(r.triageAt) }}</td>
            <td class="td font-mono text-xs">{{ r.patient?.expediente || "—" }}</td>
            <td class="td font-semibold text-gray-800">{{ r.patient?.fullName }}</td>
            <td class="td text-gray-500">{{ r.motivoUrgencia }}</td>
            <td class="td"><span :class="badge(r.classification)">{{ r.classification }}</span></td>
            <td class="td text-gray-500">{{ r.nurse?.name }}</td>
            <td class="td text-gray-500">{{ r.payment?.cashier?.name || "—" }}</td>
            <td class="td text-gray-500 text-xs whitespace-nowrap">{{ r.closedAt ? fmtMerida(r.closedAt) : "—" }}</td>
          </tr>
          <tr v-if="!a.cashierClosedRows.length">
            <td colspan="8" class="py-12 text-center text-gray-400">
              <p class="text-sm">Sin registros de atención solo por enfermería</p>
            </td>
          </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- MODAL edición -->
    <div
        v-if="a.modalOpen && a.selected"
        class="overlay-backdrop flex items-center justify-center p-4 z-40"
        @click.self="a.modalOpen=false"
    >
      <div class="w-full max-w-5xl bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div class="bg-gray-50 border-b px-6 py-4 flex items-start justify-between gap-3 shrink-0">
          <div>
            <h2 class="font-bold text-gray-800">Detalle del paciente</h2>
            <p class="text-sm text-gray-500">{{ a.selected.patient?.fullName }}</p>
          </div>
          <div class="flex gap-2">
            <button class="btn-secondary" @click="a.modalOpen=false">Cerrar</button>
            <button
                v-if="!isConsultor"
                class="btn-primary disabled:opacity-50"
                :disabled="a.saving"
                @click="a.save"
            >
              Guardar cambios
            </button>
          </div>
        </div>

        <div class="overflow-auto p-6 space-y-5">

          <!-- Paciente + Signos vitales -->
          <div class="grid grid-cols-2 gap-5">
            <div class="card p-5">
              <p class="section-label">Paciente</p>
              <div class="space-y-3">
                <input v-model="a.selected.patient.expediente" class="input-base" placeholder="Expediente" />
                <input v-model="a.selected.patient.fullName" class="input-base" placeholder="Nombre completo" />

                <!-- Fecha de nacimiento + edad calculada -->
                <div>
                  <label class="block text-xs font-medium text-gray-600 mb-1">Fecha de nacimiento</label>
                  <input v-model="a.selected.patient.birthDate" type="date" class="input-base" />
                  <p v-if="modalAgePreview" class="text-xs text-blue-600 mt-1 font-medium">Edad: {{ modalAgePreview }}</p>
                </div>

                <div>
                  <label class="block text-xs font-medium text-gray-600 mb-1">Sexo</label>
                  <select v-model="a.selected.patient.sex" class="input-base">
                    <option value="M">Masculino</option>
                    <option value="F">Femenino</option>
                  </select>
                </div>
                <input v-model="a.selected.patient.responsibleName" class="input-base" placeholder="Responsable" />
                <label class="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" v-model="a.selected.patient.mayaHabla" class="rounded" /> Habla Maya
                </label>
              </div>
            </div>

            <div class="card p-5">
              <p class="section-label">Signos vitales</p>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-medium text-gray-600 mb-1">Peso (kg)</label>
                  <input v-model.number="a.selected.weightKg" type="number" class="input-base" placeholder="0.0" />
                </div>
                <div>
                  <label class="block text-xs font-medium text-gray-600 mb-1">Talla (cm)</label>
                  <input v-model.number="a.selected.heightCm" type="number" class="input-base" placeholder="0" />
                </div>
                <div>
                  <label class="block text-xs font-medium text-gray-600 mb-1">Temp (°C)</label>
                  <input v-model.number="a.selected.temperatureC" type="number" class="input-base" placeholder="36.5" />
                </div>
                <div>
                  <label class="block text-xs font-medium text-gray-600 mb-1">F.C.</label>
                  <input v-model.number="a.selected.heartRate" type="number" class="input-base" placeholder="lpm" />
                </div>
                <div>
                  <label class="block text-xs font-medium text-gray-600 mb-1">F.R.</label>
                  <input v-model.number="a.selected.respiratoryRate" type="number" class="input-base" placeholder="rpm" />
                </div>
                <div>
                  <label class="block text-xs font-medium text-gray-600 mb-1">T.A.</label>
                  <input v-model="a.selected.bloodPressure" class="input-base" placeholder="120/80" />
                </div>
              </div>
            </div>
          </div>

          <!-- Evaluación de triage (solo lectura) -->
          <div class="card p-5">
            <div class="flex items-center justify-between mb-3">
              <p class="section-label mb-0">Evaluación de triage</p>
              <span class="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Solo lectura — registrado por enfermería</span>
            </div>
            <div class="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label class="block text-xs font-medium text-gray-500 mb-1">Motivo de urgencia</label>
                <p class="input-base bg-gray-50 text-gray-700 cursor-default">{{ a.selected.motivoUrgencia || "—" }}</p>
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-500 mb-1">Clasificación</label>
                <p class="input-base bg-gray-50 cursor-default"><span :class="badge(a.selected.classification)">{{ a.selected.classification }}</span></p>
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-500 mb-1">Apariencia</label>
                <p class="input-base bg-gray-50 cursor-default"><span :class="badge(a.selected.appearance)">{{ a.selected.appearance }}</span></p>
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-500 mb-1">Respiración</label>
                <p class="input-base bg-gray-50 cursor-default"><span :class="badge(a.selected.respiration)">{{ a.selected.respiration }}</span></p>
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-500 mb-1">Circulación</label>
                <p class="input-base bg-gray-50 cursor-default"><span :class="badge(a.selected.circulation)">{{ a.selected.circulation }}</span></p>
              </div>
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">Observaciones de enfermería</label>
              <textarea v-model="a.selected.observaciones" class="input-base resize-none" rows="2" placeholder="Observaciones" />
            </div>
          </div>

          <!-- Antecedentes y referencia -->
          <div class="card p-5">
            <p class="section-label">Antecedentes y referencia</p>
            <div class="space-y-3">
              <label class="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" v-model="a.selected.hadPriorCareSamePathology" class="rounded" />
                Atención previa por la misma patología
              </label>
              <input
                  v-if="a.selected.hadPriorCareSamePathology"
                  v-model="a.selected.priorCarePlace"
                  class="input-base"
                  placeholder="Lugar de atención previa"
              />
              <label class="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" v-model="a.selected.hasReferral" class="rounded" />
                Viene referido de otro lugar
              </label>
              <input
                  v-if="a.selected.hasReferral"
                  v-model="a.selected.referralPlace"
                  class="input-base"
                  placeholder="Lugar de referencia"
              />
            </div>
          </div>

          <!-- Nota médica -->
          <div class="card p-5">
            <p class="section-label">Nota médica</p>
            <div class="space-y-3">
              <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">Padecimiento actual</label>
                <textarea v-model="a.selected.medicalNote.padecimientoActual" class="input-base resize-none" rows="2" placeholder="Padecimiento actual" />
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">Antecedentes</label>
                <textarea v-model="a.selected.medicalNote.antecedentes" class="input-base resize-none" rows="2" placeholder="Antecedentes" />
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">Exploración física</label>
                <textarea v-model="a.selected.medicalNote.exploracionFisica" class="input-base resize-none" rows="2" placeholder="Exploración física" />
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">Estudios paraclínicos</label>
                <textarea v-model="a.selected.medicalNote.estudiosParaclinicos" class="input-base resize-none" rows="2" placeholder="Estudios paraclínicos" />
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">Diagnóstico(s)</label>
                <textarea v-model="a.selected.medicalNote.diagnostico" class="input-base resize-none" rows="2" placeholder="Diagnóstico(s)" />
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">Plan / Tratamiento</label>
                <textarea v-model="a.selected.medicalNote.planTratamiento" class="input-base resize-none" rows="2" placeholder="Plan / Tratamiento" />
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">Datos de alarma</label>
                <textarea v-model="a.selected.medicalNote.vigilanciaTexto" class="input-base resize-none" rows="2" placeholder="Datos de alarma" />
              </div>
              <div>
                <label class="flex items-center gap-2 text-sm cursor-pointer mb-2">
                  <input type="checkbox" v-model="a.selected.medicalNote.contraRefFollowUp" class="rounded" />
                  Contrarreferencia / Seguimiento
                </label>
                <input
                    v-if="a.selected.medicalNote.contraRefFollowUp"
                    v-model="a.selected.medicalNote.contraRefWhen"
                    class="input-base"
                    placeholder="¿En cuánto tiempo?"
                />
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">Pronóstico</label>
                <textarea v-model="a.selected.medicalNote.pronostico" class="input-base resize-none" rows="2" placeholder="Pronóstico" />
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  </div>
</template>
