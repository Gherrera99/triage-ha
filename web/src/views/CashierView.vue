<script setup lang="ts">
import { computed, onMounted, ref, onBeforeUnmount } from "vue";
import { useCashierStore, type TriageColor, type CashierQueueRow } from "../stores/cashier";
import { useSocket } from "../composables/useSocket";

const s = useCashierStore();
const { socket } = useSocket();

const q = ref("");

// modal pago
const payModal = ref(false);
const payRow = ref<CashierQueueRow | null>(null);
const expedienteInput = ref("");

// modal no quiso pagar
const refuseModal = ref(false);
const refuseRow = ref<CashierQueueRow | null>(null);

let off1: any, off2: any;

// --- ALERTA NUEVO PACIENTE (visual + sonido) ---
const alertQueue = ref<any[]>([]);
const showAlert = ref(false);
const alertRow = ref<any | null>(null);

let alertInterval: number | null = null;
let audioCtx: AudioContext | null = null;

function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
}

function beep(freq = 880, ms = 140, gainValue = 0.07) {
  try {
    ensureAudio();
    if (!audioCtx) return;

    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    g.gain.value = gainValue;

    o.connect(g);
    g.connect(audioCtx.destination);

    const t0 = audioCtx.currentTime;
    o.start(t0);
    o.stop(t0 + ms / 1000);
  } catch {}
}

function startAlertSound(color: string) {
  stopAlertSound();

  const pattern = () => {
    if (color === "ROJO") {
      beep(1200, 120, 0.09);
      setTimeout(() => beep(1200, 120, 0.09), 180);
      setTimeout(() => beep(900, 160, 0.09), 420);
    } else if (color === "AMARILLO") {
      beep(900, 140, 0.08);
      setTimeout(() => beep(900, 140, 0.08), 220);
    } else {
      beep(700, 120, 0.06);
    }
  };

  pattern();
  alertInterval = window.setInterval(pattern, 1600);
}

function stopAlertSound() {
  if (alertInterval) {
    clearInterval(alertInterval);
    alertInterval = null;
  }
}

function openAlert(row: any) {
  alertQueue.value.push(row);
  if (!showAlert.value) nextAlert();
}

function nextAlert() {
  const next = alertQueue.value.shift() || null;
  if (!next) {
    showAlert.value = false;
    alertRow.value = null;
    stopAlertSound();
    return;
  }

  alertRow.value = next;
  showAlert.value = true;
  startAlertSound(String(next.classification || "VERDE"));
}

function ackAlert() {
  showAlert.value = false;
  alertRow.value = null;
  stopAlertSound();
  setTimeout(() => nextAlert(), 50);
}

function alertBorder(c: string) {
  return c === "ROJO"
      ? "border-red-600"
      : c === "AMARILLO"
          ? "border-yellow-400"
          : "border-green-600";
}

function alertBadge(c: string) {
  return c === "ROJO"
      ? "bg-red-600"
      : c === "AMARILLO"
          ? "bg-yellow-400 text-black"
          : "bg-green-600";
}

function onKey(e: KeyboardEvent) {
  if (!showAlert.value) return;
  if (e.key === "Enter") ackAlert();
}

window.addEventListener("keydown", onKey);

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKey);
  stopAlertSound();
});

onMounted(async () => {
  await s.fetchQueue();

  const onNew = async (row: any) => {
    await s.fetchQueue();
    openAlert(row);
  };

  const onUpd = async () => s.fetchQueue();

  socket.on("triage:new", onNew);
  socket.on("triage:updated", onUpd);

  off1 = () => socket.off("triage:new", onNew);
  off2 = () => socket.off("triage:updated", onUpd);
});

onBeforeUnmount(() => {
  off1?.();
  off2?.();
});

const filtered = computed(() => {
  const term = q.value.trim().toLowerCase();
  if (!term) return s.rows;

  return s.rows.filter((r) => {
    return (
        String(r.id).includes(term) ||
        (r.patient.fullName || "").toLowerCase().includes(term) ||
        (r.patient.expediente || "").toLowerCase().includes(term) ||
        (r.motivoUrgencia || "").toLowerCase().includes(term)
    );
  });
});

function badge(c: TriageColor) {
  return c === "ROJO" ? "bg-red-600" : c === "AMARILLO" ? "bg-yellow-400 text-black" : "bg-green-600";
}

function fmtMerida(iso: string) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Merida",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function expedienteVisible(v: string | null | undefined) {
  const s = String(v ?? "").trim();
  if (!s) return "SIN EXPEDIENTE";
  return s;
}

