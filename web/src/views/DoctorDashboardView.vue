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

function colorClass(c: string) {
  return c === "ROJO" ? "text-red-600" : c === "AMARILLO" ? "text-yellow-600" : "text-green-600";
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
  <div class="p-6 max-w-7xl mx-auto">
    <div class="bg-white rounded-2xl shadow p-6">
      <div class="flex items-center justify-between mb-4">
        <h1 class="text-2xl font-semibold">Urgencias - Médico</h1>

        <div class="flex gap-2">
          <button class="px-3 py-2 rounded-xl border text-sm"
                  :class="d.tab==='WAITING' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'hover:bg-gray-50'"
                  @click="d.tab='WAITING'">EN ESPERA</button>

          <button class="px-3 py-2 rounded-xl border text-sm"
                  :class="d.tab==='CONSULTING' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'hover:bg-gray-50'"
                  @click="d.tab='CONSULTING'">EN CONSULTA</button>

          <button class="px-3 py-2 rounded-xl border text-sm"
                  :class="d.tab==='ATTENDED' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'hover:bg-gray-50'"
                  @click="d.tab='ATTENDED'">ATENDIDO</button>

          <button class="px-3 py-2 rounded-xl border text-sm"
                  :class="d.tab==='CANCELLED' ? 'bg-red-50 border-red-200 text-red-700' : 'hover:bg-gray-50'"
                  @click="d.tab='CANCELLED'">NO ATENDIDO</button>
        </div>
      </div>

      <!-- LISTAS -->
      <div class="grid grid-cols-1 gap-3">
        <template v-if="d.tab==='WAITING'">
          <div v-for="r in d.waiting" :key="r.id" class="p-4 rounded-2xl border hover:bg-gray-50">
            <div class="flex justify-between items-start">
              <button class="text-left flex-1" @click="openDetail(r)">
                <div class="flex justify-between">
                  <div class="font-semibold">{{ r.patient.fullName }}</div>
                  <div class="font-semibold" :class="colorClass(r.classification)">{{ r.classification }}</div>
                </div>
                <div class="text-xs text-gray-500">Triage: {{ fmt(r.triageAt) }} · Enfermero: {{ r.nurse?.name }}</div>
              </button>
              <button
                class="ml-3 px-3 py-1 rounded-xl border text-xs hover:bg-red-50 text-red-700 border-red-200 shrink-0"
                @click.stop="openNoShow(r)"
              >
                No se presento
              </button>
            </div>
          </div>

          <div v-if="!d.waiting.length" class="text-gray-500 text-sm">Sin pacientes en espera.</div>
        </template>

        <template v-else-if="d.tab==='CONSULTING'">
          <div v-for="r in d.consulting" :key="r.id" class="p-4 rounded-2xl border">
            <div class="flex justify-between items-center">
              <div>
                <div class="font-semibold">{{ r.patient.fullName }}</div>
                <div class="text-xs text-gray-500">Triage: {{ fmt(r.triageAt) }}</div>
              </div>
              <button class="px-3 py-2 rounded-xl bg-blue-600 text-white text-sm" @click="resume(r)">
                Reanudar consulta
              </button>
            </div>
          </div>

          <div v-if="!d.consulting.length" class="text-gray-500 text-sm">No tienes consultas en curso.</div>
        </template>

        <template v-else-if="d.tab==='ATTENDED'">
          <div v-for="r in d.attended" :key="r.id" class="p-4 rounded-2xl border">
            <div class="flex justify-between items-center">
              <div>
                <div class="font-semibold">{{ r.patient.fullName }}</div>
                <div class="text-xs text-gray-500">Triage: {{ fmt(r.triageAt) }}</div>
              </div>
              <button class="px-3 py-2 rounded-xl bg-gray-900 text-white text-sm" @click="d.openPdf(r.id)">
                Imprimir PDF
              </button>
            </div>
          </div>

          <div v-if="!d.attended.length" class="text-gray-500 text-sm">Aun no tienes pacientes atendidos.</div>
        </template>

        <template v-else>
          <div v-for="r in d.cancelled" :key="r.id" class="p-4 rounded-2xl border border-red-100">
            <div class="flex justify-between items-center">
              <div>
                <div class="font-semibold">{{ r.patient.fullName }}</div>
                <div class="text-xs text-gray-500">Triage: {{ fmt(r.triageAt) }}</div>
                <div class="text-xs mt-1">
                  <span v-if="r.noShow" class="text-red-600 font-medium">No se presento</span>
                  <span v-else-if="r.refusedPayment" class="text-red-600 font-medium">No quiso pagar</span>
                </div>
                <div v-if="r.noShowReason" class="text-xs text-gray-500 mt-1">Razon: {{ r.noShowReason }}</div>
              </div>
              <div class="text-xs text-gray-400">
                {{ r.closedAt ? fmt(r.closedAt) : '' }}
              </div>
            </div>
          </div>

          <div v-if="!d.cancelled.length" class="text-gray-500 text-sm">Sin pacientes no atendidos.</div>
        </template>
      </div>
    </div>

    <!-- MODAL detalle (solo en espera) -->
    <div v-if="showModal" class="fixed inset-0 bg-black/30 flex items-center justify-center p-6"
         @click.self="showModal=false">
      <div class="bg-white w-full max-w-3xl rounded-2xl shadow p-6">
        <div class="flex items-start justify-between gap-4 mb-4">
          <div>
            <div class="text-lg font-semibold">Detalle del paciente</div>
            <div class="text-sm text-gray-500" v-if="d.detail">
              {{ d.detail.patient.fullName }} · {{ d.detail.classification }}
            </div>
          </div>
          <button class="px-3 py-2 rounded-xl border text-sm hover:bg-gray-50" @click="showModal=false">Cerrar</button>
        </div>

        <div v-if="modalLoading" class="text-gray-500">Cargando...</div>

        <div v-else-if="d.detail" class="space-y-3 text-sm">
          <div class="grid grid-cols-2 gap-3">
            <div class="border rounded-xl p-3">
              <div class="font-semibold mb-1">Generales</div>
              <div>Expediente: {{ d.detail.patient.expediente || "-" }}</div>
              <div>Edad: {{ d.detail.patient.age ?? "-" }} · Sexo: {{ d.detail.patient.sex ?? "-" }}</div>
              <div>Responsable: {{ d.detail.patient.responsibleName || "-" }}</div>
              <div>Maya: {{ d.detail.patient.mayaHabla ? "Sí" : "No" }}</div>
            </div>

            <div class="border rounded-xl p-3">
              <div class="font-semibold mb-1">Triage</div>
              <div>Fecha/Hora: {{ fmt(d.detail.triageAt) }}</div>
              <div>Motivo: {{ d.detail.motivoUrgencia }}</div>
              <div>Enfermero: {{ d.detail.nurse?.name }}</div>
              <div>Clasificación: <span class="font-semibold">{{ d.detail.classification }}</span></div>
            </div>
          </div>

          <div class="border rounded-xl p-3">
            <div class="font-semibold mb-1">Signos vitales</div>
            <div class="grid grid-cols-3 gap-2">
              <div>Peso: {{ d.detail.weightKg ?? "-" }}</div>
              <div>Talla: {{ d.detail.heightCm ?? "-" }}</div>
              <div>Temp: {{ d.detail.temperatureC ?? "-" }}</div>
              <div>FC: {{ d.detail.heartRate ?? "-" }}</div>
              <div>FR: {{ d.detail.respiratoryRate ?? "-" }}</div>
              <div>TA: {{ d.detail.bloodPressure ?? "-" }}</div>
            </div>
          </div>

          <div class="flex justify-end gap-2 pt-2">
            <button class="px-4 py-2 rounded-xl bg-blue-600 text-white" @click="startFromModal">
              Iniciar consulta
            </button>
          </div>
        </div>
      </div>
    </div>
    <!-- Modal no se presento al llamado -->
    <div v-if="noShowModal" class="fixed inset-0 bg-black/30 flex items-center justify-center p-6 z-40"
         @click.self="noShowModal=false">
      <div class="bg-white w-full max-w-md rounded-2xl shadow p-6">
        <div class="text-lg font-semibold mb-1 text-red-700">No se presento al llamado</div>
        <div class="text-sm text-gray-500 mb-4">
          Triage ID: {{ noShowRow?.id }} · {{ noShowRow?.patient?.fullName }}
        </div>

        <div class="text-sm text-gray-700 bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
          Esta accion cerrara el flujo del paciente. Ya no aparecera en la lista de espera.
        </div>

        <div class="mb-4">
          <label class="text-sm font-medium">Justificacion *</label>
          <textarea
            v-model="noShowReason"
            class="mt-1 w-full border rounded-xl p-2 text-sm"
            rows="3"
            placeholder="Describa la razon por la que el paciente no se presento..."
          ></textarea>
        </div>

        <div class="flex justify-end gap-2">
          <button class="px-4 py-2 rounded-xl border text-sm hover:bg-gray-50" @click="noShowModal=false">
            Cancelar
          </button>
          <button
            class="px-4 py-2 rounded-xl bg-red-600 text-white text-sm disabled:opacity-50"
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
