<script setup lang="ts">
import { reactive, computed } from "vue";
import { useTriageNurseStore } from "../stores/triageNurse";
import { useSocket } from "../composables/useSocket";

const triage = useTriageNurseStore();
useSocket().connect();

type Color = "GREEN" | "YELLOW" | "RED";

const form = reactive({
  expedienteNo: "",
  motivoUrgencia: "",
  patientFullName: "",
  patientAge: null as number | null,
  sex: "M" as "M" | "F" | "X",

  responsibleName: "",
  speaksMaya: false,

  appearance: "GREEN" as Color,
  respiration: "GREEN" as Color,
  circulation: "GREEN" as Color,

  weightKg: null as number | null,
  heightCm: null as number | null,
  temperatureC: null as number | null,
  heartRate: null as number | null,
  respiratoryRate: null as number | null,
  bloodPressure: "",
});

const classification = computed<Color>(() => {
  const rank: Record<Color, number> = { GREEN: 1, YELLOW: 2, RED: 3 };
  const worst = [form.appearance, form.respiration, form.circulation].sort((a, b) => rank[a] - rank[b])[2];
  return worst;
});

function badge(c: string) {
  return c === "RED" ? "bg-red-500" : c === "YELLOW" ? "bg-yellow-400" : "bg-green-500";
}

async function save() {
  const payload = {
    expedienteNo: form.expedienteNo || null,
    motivoUrgencia: form.motivoUrgencia,
    patientFullName: form.patientFullName,
    patientAge: form.patientAge,
    sex: form.sex,

    responsibleName: form.responsibleName || null,
    speaksMaya: form.speaksMaya,

    appearance: form.appearance,
    respiration: form.respiration,
    circulation: form.circulation,
    classification: classification.value,

    weightKg: form.weightKg,
    heightCm: form.heightCm,
    temperatureC: form.temperatureC,
    heartRate: form.heartRate,
    respiratoryRate: form.respiratoryRate,
    bloodPressure: form.bloodPressure || null,
  };

  if (!payload.motivoUrgencia || !payload.patientFullName) return alert("Motivo y Nombre son requeridos");

  const saved = await triage.createTriage(payload);
  alert(`✅ Triage guardado. ID: ${saved.id} (${saved.classification})`);

  // reset mínimo
  form.expedienteNo = "";
  form.motivoUrgencia = "";
  form.patientFullName = "";
  form.patientAge = null;
  form.sex = "M";
  form.responsibleName = "";
  form.speaksMaya = false;
  form.appearance = "GREEN";
  form.respiration = "GREEN";
  form.circulation = "GREEN";
  form.weightKg = form.heightCm = form.temperatureC = null;
  form.heartRate = form.respiratoryRate = null;
  form.bloodPressure = "";
}
</script>

<template>
  <div class="p-6 max-w-5xl mx-auto">
    <div class="bg-white rounded-2xl shadow p-6">
      <div class="flex items-center justify-between mb-4">
        <h1 class="text-2xl font-semibold">Enfermería - Triage</h1>

        <div class="flex items-center gap-2">
          <span class="text-white text-xs px-2 py-1 rounded-full" :class="badge(classification)">
            {{ classification }}
          </span>
          <span class="text-sm text-gray-600">
            SLA: {{ classification === 'GREEN' ? '120' : classification === 'YELLOW' ? '60' : '0' }} min
          </span>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="text-sm font-medium">No. Expediente</label>
          <input v-model="form.expedienteNo" class="w-full border rounded-xl p-2" />
        </div>

        <div>
          <label class="text-sm font-medium">Motivo de urgencia *</label>
          <input v-model="form.motivoUrgencia" class="w-full border rounded-xl p-2" />
        </div>

        <div>
          <label class="text-sm font-medium">Nombre completo *</label>
          <input v-model="form.patientFullName" class="w-full border rounded-xl p-2" />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-sm font-medium">Edad</label>
            <input v-model.number="form.patientAge" type="number" class="w-full border rounded-xl p-2" />
          </div>
          <div>
            <label class="text-sm font-medium">Sexo</label>
            <select v-model="form.sex" class="w-full border rounded-xl p-2">
              <option value="M">M</option>
              <option value="F">F</option>
              <option value="X">X</option>
            </select>
          </div>
        </div>

        <div>
          <label class="text-sm font-medium">Responsable</label>
          <input v-model="form.responsibleName" class="w-full border rounded-xl p-2" />
        </div>

        <div class="flex items-center gap-2 mt-6">
          <input type="checkbox" v-model="form.speaksMaya" />
          <span class="text-sm">Maya habla</span>
        </div>
      </div>

      <div class="mt-6 grid grid-cols-3 gap-4">
        <div class="border rounded-2xl p-4">
          <div class="font-semibold mb-2">Apariencia</div>
          <select v-model="form.appearance" class="w-full border rounded-xl p-2">
            <option value="GREEN">Verde</option>
            <option value="YELLOW">Amarillo</option>
            <option value="RED">Rojo</option>
          </select>
        </div>

        <div class="border rounded-2xl p-4">
          <div class="font-semibold mb-2">Respiración</div>
          <select v-model="form.respiration" class="w-full border rounded-xl p-2">
            <option value="GREEN">Verde</option>
            <option value="YELLOW">Amarillo</option>
            <option value="RED">Rojo</option>
          </select>
        </div>

        <div class="border rounded-2xl p-4">
          <div class="font-semibold mb-2">Circulación</div>
          <select v-model="form.circulation" class="w-full border rounded-xl p-2">
            <option value="GREEN">Verde</option>
            <option value="YELLOW">Amarillo</option>
            <option value="RED">Rojo</option>
          </select>
        </div>
      </div>

      <div class="mt-6 border rounded-2xl p-4">
        <div class="font-semibold mb-3">Signos vitales</div>
        <div class="grid grid-cols-3 gap-3">
          <input v-model.number="form.weightKg" type="number" step="0.01" class="border rounded-xl p-2" placeholder="Peso (kg)" />
          <input v-model.number="form.heightCm" type="number" step="0.01" class="border rounded-xl p-2" placeholder="Talla (cm)" />
          <input v-model.number="form.temperatureC" type="number" step="0.1" class="border rounded-xl p-2" placeholder="Temp (°C)" />
          <input v-model.number="form.heartRate" type="number" class="border rounded-xl p-2" placeholder="FC" />
          <input v-model.number="form.respiratoryRate" type="number" class="border rounded-xl p-2" placeholder="FR" />
          <input v-model="form.bloodPressure" class="border rounded-xl p-2" placeholder="T.A. 120/80" />
        </div>
      </div>

      <div class="mt-6 flex justify-end">
        <button
            class="px-4 py-2 rounded-xl bg-blue-600 text-white disabled:opacity-50"
            :disabled="triage.saving"
            @click="save"
        >
          Guardar Triage
        </button>
      </div>
    </div>
  </div>
</template>