function openPay(r: CashierQueueRow) {
  payRow.value = r;
  expedienteInput.value = r.patient?.expediente?.trim() || "";
  payModal.value = true;
}

function openRefuse(r: CashierQueueRow) {
  refuseRow.value = r;
  refuseModal.value = true;
}

async function confirmPay() {
  if (!payRow.value) return;

  try {
    await s.markPaid(payRow.value.id, expedienteInput.value.trim() || null);
    payModal.value = false;
    payRow.value = null;
    expedienteInput.value = "";

    const motivo = String(payRow.value?.motivoUrgencia ?? "").toUpperCase();
    if (motivo && motivo !== "CONSULTA") {
      alert("✅ Pago registrado. El flujo del paciente quedó cerrado en Caja.");
    } else {
      alert("✅ Pago registrado.");
    }
  } catch (e: any) {
    const status = e?.response?.status;
    if (status === 401) return alert("⚠️ No autorizado. Vuelve a iniciar sesión.");
    alert(`Error al cobrar: ${e?.response?.data?.error || e.message || "Desconocido"}`);
  }
}

async function confirmRefuse() {
  if (!refuseRow.value) return;

  try {
    await s.refusePayment(refuseRow.value.id);
    refuseModal.value = false;
    refuseRow.value = null;
    alert("✅ Paciente marcado como 'No quiso pagar'. El flujo quedó cerrado.");
  } catch (e: any) {
    const status = e?.response?.status;
    if (status === 401) return alert("⚠️ No autorizado. Vuelve a iniciar sesión.");
    alert(`Error al marcar no pago: ${e?.response?.data?.error || e.message || "Desconocido"}`);
  }
}
</script>

