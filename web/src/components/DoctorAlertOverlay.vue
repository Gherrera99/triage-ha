<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from "vue";
import { useDoctorStore } from "../stores/doctor";

const d = useDoctorStore();

const queue = computed(() => d.alertQueue ?? []);
const current = computed(() => queue.value[0] ?? null);

const showQueue = ref(false);

// Modal detalle
const showDetail = ref(false);
const detailLoading = ref(false);
const detail = ref<any | null>(null);
const detailError = ref<string | null>(null);

function clsBorder(c: string) {
  if (c === "ROJO") return "border-red-500";
  if (c === "AMARILLO") return "border-yellow-400";
  return "border-green-500";
}
function clsDot(c: string) {
  if (c === "ROJO") return "bg-red-600";
  if (c === "AMARILLO") return "bg-yellow-500";
  return "bg-green-600";
}
function clsText(c: string) {
  if (c === "ROJO") return "text-red-700";
  if (c === "AMARILLO") return "text-yellow-700";
  return "text-green-700";
}
function clsBadge(c: string) {
  if (c === "ROJO") return "bg-red-500";
  if (c === "AMARILLO") return "bg-amber-400";
  return "bg-emerald-500";
}

// Computed classes
const cardClass = computed(() =>
  "w-full max-w-2xl rounded-2xl shadow-2xl border-l-8 bg-white p-6 " + clsBorder(current.value?.classification ?? "")
);
const dotClass = computed(() =>
  "w-3 h-3 rounded-full animate-pulse shrink-0 " + clsDot(current.value?.classification ?? "")
);
const classifTextClass = computed(() =>
  "text-sm font-semibold " + clsText(current.value?.classification ?? "")
);
const badgeClass = computed(() =>
  "text-xs px-2 py-0.5 rounded-full font-semibold text-white " + clsBadge(current.value?.classification ?? "")
);
const paidClass = computed(() =>
  "font-semibold " + (detail.value?.paidStatus === "PAID" ? "text-emerald-600" : "text-orange-600")
);
const appearanceClass = computed(() => "font-bold " + clsText(detail.value?.appearance ?? ""));
const respirationClass = computed(() => "font-bold " + clsText(detail.value?.respiration ?? ""));
const circulationClass = computed(() => "font-bold " + clsText(detail.value?.circulation ?? ""));
const detailClassifClass = computed(() => "font-bold " + clsText(detail.value?.classification ?? ""));

function queueItemClass(idx: number) {
  const base = "w-full text-left p-3 rounded-xl border bg-white hover:bg-gray-50 transition-colors ";
  return idx === 0 ? base + "ring-2 ring-blue-400 border-blue-200" : base + "border-gray-200";
}
function queueItemTextClass(c: string) {
  return "text-xs font-bold " + clsText(c);
}

function fmt(iso: string) {
  const dt = new Date(iso);
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Merida",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(dt);
}

function ack() {
  d.acknowledgeCurrentAlert();
}

function focus(triageId: number) {
  d.focusAlert(triageId);
}

async function openDetail() {
  if (!current.value) return;
  showDetail.value = true;
}

async function loadDetail(triageId: number) {
  detailLoading.value = true;
  detailError.value = null;
  detail.value = null;
  try {
    detail.value = await d.fetchTriageDetail(triageId);
  } catch (e: any) {
    detailError.value = e?.response?.data?.error || e?.message || "Error cargando detalle";
  } finally {
    detailLoading.value = false;
  }
}

watch(
  () => showDetail.value,
  async (v) => {
    if (!v) return;
    if (!current.value?.id) return;
    await loadDetail(current.value.id);
  }
);

watch(
  () => current.value?.id,
  async (id) => {
    if (!showDetail.value) return;
    if (!id) return;
    await loadDetail(id);
  }
);

function onKey(e: KeyboardEvent) {
  if (!current.value) return;
  if (e.key === "Enter") ack();
  if (e.key === "Escape" && showDetail.value) showDetail.value = false;
}

