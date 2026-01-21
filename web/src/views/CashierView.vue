<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useCashierStore } from "../stores/cashier";
import { useSocket } from "../composables/useSocket";

const cashier = useCashierStore();
const { connect } = useSocket();

onMounted(async () => {
  connect();
  await cashier.fetchQueue();
});

function badge(c: string) {
  return c === "RED" ? "bg-red-500" : c === "YELLOW" ? "bg-yellow-400" : "bg-green-500";
}

const amount = ref<Record<number, string>>({});

async function pay(id: number) {
  const val = amount.value[id];
  await cashier.markPaid(id, val ? Number(val) : undefined);
}
</script>

<template>
  <div class="p-6 max-w-5xl mx-auto">
    <div class="bg-white rounded-2xl shadow p-6">
      <div class="flex items-center justify-between mb-4">
        <h1 class="text-2xl font-semibold">Caja</h1>
        <button class="px-3 py-2 rounded-lg border" @click="cashier.fetchQueue()">Actualizar</button>
      </div>

      <div class="space-y-3">
        <div v-for="r in cashier.queue" :key="r.id" class="border rounded-2xl p-4">
          <div class="flex items-center justify-between">
            <div>
              <div class="flex items-center gap-2">
                <span class="text-white text-xs px-2 py-1 rounded-full" :class="badge(r.classification)">
                  {{ r.classification }}
                </span>
                <span class="font-semibold">#{{ r.id }} - {{ r.patientFullName }}</span>
              </div>
              <div class="text-sm text-gray-600 mt-1">Motivo: {{ r.motivoUrgencia }}</div>
              <div class="text-xs text-gray-500 mt-1">Capturó: {{ r.nurse.fullName }}</div>
            </div>

            <div class="flex items-center gap-2">
              <input
                  v-model="amount[r.id]"
                  class="border rounded-xl p-2 w-28 text-sm"
                  placeholder="$ monto"
              />
              <button class="bg-emerald-600 text-white rounded-xl px-4 py-2" @click="pay(r.id)">
                Marcar Pagado
              </button>
            </div>
          </div>
        </div>

        <div v-if="!cashier.queue.length" class="text-gray-600 border rounded-xl p-6">
          No hay pacientes pendientes de cobro.
        </div>
      </div>
    </div>
  </div>
</template>
