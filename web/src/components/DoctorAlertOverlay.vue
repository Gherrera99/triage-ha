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
  return c === "ROJO"
      ? "border-red-500"
      : c === "AMARILLO"
          ? "border-yellow-400"
          : "border-green-500";
}
function clsBg(c: string) {
  return c === "ROJO"
      ? "bg-red-50"
      : c === "AMARILLO"
          ? "bg-yellow-50"
          : "bg-green-50";
}
function clsDot(c: string) {
  return c === "ROJO"
      ? "bg-red-600"
      : c === "AMARILLO"
          ? "bg-yellow-500"
          : "bg-green-600";
}
function clsText(c: string) {
  return c === "ROJO"
      ? "text-red-700"
      : c === "AMARILLO"
          ? "text-yellow-700"
          : "text-green-700";
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
      // si cambia el paciente actual mientras el modal está abierto, recarga detalle
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

  // desbloqueo de audio con primer click del usuario
  window.addEventListener("click", () => d.unlockAudio(), { once: true });

  window.addEventListener("keydown", onKey);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKey);
});
</script>

<template>
  <!-- OVERLAY ALERTA -->
  <div
      v-if="current"
      class="fixed inset-0 bg-black/40 flex items-center justify-center p-6 z-50"
  >
    <div
        class="w-full max-w-2xl rounded-2xl border-2 shadow-xl p-6"
        :class="[clsBg(current.classification), clsBorder(current.classification)]"
    >
      <!-- HEADER -->
      <div class="flex items-start justify-between gap-4">
        <div class="flex items-center gap-3">
          <span class="w-3 h-3 rounded-full animate-pulse" :class="clsDot(current.classification)"></span>
          <div>
            <div class="text-lg font-semibold">Nuevo paciente en espera</div>
            <div class="text-sm" :class="clsText(current.classification)">
              Clasificación: <span class="font-semibold">{{ current.classification }}</span>
            </div>
          </div>
        </div>

        <div class="text-xs text-gray-700 text-right">
          <div class="font-semibold">Alertas: {{ queue.length }}</div>
          <button
              class="mt-1 px-3 py-1 rounded-lg border text-xs bg-white/70 hover:bg-white"
              @click="showQueue = !showQueue"
          >
            {{ showQueue ? "Ocultar cola" : "Ver cola" }}
          </button>
        </div>
      </div>

      <!-- BODY -->
      <div class="mt-4 bg-white/70 rounded-xl p-4 text-sm">
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="font-semibold">{{ current.patient?.fullName }}</div>
            <div class="text-gray-700">Motivo: {{ current.motivoUrgencia }}</div>
            <div class="text-gray-700">Enfermero: {{ current.nurse?.name }}</div>
          </div>
          <div class="text-right text-gray-700">
            <div class="text-xs">ID: {{ current.id }}</div>
            <div class="text-xs" v-if="current.triageAt">Triage: {{ fmt(current.triageAt) }}</div>
          </div>
        </div>
      </div>

      <!-- COLA -->
      <div v-if="showQueue" class="mt-4 bg-white/70 rounded-xl p-4">
        <div class="text-sm font-semibold mb-2">Cola de alertas (pendientes)</div>

        <div class="max-h-40 overflow-auto space-y-2">
          <button
              v-for="(a, idx) in queue"
              :key="a.id"
              class="w-full text-left p-3 rounded-xl border bg-white hover:bg-gray-50"
              :class="idx === 0 ? 'ring-2 ring-blue-300' : ''"
              @click="focus(a.id)"
          >
            <div class="flex items-center justify-between">
              <div class="font-medium">
                {{ a.patient?.fullName }}
                <span class="text-xs text-gray-500">· ID {{ a.id }}</span>
              </div>
              <div class="text-xs font-semibold" :class="clsText(a.classification)">
                {{ a.classification }}
              </div>
            </div>
            <div class="text-xs text-gray-600">
              {{ a.motivoUrgencia }} · {{ a.nurse?.name || "-" }}
            </div>
          </button>
        </div>

        <div class="mt-2 text-xs text-gray-600">
          Tip: puedes seleccionar un elemento de la cola para hacerlo “actual”.
        </div>
      </div>

      <!-- BOTONES -->
      <div class="mt-5 flex justify-end gap-2">
        <button
            class="px-4 py-2 rounded-xl border bg-white/80 hover:bg-white"
            @click="openDetail"
        >
          Ver detalle
        </button>

        <button
            class="px-4 py-2 rounded-xl bg-blue-600 text-white"
            @click="ack"
        >
          Enterado
        </button>
      </div>

      <div class="mt-2 text-xs text-gray-700">
        Enterado detiene el sonido. También puedes presionar <span class="font-semibold">Enter</span>.
      </div>
    </div>

    <!-- MODAL DETALLE -->
    <div
        v-if="showDetail"
        class="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-[60]"
        @click.self="showDetail=false"
    >
      <div class="w-full max-w-3xl bg-white rounded-2xl shadow-xl border p-6">
        <div class="flex items-start justify-between gap-3 mb-4">
          <div>
            <div class="text-lg font-semibold">Detalle del paciente</div>
            <div v-if="current" class="text-sm text-gray-500">
              ID {{ current.id }} · Clasificación:
              <span class="font-semibold" :class="clsText(current.classification)">
                {{ current.classification }}
              </span>
            </div>
          </div>
          <button class="px-3 py-2 rounded-xl border text-sm hover:bg-gray-50" @click="showDetail=false">
            Cerrar
          </button>
        </div>

        <div v-if="detailLoading" class="text-gray-600">Cargando...</div>
        <div v-else-if="detailError" class="text-red-600">{{ detailError }}</div>

        <div v-else-if="detail" class="space-y-4">
          <!-- Datos generales -->
          <div class="grid grid-cols-2 gap-3 bg-gray-50 rounded-xl p-4 text-sm">
            <div>
              <div class="text-gray-500 text-xs">Paciente</div>
              <div class="font-semibold">{{ detail.patient?.fullName }}</div>
              <div class="text-gray-700">
                Exp: {{ detail.patient?.expediente || "-" }} · Edad: {{ detail.patient?.age ?? "-" }} · Sexo: {{ detail.patient?.sex ?? "-" }}
              </div>
              <div class="text-gray-700">
                Responsable: {{ detail.patient?.responsibleName || "-" }}
                <span v-if="detail.patient?.mayaHabla"> · Habla Maya</span>
              </div>
            </div>

            <div>
              <div class="text-gray-500 text-xs">Registro</div>
              <div class="text-gray-700">Motivo: {{ detail.motivoUrgencia }}</div>
              <div class="text-gray-700">Triage: {{ detail.triageAt ? fmt(detail.triageAt) : "-" }}</div>
              <div class="text-gray-700">Enfermero: {{ detail.nurse?.name || "-" }}</div>
              <div class="text-gray-700">
                Pago: <span class="font-semibold">{{ detail.paidStatus === "PAID" ? "PAGADO" : "PENDIENTE" }}</span>
              </div>
            </div>
          </div>

          <!-- Semáforo -->
          <div class="grid grid-cols-4 gap-3 text-sm">
            <div class="border rounded-xl p-3">
              <div class="text-xs text-gray-500">Apariencia</div>
              <div class="font-semibold">{{ detail.appearance }}</div>
            </div>
            <div class="border rounded-xl p-3">
              <div class="text-xs text-gray-500">Respiración</div>
              <div class="font-semibold">{{ detail.respiration }}</div>
            </div>
            <div class="border rounded-xl p-3">
              <div class="text-xs text-gray-500">Circulación</div>
              <div class="font-semibold">{{ detail.circulation }}</div>
            </div>
            <div class="border rounded-xl p-3">
              <div class="text-xs text-gray-500">Clasificación</div>
              <div class="font-semibold" :class="clsText(detail.classification)">{{ detail.classification }}</div>
            </div>
          </div>

          <!-- Signos vitales -->
          <div class="border rounded-xl p-4 text-sm">
            <div class="font-semibold mb-2">Signos vitales</div>
            <div class="grid grid-cols-3 gap-2">
              <div>Peso: <span class="font-semibold">{{ detail.weightKg ?? "-" }}</span></div>
              <div>Talla: <span class="font-semibold">{{ detail.heightCm ?? "-" }}</span></div>
              <div>Temp: <span class="font-semibold">{{ detail.temperatureC ?? "-" }}</span></div>
              <div>FC: <span class="font-semibold">{{ detail.heartRate ?? "-" }}</span></div>
              <div>FR: <span class="font-semibold">{{ detail.respiratoryRate ?? "-" }}</span></div>
              <div>TA: <span class="font-semibold">{{ detail.bloodPressure ?? "-" }}</span></div>
            </div>
          </div>

          <!-- Datos adicionales -->
          <div class="border rounded-xl p-4 text-sm">
            <div class="font-semibold mb-2">Datos adicionales</div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                Atención previa misma patología:
                <span class="font-semibold">{{ detail.hadPriorCareSamePathology ? "SÍ" : "NO" }}</span>
                <div class="text-gray-700" v-if="detail.hadPriorCareSamePathology">
                  Lugar: {{ detail.priorCarePlace || "-" }}
                </div>
              </div>
              <div>
                Referencia:
                <span class="font-semibold">{{ detail.hasReferral ? "SÍ" : "NO" }}</span>
                <div class="text-gray-700" v-if="detail.hasReferral">
                  Lugar: {{ detail.referralPlace || "-" }}
                </div>
              </div>
            </div>
          </div>

          <div class="text-xs text-gray-500">
            *Este modal es solo informativo. El sonido se detiene únicamente con “Enterado”.
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