<template>
  <div class="p-6 max-w-7xl mx-auto">
    <div class="bg-white rounded-2xl shadow p-6">
      <div class="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 class="text-2xl font-semibold">Caja</h1>
          <div class="text-sm text-gray-500 mt-1">Cola de pacientes pendientes de pago</div>
        </div>

        <button
            class="px-3 py-2 rounded-xl border text-sm hover:bg-gray-50"
            :disabled="s.loading"
            @click="s.fetchQueue()"
        >
          Refrescar
        </button>
      </div>

      <div class="flex items-center justify-between gap-4 mb-4">
        <input
            v-model="q"
            class="border rounded-xl p-2 w-[520px]"
            placeholder="Buscar por nombre, expediente, motivo o ID..."
        />
        <div class="text-sm text-gray-500">{{ filtered.length }} registros</div>
      </div>

      <div class="overflow-auto border rounded-2xl">
        <table class="w-full text-sm">
          <thead class="bg-gray-50">
          <tr class="text-left border-b">
            <th class="py-2 px-3">ID</th>
            <th class="py-2 px-3">Fecha/Hora</th>
            <th class="py-2 px-3">Expediente</th>
            <th class="py-2 px-3">Paciente</th>
            <th class="py-2 px-3">Motivo</th>
            <th class="py-2 px-3">Clasif.</th>
            <th class="py-2 px-3">Acciones</th>
          </tr>
          </thead>

          <tbody>
          <tr v-for="r in filtered" :key="r.id" class="border-b">
            <td class="py-2 px-3">{{ r.id }}</td>
            <td class="py-2 px-3">{{ fmtMerida(r.triageAt) }}</td>
            <td class="py-2 px-3">{{ expedienteVisible(r.patient.expediente) }}</td>

            <td class="py-2 px-3">
              <div class="font-medium">{{ r.patient.fullName }}</div>
              <div class="text-xs text-gray-500">
                {{ r.patient.age ?? "-" }} años · {{ r.patient.sex ?? "-" }}
                <span v-if="r.patient.mayaHabla">· Maya</span>
                <span v-if="r.patient.responsibleName">· Resp: {{ r.patient.responsibleName }}</span>
                <span v-if="r.nurse?.name">· Enfermero: {{ r.nurse.name }}</span>
              </div>
            </td>

            <td class="py-2 px-3">{{ r.motivoUrgencia }}</td>

            <td class="py-2 px-3">
                <span class="text-white text-xs px-2 py-1 rounded-full" :class="badge(r.classification)">
                  {{ r.classification }}
                </span>
            </td>

            <td class="py-2 px-3">
              <div class="flex gap-2">
                <button
                    class="px-3 py-1 rounded-xl border text-xs hover:bg-gray-50 disabled:opacity-50"
                    :disabled="s.paying || s.refusing"
                    @click="openPay(r)"
                >
                  Marcar pagado
                </button>

                <button
                    class="px-3 py-1 rounded-xl border text-xs hover:bg-red-50 text-red-700 border-red-200 disabled:opacity-50"
                    :disabled="s.paying || s.refusing"
                    @click="openRefuse(r)"
                >
                  No quiso pagar
                </button>
              </div>
            </td>
          </tr>

          <tr v-if="!filtered.length">
            <td colspan="7" class="py-6 text-center text-gray-500">
              Sin pacientes pendientes de pago
            </td>
          </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal pago -->
    <div
        v-if="payModal"
        class="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-40"
        @click.self="payModal=false"
    >
      <div class="w-full max-w-md bg-white rounded-2xl shadow p-6">
        <div class="text-lg font-semibold mb-1">Confirmar pago</div>
        <div class="text-sm text-gray-500 mb-4">
          Triage ID: {{ payRow?.id }} · {{ payRow?.patient.fullName }}
        </div>

        <div class="mb-4">
          <label class="text-sm font-medium">Expediente</label>
          <input
              v-model="expedienteInput"
              class="mt-1 w-full border rounded-xl p-2"
              placeholder="SIN EXPEDIENTE o número de expediente"
          />
          <div class="text-xs text-gray-500 mt-1">
            Es opcional. Si se deja vacío o "SIN EXPEDIENTE", se conservará sin expediente.
          </div>
        </div>

        <div class="text-sm text-gray-700 bg-gray-50 border rounded-xl p-3">
          ¿Deseas marcar este paciente como pagado?
        </div>

        <div class="flex justify-end gap-2 mt-5">
          <button class="px-4 py-2 rounded-xl border text-sm hover:bg-gray-50" @click="payModal=false">
            Cancelar
          </button>
          <button
              class="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm disabled:opacity-50"
              :disabled="s.paying"
              @click="confirmPay"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>

    <!-- Modal no quiso pagar -->
    <div
        v-if="refuseModal"
        class="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-40"
        @click.self="refuseModal=false"
    >
      <div class="w-full max-w-md bg-white rounded-2xl shadow p-6">
        <div class="text-lg font-semibold mb-1 text-red-700">No quiso pagar</div>
        <div class="text-sm text-gray-500 mb-4">
          Triage ID: {{ refuseRow?.id }} · {{ refuseRow?.patient.fullName }}
        </div>

        <div class="text-sm text-gray-700 bg-red-50 border border-red-200 rounded-xl p-3">
          Esta acción cerrará el flujo del paciente y ya no pasará a consulta médica.
        </div>

        <div class="flex justify-end gap-2 mt-5">
          <button class="px-4 py-2 rounded-xl border text-sm hover:bg-gray-50" @click="refuseModal=false">
            Cancelar
          </button>
          <button
              class="px-4 py-2 rounded-xl bg-red-600 text-white text-sm disabled:opacity-50"
              :disabled="s.refusing"
              @click="confirmRefuse"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>

    <!-- ALERTA NUEVO PACIENTE -->
    <div
        v-if="showAlert"
        class="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
    >
      <div class="w-full max-w-md bg-white rounded-2xl shadow p-6 border-4" :class="alertBorder(alertRow?.classification)">
        <div class="text-xs uppercase tracking-wide text-gray-500">Nuevo paciente en espera</div>

        <div class="mt-2 text-xl font-semibold">
          {{ alertRow?.patient?.fullName || "Paciente" }}
        </div>

        <div class="mt-2 flex items-center gap-2">
          <span class="text-white text-xs px-2 py-1 rounded-full" :class="alertBadge(alertRow?.classification)">
            {{ alertRow?.classification }}
          </span>
          <span class="text-sm text-gray-600">
            ID: {{ alertRow?.id }} · Motivo: {{ alertRow?.motivoUrgencia }}
          </span>
        </div>

        <div class="mt-2 text-sm text-gray-600">
          Expediente: <b>{{ alertRow?.patient?.expediente || "SIN EXPEDIENTE" }}</b>
        </div>

        <div class="mt-5 flex justify-between items-center">
          <div class="text-xs text-gray-500">Presiona Enter para cerrar</div>

          <button
              class="px-4 py-2 rounded-xl bg-blue-600 text-white"
              @click="ackAlert"
          >
            Enterado
          </button>
        </div>
      </div>
    </div>
  </div>
</template>