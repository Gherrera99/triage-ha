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

function announcePatient() {
  try {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance("Nuevo Paciente en espera");
    utter.lang = "es-MX";
    utter.rate = 0.9;
    utter.pitch = 1;
    utter.volume = 1;
    window.speechSynthesis.speak(utter);
  } catch {}
}

function startAlertSound(_color: string) {
  stopAlertSound();
  announcePatient();
  alertInterval = window.setInterval(announcePatient, 6000);
}

function stopAlertSound() {
  if (alertInterval) {
    clearInterval(alertInterval);
    alertInterval = null;
  }
  try { window.speechSynthesis.cancel(); } catch {}
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

function badgeFullClass(c: string) {
  return "text-xs px-2.5 py-0.5 rounded-full font-semibold text-white " + badge(c as TriageColor);
}

function alertCardFullClass(c: string) {
  return "w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 border-l-8 " + alertBorder(c);
}

function alertDotClass(c: string) {
  const base = "w-2.5 h-2.5 rounded-full animate-pulse ";
  if (c === "ROJO") return base + "bg-red-500";
  if (c === "AMARILLO") return base + "bg-amber-400";
  return base + "bg-emerald-500";
}

function alertBadgeFullClass(c: string) {
  return "text-xs px-2.5 py-0.5 rounded-full font-semibold text-white " + alertBadge(c);
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
  <div class="p-6">
    <!-- Page header -->
    <div class="mb-6 flex items-start justify-between gap-4">
      <div>
        <div class="flex items-center gap-2 mb-1">
          <div class="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
          <span class="text-xs font-semibold uppercase tracking-wider text-emerald-600">Caja</span>
        </div>
        <h1 class="text-2xl font-bold text-gray-800">Cola de Pagos</h1>
        <p class="text-sm text-gray-500 mt-0.5">Pacientes pendientes de pago</p>
      </div>

      <button class="btn-secondary flex items-center gap-2" :disabled="s.loading" @click="s.fetchQueue()">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
        </svg>
        Refrescar
      </button>
    </div>

    <!-- Toolbar -->
    <div class="flex items-center justify-between gap-4 mb-4">
      <input v-model="q" class="input-base max-w-lg" placeholder="Buscar por nombre, expediente, motivo o ID..." />
      <span class="text-sm text-gray-500 shrink-0">{{ filtered.length }} pacientes</span>
    </div>

    <!-- Table -->
    <div class="card overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-gray-50 border-b border-gray-100">
        <tr>
          <th class="th">Fecha / Hora</th>
          <th class="th">Expediente</th>
          <th class="th">Paciente</th>
          <th class="th">Motivo</th>
          <th class="th">Clasif.</th>
          <th class="th">Acciones</th>
        </tr>
        </thead>

        <tbody class="divide-y divide-gray-50">
        <tr v-for="r in filtered" :key="r.id" class="hover:bg-gray-100 transition-colors">
          <td class="td text-gray-500 text-xs whitespace-nowrap">{{ fmtMerida(r.triageAt) }}</td>
          <td class="td font-mono text-xs">{{ expedienteVisible(r.patient.expediente) }}</td>

          <td class="td">
            <div class="font-semibold text-gray-800">{{ r.patient.fullName }}</div>
            <div class="text-xs text-gray-400 mt-0.5">
              {{ r.patient.age ?? "—" }} años · {{ r.patient.sex ?? "—" }}
              <span v-if="r.patient.mayaHabla"> · Maya</span>
              <span v-if="r.patient.responsibleName"> · {{ r.patient.responsibleName }}</span>
              <span v-if="r.nurse?.name"> · {{ r.nurse.name }}</span>
            </div>
          </td>

          <td class="td">{{ r.motivoUrgencia }}</td>

          <td class="td">
            <span :class="badgeFullClass(r.classification)">{{ r.classification }}</span>
          </td>

          <td class="td">
            <div class="flex gap-2">
              <button
                  class="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-medium hover:bg-emerald-100 transition-colors disabled:opacity-40"
                  :disabled="s.paying || s.refusing"
                  @click="openPay(r)"
              >
                Marcar pagado
              </button>
              <button
                  class="px-3 py-1.5 rounded-lg bg-red-50 text-red-700 border border-red-200 text-xs font-medium hover:bg-red-100 transition-colors disabled:opacity-40"
                  :disabled="s.paying || s.refusing"
                  @click="openRefuse(r)"
              >
                No quiso pagar
              </button>
            </div>
          </td>
        </tr>

        <tr v-if="!filtered.length">
          <td colspan="6" class="py-12 text-center text-gray-400">
            <div class="flex flex-col items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <span class="text-sm">Sin pacientes pendientes de pago</span>
            </div>
          </td>
        </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal pago -->
    <div
        v-if="payModal"
        class="overlay-backdrop flex items-center justify-center p-4 z-40"
        @click.self="payModal=false"
    >
      <div class="w-full max-w-md card p-6 shadow-xl">
        <div class="flex items-center gap-3 mb-5">
          <div class="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <div>
            <div class="font-bold text-gray-800">Confirmar pago</div>
            <div class="text-xs text-gray-500">{{ payRow?.patient.fullName }}</div>
          </div>
        </div>

        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1.5">Expediente</label>
          <input v-model="expedienteInput" class="input-base" placeholder="SIN EXPEDIENTE o número de expediente" />
          <p class="text-xs text-gray-400 mt-1.5">Opcional — se conservará el existente si se deja vacío.</p>
        </div>

        <div class="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-800 mb-5">
          ¿Confirmar pago de este paciente?
        </div>

        <div class="flex justify-end gap-2">
          <button class="btn-secondary" @click="payModal=false">Cancelar</button>
          <button class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50" :disabled="s.paying" @click="confirmPay">
            Confirmar pago
          </button>
        </div>
      </div>
    </div>

    <!-- Modal no quiso pagar -->
    <div
        v-if="refuseModal"
        class="overlay-backdrop flex items-center justify-center p-4 z-40"
        @click.self="refuseModal=false"
    >
      <div class="w-full max-w-md card p-6 shadow-xl">
        <div class="flex items-center gap-3 mb-5">
          <div class="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <div>
            <div class="font-bold text-red-700">No quiso pagar</div>
            <div class="text-xs text-gray-500">{{ refuseRow?.patient.fullName }}</div>
          </div>
        </div>

        <div class="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 mb-5">
          Esta acción cerrará el flujo del paciente. Ya no pasará a consulta médica.
        </div>

        <div class="flex justify-end gap-2">
          <button class="btn-secondary" @click="refuseModal=false">Cancelar</button>
          <button class="btn-danger" :disabled="s.refusing" @click="confirmRefuse">Confirmar</button>
        </div>
      </div>
    </div>

    <!-- ALERTA NUEVO PACIENTE -->
    <div v-if="showAlert" class="overlay-backdrop flex items-center justify-center p-4 z-50">
      <div :class="alertCardFullClass(alertRow?.classification ?? '')">
        <div class="flex items-center gap-2 mb-3">
          <span :class="alertDotClass(alertRow?.classification ?? '')"></span>
          <span class="text-xs uppercase tracking-wider font-semibold text-gray-500">Nuevo paciente en espera</span>
        </div>

        <div class="text-xl font-bold text-gray-800 mb-3">
          {{ alertRow?.patient?.fullName || "Paciente" }}
        </div>

        <div class="flex items-center gap-2 mb-2">
          <span :class="alertBadgeFullClass(alertRow?.classification ?? '')">
            {{ alertRow?.classification }}
          </span>
          <span class="text-sm text-gray-500">· {{ alertRow?.motivoUrgencia }}</span>
        </div>

        <div class="text-sm text-gray-600 bg-gray-50 rounded-xl px-3 py-2 mb-5">
          Expediente: <span class="font-semibold">{{ alertRow?.patient?.expediente || "SIN EXPEDIENTE" }}</span>
        </div>

        <div class="flex justify-between items-center">
          <span class="text-xs text-gray-400">Presiona Enter para descartar</span>
          <button class="btn-primary" @click="ackAlert">Enterado</button>
        </div>
      </div>
    </div>
  </div>
</template>