<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount } from "vue";
import { useDoctorStore } from "../stores/doctor";

const d = useDoctorStore();
const current = computed(() => d.alertQueue[0] ?? null);

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

function ack() {
  d.acknowledgeCurrentAlert();
}

function onKey(e: KeyboardEvent) {
  if (!current.value) return;
  if (e.key === "Enter") ack();
}

onMounted(() => {
  // asegura realtime (idempotente)
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
  <div
      v-if="current"
      class="fixed inset-0 bg-black/40 flex items-center justify-center p-6 z-50"
  >
    <div
        class="w-full max-w-xl rounded-2xl border-2 shadow-xl p-6"
        :class="[clsBg(current.classification), clsBorder(current.classification)]"
    >
      <div class="flex items-start justify-between gap-3">
        <div class="flex items-center gap-3">
          <span class="w-3 h-3 rounded-full animate-pulse" :class="clsDot(current.classification)"></span>
          <div>
            <div class="text-lg font-semibold">Nuevo paciente en espera</div>
            <div class="text-sm text-gray-700">
              Clasificación: <span class="font-semibold">{{ current.classification }}</span>
            </div>
          </div>
        </div>

        <div class="text-xs text-gray-600">
          ID: {{ current.id }}
        </div>
      </div>

      <div class="mt-4 bg-white/70 rounded-xl p-4 text-sm">
        <div class="font-semibold">{{ current.patient?.fullName }}</div>
        <div class="text-gray-700">Motivo: {{ current.motivoUrgencia }}</div>
        <div class="text-gray-700">Enfermero: {{ current.nurse?.name }}</div>
      </div>

      <div class="mt-5 flex justify-end gap-2">
        <button
            class="px-4 py-2 rounded-xl bg-blue-600 text-white"
            @click="ack"
        >
          Enterado
        </button>
      </div>

      <div class="mt-2 text-xs text-gray-600">
        Tip: puedes presionar <span class="font-semibold">Enter</span> para confirmar.
      </div>
    </div>
  </div>
</template>
