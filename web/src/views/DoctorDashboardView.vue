<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from "vue";
import { useRouter } from "vue-router";
import { useDoctorStore } from "../stores/doctor";

const d = useDoctorStore();
const router = useRouter();

const showModal = ref(false);
const modalLoading = ref(false);

// modal no-show
const noShowModal = ref(false);
const noShowRow = ref<any>(null);
const noShowReason = ref("");
const noShowLoading = ref(false);

function openNoShow(r: any) {
  noShowRow.value = r;
  noShowReason.value = "";
  noShowModal.value = true;
}

async function confirmNoShow() {
  if (!noShowRow.value || !noShowReason.value.trim()) return;
  noShowLoading.value = true;
  try {
    await d.markNoShow(noShowRow.value.id, noShowReason.value.trim());
    noShowModal.value = false;
    noShowRow.value = null;
    noShowReason.value = "";
    alert("Paciente marcado como 'No se presento al llamado'. El flujo quedo cerrado.");
  } catch (e: any) {
    alert(`Error: ${e?.response?.data?.error || e.message || "Desconocido"}`);
  } finally {
    noShowLoading.value = false;
  }
}

function fmt(iso: string) {
  const dt = new Date(iso);
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Merida",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  }).format(dt);
}

function colorBg(c: string) {
  return c === "ROJO" ? "border-l-red-500" : c === "AMARILLO" ? "border-l-amber-400" : "border-l-emerald-500";
}

function badgeClass(c: string) {
  return c === "ROJO" ? "badge-rojo" : c === "AMARILLO" ? "badge-amarillo" : "badge-verde";
}

function tabClass(active: boolean) {
  return active ? "tab-btn tab-btn-active" : "tab-btn tab-btn-inactive";
}

function tabCancelledClass(active: boolean) {
  return active ? "tab-btn bg-red-600 border-red-600 text-white" : "tab-btn tab-btn-inactive";
}

function cardWaitingClass(c: string) {
  return "card border-l-4 p-5 hover:shadow-md transition-shadow cursor-pointer " + colorBg(c);
}

function detailBadgeClass(c: string) {
  return "badge-" + c.toLowerCase();
}

async function openDetail(row: any) {
  d.select(row);
  showModal.value = true;
  modalLoading.value = true;
  try {
    await d.loadDetail(row.id);
  } finally {
    modalLoading.value = false;
  }
}

async function startFromModal() {
  if (!d.selected) return;
  await d.start(d.selected.id);
  showModal.value = false;
  router.push(`/doctor/consult/${d.selected.id}`);
}

function resume(row: any) {
  router.push(`/doctor/consult/${row.id}`);
}

onMounted(async () => {
  d.initRealtime();
  await d.refreshAll();
});

onBeforeUnmount(() => d.disposeRealtime());
</script>