onMounted(() => {
  d.initRealtime();
  window.addEventListener("keydown", onKey);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKey);
});
</script>

<template>
  <div v-if="current" class="overlay-backdrop p-6 z-50">
    <div :class="cardClass">

      <!-- HEADER -->
      <div class="flex items-start justify-between gap-4 mb-4">
        <div class="flex items-center gap-3">
          <span :class="dotClass"></span>
          <div>
            <div class="text-lg font-bold text-gray-800">Nuevo paciente en espera</div>
            <div :class="classifTextClass">
              Clasificacion {{ current.classification }}
            </div>
          </div>
        </div>

        <div class="text-right">
          <div class="text-xs font-semibold text-gray-600 mb-1">{{ queue.length }} alerta(s)</div>
          <button
            class="px-3 py-1 rounded-lg border border-gray-200 text-xs bg-white hover:bg-gray-50 transition-colors"
            @click="showQueue = !showQueue"
          >
            {{ showQueue ? "Ocultar cola" : "Ver cola" }}
          </button>
        </div>
      </div>

      <!-- BODY -->
      <div class="bg-gray-50 rounded-xl p-4 mb-4 text-sm">
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="font-bold text-gray-800 text-base">{{ current.patient?.fullName }}</div>
            <div class="text-gray-600 mt-1">Motivo: {{ current.motivoUrgencia }}</div>
            <div class="text-gray-500">Enfermero: {{ current.nurse?.name || "-" }}</div>
          </div>
          <div class="text-right text-gray-500 text-xs">
            <div>ID #{{ current.id }}</div>
            <div v-if="current.triageAt">{{ fmt(current.triageAt) }}</div>
          </div>
        </div>
      </div>

      <!-- COLA -->
      <div v-if="showQueue" class="mb-4 border border-gray-200 rounded-xl p-4">
        <div class="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Cola de alertas</div>
        <div class="max-h-40 overflow-auto space-y-2">
          <button
            v-for="(a, idx) in queue"
            :key="a.id"
            :class="queueItemClass(idx)"
            @click="focus(a.id)"
          >
            <div class="flex items-center justify-between">
              <span class="font-semibold text-sm text-gray-800">
                {{ a.patient?.fullName }}
                <span class="text-xs text-gray-400 font-normal ml-1">ID #{{ a.id }}</span>
              </span>
              <span :class="queueItemTextClass(a.classification)">{{ a.classification }}</span>
            </div>
            <div class="text-xs text-gray-500 mt-0.5">{{ a.motivoUrgencia }} - {{ a.nurse?.name || "-" }}</div>
          </button>
        </div>
      </div>

      <!-- BOTONES -->
      <div class="flex items-center justify-between">
        <span class="text-xs text-gray-400">Presiona Enter para descartar</span>
        <div class="flex gap-2">
          <button class="btn-secondary" @click="openDetail">Ver detalle</button>
          <button class="btn-primary" @click="ack">Enterado</button>
        </div>
      </div>
    </div>

    <!-- MODAL DETALLE -->
    <div v-if="showDetail" class="overlay-backdrop p-6 z-60" @click.self="showDetail = false">
      <div class="w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div class="bg-gray-50 border-b px-6 py-4 flex items-start justify-between gap-3">
          <div>
            <h2 class="font-bold text-gray-800">Detalle del paciente</h2>
            <div v-if="current" class="flex items-center gap-2 mt-0.5">
              <span class="text-sm text-gray-500">ID #{{ current.id }}</span>
              <span :class="badgeClass">{{ current.classification }}</span>
            </div>
          </div>
          <button class="btn-secondary text-xs py-1.5" @click="showDetail = false">Cerrar</button>
        </div>

        <div class="p-6">
          <div v-if="detailLoading" class="py-10 text-center text-gray-400">
            <svg class="animate-spin w-7 h-7 mx-auto mb-2 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            Cargando...
          </div>

          <div v-else-if="detailError" class="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
            {{ detailError }}
          </div>

          <div v-else-if="detail" class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div class="bg-gray-50 rounded-xl p-4 text-sm">
                <p class="section-label">Paciente</p>
                <div class="font-bold text-gray-800">{{ detail.patient?.fullName }}</div>
                <div class="text-gray-600 mt-1">
                  Exp: {{ detail.patient?.expediente || "-" }} -
                  Edad: {{ detail.patient?.age ?? "-" }} -
                  Sexo: {{ detail.patient?.sex ?? "-" }}
                </div>
                <div class="text-gray-600">Responsable: {{ detail.patient?.responsibleName || "-" }}</div>
                <div v-if="detail.patient?.mayaHabla" class="text-purple-600 font-medium mt-1">Habla Maya</div>
              </div>
              <div class="bg-gray-50 rounded-xl p-4 text-sm">
                <p class="section-label">Registro</p>
                <div class="space-y-1 text-gray-700">
                  <div>Motivo: <span class="font-semibold">{{ detail.motivoUrgencia }}</span></div>
                  <div>Triage: {{ detail.triageAt ? fmt(detail.triageAt) : "-" }}</div>
                  <div>Enfermero: {{ detail.nurse?.name || "-" }}</div>
                  <div>
                    Pago:
                    <span :class="paidClass">
                      {{ detail.paidStatus === "PAID" ? "Pagado" : "Pendiente" }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Semaforo -->
            <div class="grid grid-cols-4 gap-3 text-sm">
              <div class="bg-gray-50 rounded-xl p-3 text-center">
                <div class="text-xs text-gray-400 mb-1">Apariencia</div>
                <div :class="appearanceClass">{{ detail.appearance }}</div>
              </div>
              <div class="bg-gray-50 rounded-xl p-3 text-center">
                <div class="text-xs text-gray-400 mb-1">Respiracion</div>
                <div :class="respirationClass">{{ detail.respiration }}</div>
              </div>
              <div class="bg-gray-50 rounded-xl p-3 text-center">
                <div class="text-xs text-gray-400 mb-1">Circulacion</div>
                <div :class="circulationClass">{{ detail.circulation }}</div>
              </div>
              <div class="bg-gray-50 rounded-xl p-3 text-center">
                <div class="text-xs text-gray-400 mb-1">Clasificacion</div>
                <div :class="detailClassifClass">{{ detail.classification }}</div>
              </div>
            </div>

            <!-- Signos vitales -->
            <div class="bg-gray-50 rounded-xl p-4">
              <p class="section-label">Signos vitales</p>
              <div class="grid grid-cols-6 gap-3 text-sm text-center">
                <div>
                  <div class="text-xs text-gray-400 mb-0.5">Peso</div>
                  <div class="font-bold">{{ detail.weightKg ?? "-" }}</div>
                </div>
                <div>
                  <div class="text-xs text-gray-400 mb-0.5">Talla</div>
                  <div class="font-bold">{{ detail.heightCm ?? "-" }}</div>
                </div>
                <div>
                  <div class="text-xs text-gray-400 mb-0.5">Temp</div>
                  <div class="font-bold">{{ detail.temperatureC ?? "-" }}</div>
                </div>
                <div>
                  <div class="text-xs text-gray-400 mb-0.5">F.C.</div>
                  <div class="font-bold">{{ detail.heartRate ?? "-" }}</div>
                </div>
                <div>
                  <div class="text-xs text-gray-400 mb-0.5">F.R.</div>
                  <div class="font-bold">{{ detail.respiratoryRate ?? "-" }}</div>
                </div>
                <div>
                  <div class="text-xs text-gray-400 mb-0.5">T.A.</div>
                  <div class="font-bold">{{ detail.bloodPressure ?? "-" }}</div>
                </div>
              </div>
            </div>

            <p class="text-xs text-gray-400">*Este modal es informativo. El anuncio se detiene unicamente con Enterado.</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
