<script setup lang="ts">
import { ref } from "vue";
import { api } from "../services/api";

const startDate = ref("");
const endDate = ref("");
const loading = ref(false);

async function download() {
  if (!startDate.value || !endDate.value) return;

  loading.value = true;
  try {
    const res = await api.get("/admin/report", {
      params: { startDate: startDate.value, endDate: endDate.value },
      responseType: "blob",
    });

    const blob = new Blob([res.data], { type: res.headers["content-type"] });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reporte_triage_${startDate.value}_a_${endDate.value}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="p-6 max-w-3xl mx-auto">
    <div class="bg-white rounded-xl shadow p-6 space-y-4">
      <h1 class="text-xl font-semibold">Reportes (Excel)</h1>

      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-sm text-gray-600">Fecha inicio</label>
          <input v-model="startDate" type="date" class="border rounded-lg p-2 w-full" />
        </div>
        <div>
          <label class="text-sm text-gray-600">Fecha fin</label>
          <input v-model="endDate" type="date" class="border rounded-lg p-2 w-full" />
        </div>
      </div>

      <button
          class="px-4 py-2 rounded-lg bg-gray-900 text-white disabled:opacity-60"
          :disabled="loading || !startDate || !endDate"
          @click="download"
      >
        {{ loading ? "Generando..." : "Descargar Reporte Excel" }}
      </button>
    </div>
  </div>
</template>
