<script setup lang="ts">
import { computed, onMounted, ref, onBeforeUnmount } from "vue";
import { useCashierStore, type TriageColor, type CashierQueueRow } from "../stores/cashier";
import { useSocket } from "../composables/useSocket";

const s = useCashierStore();
const { socket } = useSocket();


const q = ref("");
const payModal = ref(false);
const payRow = ref<CashierQueueRow | null>(null);
const amountStr = ref<string>("");

let off1: any, off2: any;

// --- ALERTA NUEVO PACIENTE (visual + sonido) ---
const alertQueue = ref<any[]>([]);
const showAlert = ref(false);
const alertRow = ref<any | null>(null);

let alertInterval: number | null = null;
let audioCtx: AudioContext | null = null;

function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  // algunos navegadores requieren “unlock” tras interacción
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
  } catch {
    // si el navegador bloquea audio hasta interacción, no rompemos nada
  }
}

function startAlertSound(color: string) {
  stopAlertSound();

  // patrones por color
  const pattern = () => {
    if (color === "ROJO") {
      beep(1200, 120, 0.09);
      setTimeout(() => beep(1200, 120, 0.09), 180);
      setTimeout(() => beep(900, 160, 0.09), 420);
    } else if (color === "AMARILLO") {
      beep(900, 140, 0.08);
      setTimeout(() => beep(900, 140, 0.08), 220);
    } else {
      // VERDE
      beep(700, 120, 0.06);
    }
  };

  pattern(); // dispara inmediato
  alertInterval = window.setInterval(pattern, 1600); // repite hasta enterado
}

function stopAlertSound() {
  if (alertInterval) {
    clearInterval(alertInterval);
    alertInterval = null;
  }
}

function openAlert(row: any) {
  // encola
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
  // cerrar actual
  showAlert.value = false;
  alertRow.value = null;
  stopAlertSound();

  // mostrar siguiente si hay
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

// Enter = Enterado
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
    openAlert(row); // ✅ lanza alerta
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

function openPay(r: CashierQueueRow) {
  payRow.value = r;
  amountStr.value = ""; // opcional
  payModal.value = true;
}

async function confirmPay() {
  if (!payRow.value) return;

  const raw = String(amountStr.value ?? "").trim(); // ✅ soporta number/string
  const amount = raw === "" ? null : Number(raw);

  if (amount !== null && (Number.isNaN(amount) || amount < 0)) {
    return alert("Monto inválido");
  }

  try {
    await s.markPaid(payRow.value.id, amount);
    payModal.value = false;
    payRow.value = null;
    alert("✅ Cobro registrado (PAID)");
  } catch (e: any) {
    const status = e?.response?.status;
    if (status === 401) return alert("⚠️ No autorizado. Vuelve a iniciar sesión.");
    alert(`Error al cobrar: ${e?.response?.data?.error || e.message || "Desconocido"}`);
  }
}

</script>

<template>
  <div class="p-6 max-w-7xl mx-auto">
    <div class="bg-white rounded-2xl shadow p-6">
      <div class="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 class="text-2xl font-semibold">Caja</h1>
          <div class="text-sm text-gray-500 mt-1">Cola de pacientes pendientes de pago (PENDING)</div>
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
            <th class="py-2 px-3">Acción</th>
          </tr>
          </thead>

          <tbody>
          <tr v-for="r in filtered" :key="r.id" class="border-b">
            <td class="py-2 px-3">{{ r.id }}</td>
            <td class="py-2 px-3">{{ fmtMerida(r.triageAt) }}</td>
            <td class="py-2 px-3">{{ r.patient.expediente || "-" }}</td>

            <td class="py-2 px-3">
              <div class="font-medium">{{ r.patient.fullName }}</div>
              <div class="text-xs text-gray-500">
                {{ r.patient.age ?? "-" }} años · {{ r.patient.sex ?? "-" }}
                <span v-if="r.patient.mayaHabla">· Maya</span>
                <span v-if="r.patient.responsibleName">· Resp: {{ r.patient.responsibleName }}</span>
                <span v-if="r.nurse?.name">· Nurse: {{ r.nurse.name }}</span>
              </div>
            </td>

            <td class="py-2 px-3">{{ r.motivoUrgencia }}</td>

            <td class="py-2 px-3">
                <span class="text-white text-xs px-2 py-1 rounded-full" :class="badge(r.classification)">
                  {{ r.classification }}
                </span>
            </td>

            <td class="py-2 px-3">
              <button
                  class="px-3 py-1 rounded-xl border text-xs hover:bg-gray-50 disabled:opacity-50"
                  :disabled="s.paying"
                  @click="openPay(r)"
              >
                Cobrar
              </button>
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

      <!-- Modal Cobro -->
      <div
          v-if="payModal"
          class="fixed inset-0 bg-black/30 flex items-center justify-center p-4"
          @click.self="payModal=false"
      >
        <div class="w-full max-w-md bg-white rounded-2xl shadow p-6">
          <div class="text-lg font-semibold mb-1">Registrar cobro</div>
          <div class="text-sm text-gray-500 mb-4">
            Triage ID: {{ payRow?.id }} · {{ payRow?.patient.fullName }}
          </div>

          <label class="text-sm font-medium">Monto (opcional)</label>
          <input
              v-model="amountStr"
              type="number"
              step="0.01"
              class="mt-1 w-full border rounded-xl p-2"
              placeholder="Ej. 150.00"
          />

          <div class="flex justify-end gap-2 mt-5">
            <button class="px-4 py-2 rounded-xl border text-sm hover:bg-gray-50" @click="payModal=false">
              Cancelar
            </button>
            <button
                class="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm disabled:opacity-50"
                :disabled="s.paying"
                @click="confirmPay"
            >
              Confirmar pago
            </button>
          </div>
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
          Expediente: <b>{{ alertRow?.patient?.expediente || "-" }}</b>
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