<template>
  <div class="p-6">
    <!-- Page header -->
    <div class="mb-6 flex items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2 mb-1">
          <div class="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
          <span class="text-xs font-semibold uppercase tracking-wider text-blue-600">Urgencias</span>
        </div>
        <h1 class="text-2xl font-bold text-gray-800">Panel Médico</h1>
        <p class="text-sm text-gray-500 mt-0.5">Gestión de pacientes en espera y consulta</p>
      </div>

      <!-- Tabs -->
      <div class="flex gap-2">
        <button
            :class="tabClass(d.tab==='WAITING')"
            @click="d.tab='WAITING'"
        >
          <span class="flex items-center gap-1.5">
            En espera
            <span v-if="d.waiting.length" class="bg-white bg-opacity-30 text-xs rounded-full px-1.5">{{ d.waiting.length }}</span>
          </span>
        </button>
        <button
            :class="tabClass(d.tab==='CONSULTING')"
            @click="d.tab='CONSULTING'"
        >
          <span class="flex items-center gap-1.5">
            En consulta
            <span v-if="d.consulting.length" class="bg-white bg-opacity-30 text-xs rounded-full px-1.5">{{ d.consulting.length }}</span>
          </span>
        </button>
        <button
            :class="tabClass(d.tab==='ATTENDED')"
            @click="d.tab='ATTENDED'"
        >Atendido</button>
        <button
            :class="tabCancelledClass(d.tab==='CANCELLED')"
            @click="d.tab='CANCELLED'"
        >No atendido</button>
      </div>
    </div>

    <!-- EN ESPERA -->
    <template v-if="d.tab==='WAITING'">
      <div class="space-y-3">
        <div
            v-for="r in d.waiting"
            :key="r.id"
            :class="cardWaitingClass(r.classification)"
        >
          <div class="flex items-start justify-between gap-4">
            <button class="text-left flex-1" @click="openDetail(r)">
              <div class="flex items-center gap-3 mb-1">
                <span :class="badgeClass(r.classification)">{{ r.classification }}</span>
                <span class="font-bold text-gray-800 text-base">{{ r.patient.fullName }}</span>
              </div>
              <div class="text-sm text-gray-500">
                {{ r.motivoUrgencia }}
                <span class="mx-1.5">·</span>
                Triage: {{ fmt(r.triageAt) }}
                <span class="mx-1.5">·</span>
                Enfermero: {{ r.nurse?.name || "—" }}
              </div>
            </button>

            <div class="flex items-center gap-2 shrink-0">
              <button
                  class="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
                  @click.stop="openDetail(r)"
              >
                Iniciar consulta
              </button>
              <button
                  class="px-3 py-2 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm font-medium hover:bg-red-100 transition-colors"
                  @click.stop="openNoShow(r)"
              >
                No se presentó
              </button>
            </div>
          </div>
        </div>

        <div v-if="!d.waiting.length" class="card p-12 text-center text-gray-400">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
          </svg>
          <p class="text-sm">Sin pacientes en espera</p>
        </div>
      </div>
    </template>

    <!-- EN CONSULTA -->
    <template v-else-if="d.tab==='CONSULTING'">
      <div class="space-y-3">
        <div v-for="r in d.consulting" :key="r.id" class="card border-l-4 border-l-blue-400 p-5">
          <div class="flex items-center justify-between gap-4">
            <div>
              <div class="flex items-center gap-2 mb-1">
                <span class="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
                <span class="font-bold text-gray-800">{{ r.patient.fullName }}</span>
              </div>
              <div class="text-sm text-gray-500">Triage: {{ fmt(r.triageAt) }}</div>
            </div>
            <button class="btn-primary" @click="resume(r)">Reanudar consulta</button>
          </div>
        </div>

        <div v-if="!d.consulting.length" class="card p-12 text-center text-gray-400">
          <p class="text-sm">No tienes consultas en curso</p>
        </div>
      </div>
    </template>

    <!-- ATENDIDO -->
    <template v-else-if="d.tab==='ATTENDED'">
      <div class="space-y-3">
        <div v-for="r in d.attended" :key="r.id" class="card border-l-4 border-l-emerald-400 p-5">
          <div class="flex items-center justify-between gap-4">
            <div>
              <div class="flex items-center gap-2 mb-1">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                </svg>
                <span class="font-bold text-gray-800">{{ r.patient.fullName }}</span>
              </div>
              <div class="text-sm text-gray-500">Triage: {{ fmt(r.triageAt) }}</div>
            </div>
            <button class="btn-secondary" @click="d.openPdf(r.id)">
              <span class="flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
                </svg>
                Imprimir PDF
              </span>
            </button>
          </div>
        </div>

        <div v-if="!d.attended.length" class="card p-12 text-center text-gray-400">
          <p class="text-sm">Aún no tienes pacientes atendidos</p>
        </div>
      </div>
    </template>

    <!-- NO ATENDIDO -->
    <template v-else>
      <div class="space-y-3">
        <div v-for="r in d.cancelled" :key="r.id" class="card border-l-4 border-l-red-400 p-5">
          <div class="flex items-center justify-between gap-4">
            <div>
              <div class="flex items-center gap-2 mb-1">
                <span class="font-bold text-gray-800">{{ r.patient.fullName }}</span>
                <span v-if="r.noShow" class="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">No se presentó</span>
                <span v-else-if="r.refusedPayment" class="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">No quiso pagar</span>
              </div>
              <div class="text-sm text-gray-500">Triage: {{ fmt(r.triageAt) }}</div>
              <div v-if="r.noShowReason" class="text-xs text-gray-400 mt-1">Razón: {{ r.noShowReason }}</div>
            </div>
            <div class="text-xs text-gray-400 text-right">
              <div v-if="r.closedAt">{{ fmt(r.closedAt) }}</div>
            </div>
          </div>
        </div>

        <div v-if="!d.cancelled.length" class="card p-12 text-center text-gray-400">
          <p class="text-sm">Sin pacientes no atendidos</p>
        </div>
      </div>
    </template>

    <!-- MODAL detalle / iniciar consulta -->
    <div
        v-if="showModal"
        class="overlay-backdrop flex items-center justify-center p-6 z-40"
        @click.self="showModal=false"
    >
      <div class="bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden">
        <div class="bg-gray-50 border-b px-6 py-4 flex items-start justify-between gap-4">
          <div>
            <h2 class="font-bold text-gray-800">Detalle del paciente</h2>
            <p class="text-sm text-gray-500" v-if="d.detail">
              {{ d.detail.patient.fullName }}
              <span class="ml-2" :class="detailBadgeClass(d.detail.classification)">{{ d.detail.classification }}</span>
            </p>
          </div>
          <button class="btn-secondary text-xs py-1.5" @click="showModal=false">Cerrar</button>
        </div>

        <div class="p-6">
          <div v-if="modalLoading" class="py-12 text-center text-gray-400">
            <svg class="animate-spin w-8 h-8 mx-auto mb-2 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            Cargando...
          </div>

          <div v-else-if="d.detail" class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div class="bg-gray-50 rounded-xl p-4">
                <p class="section-label">Datos generales</p>
                <div class="space-y-1 text-sm text-gray-700">
                  <div>Expediente: <span class="font-semibold">{{ d.detail.patient.expediente || "—" }}</span></div>
                  <div>Edad: <span class="font-semibold">{{ d.detail.patient.age ?? "—" }}</span> · Sexo: <span class="font-semibold">{{ d.detail.patient.sex ?? "—" }}</span></div>
                  <div>Responsable: {{ d.detail.patient.responsibleName || "—" }}</div>
                  <div v-if="d.detail.patient.mayaHabla" class="text-purple-600 font-medium">Habla Maya</div>
                </div>
              </div>

              <div class="bg-gray-50 rounded-xl p-4">
                <p class="section-label">Triage</p>
                <div class="space-y-1 text-sm text-gray-700">
                  <div>Fecha: {{ fmt(d.detail.triageAt) }}</div>
                  <div>Motivo: <span class="font-semibold">{{ d.detail.motivoUrgencia }}</span></div>
                  <div>Enfermero: {{ d.detail.nurse?.name || "—" }}</div>
                </div>
              </div>
            </div>

            <div class="bg-gray-50 rounded-xl p-4">
              <p class="section-label">Signos vitales</p>
              <div class="grid grid-cols-6 gap-3 text-sm">
                <div class="text-center"><div class="text-xs text-gray-400 mb-1">Peso</div><div class="font-semibold">{{ d.detail.weightKg ?? "—" }}</div></div>
                <div class="text-center"><div class="text-xs text-gray-400 mb-1">Talla</div><div class="font-semibold">{{ d.detail.heightCm ?? "—" }}</div></div>
                <div class="text-center"><div class="text-xs text-gray-400 mb-1">Temp</div><div class="font-semibold">{{ d.detail.temperatureC ?? "—" }}</div></div>
                <div class="text-center"><div class="text-xs text-gray-400 mb-1">F.C.</div><div class="font-semibold">{{ d.detail.heartRate ?? "—" }}</div></div>
                <div class="text-center"><div class="text-xs text-gray-400 mb-1">F.R.</div><div class="font-semibold">{{ d.detail.respiratoryRate ?? "—" }}</div></div>
                <div class="text-center"><div class="text-xs text-gray-400 mb-1">T.A.</div><div class="font-semibold">{{ d.detail.bloodPressure ?? "—" }}</div></div>
              </div>
            </div>

            <div class="flex justify-end">
              <button class="btn-primary px-6 py-2.5" @click="startFromModal">
                Iniciar consulta
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal no se presentó -->
    <div
        v-if="noShowModal"
        class="overlay-backdrop flex items-center justify-center p-6 z-40"
        @click.self="noShowModal=false"
    >
      <div class="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6">
        <div class="flex items-center gap-3 mb-5">
          <div class="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
            </svg>
          </div>
          <div>
            <div class="font-bold text-red-700">No se presentó al llamado</div>
            <div class="text-xs text-gray-500">{{ noShowRow?.patient?.fullName }}</div>
          </div>
        </div>

        <div class="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 mb-4">
          Esta acción cerrará el flujo. El paciente ya no aparecerá en la lista de espera.
        </div>

        <div class="mb-5">
          <label class="block text-sm font-medium text-gray-700 mb-1.5">Justificación <span class="text-red-500">*</span></label>
          <textarea
              v-model="noShowReason"
              class="input-base resize-none"
              rows="3"
              placeholder="Describa la razón por la que el paciente no se presentó..."
          ></textarea>
        </div>

        <div class="flex justify-end gap-2">
          <button class="btn-secondary" @click="noShowModal=false">Cancelar</button>
          <button
              class="btn-danger"
              :disabled="noShowLoading || !noShowReason.trim()"
              @click="confirmNoShow"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
