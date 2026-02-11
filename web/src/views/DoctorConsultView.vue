<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useDoctorStore } from "../stores/doctor";

const d = useDoctorStore();
const route = useRoute();
const router = useRouter();
const id = Number(route.params.id);

const finished = computed(() => !!d.detail?.medicalNote?.consultationFinishedAt);

function fmt(iso: string) {
  const dt = new Date(iso);
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Merida",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  }).format(dt);
}

async function save() {
  await d.save(id);
  alert("✅ Nota guardada");
}

async function finish() {
  if (!confirm("¿Finalizar consulta? Después quedará solo lectura.")) return;
  await d.finish(id);
  alert("✅ Consulta finalizada");
  router.push("/doctor");
}

function close() {
  router.push("/doctor");
}

onMounted(async () => {
  await d.loadDetail(id);
});
</script>

<template>
  <div class="p-6 max-w-7xl mx-auto">
    <div class="bg-white rounded-2xl shadow p-6" v-if="d.detail">
      <div class="flex items-start justify-between gap-4 mb-4">
        <div>
          <div class="text-xl font-semibold">{{ d.detail.patient.fullName }}</div>
          <div class="text-sm text-gray-500">
            Triage: {{ fmt(d.detail.triageAt) }} · Clasificación: <span class="font-semibold">{{ d.detail.classification }}</span>
          </div>
        </div>

        <div class="flex gap-2">
          <button class="px-3 py-2 rounded-xl border text-sm hover:bg-gray-50" @click="close">Cerrar</button>
          <button class="px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm disabled:opacity-50"
                  :disabled="finished" @click="save">Guardar nota</button>
          <button class="px-3 py-2 rounded-xl bg-gray-900 text-white text-sm" @click="d.openPdf(id)">Imprimir PDF</button>
          <button class="px-3 py-2 rounded-xl bg-rose-600 text-white text-sm disabled:opacity-50"
                  :disabled="finished" @click="finish">Finalizar</button>
        </div>
      </div>

      <!-- INFO ENFERMERÍA -->
      <div class="grid grid-cols-2 gap-3 mb-6 text-sm">
        <div class="border rounded-xl p-4">
          <div class="font-semibold mb-2">Datos generales</div>
          <div>Expediente: {{ d.detail.patient.expediente || "-" }}</div>
          <div>Edad: {{ d.detail.patient.age ?? "-" }} · Sexo: {{ d.detail.patient.sex ?? "-" }}</div>
          <div>Responsable: {{ d.detail.patient.responsibleName || "-" }}</div>
          <div>Maya: {{ d.detail.patient.mayaHabla ? "Sí" : "No" }}</div>
          <div>Enfermero: {{ d.detail.nurse?.name }}</div>
        </div>

        <div class="border rounded-xl p-4">
          <div class="font-semibold mb-2">Signos vitales</div>
          <div class="grid grid-cols-2 gap-2">
            <div>Peso: {{ d.detail.weightKg ?? "-" }}</div>
            <div>Talla: {{ d.detail.heightCm ?? "-" }}</div>
            <div>Temp: {{ d.detail.temperatureC ?? "-" }}</div>
            <div>FC: {{ d.detail.heartRate ?? "-" }}</div>
            <div>FR: {{ d.detail.respiratoryRate ?? "-" }}</div>
            <div>TA: {{ d.detail.bloodPressure ?? "-" }}</div>
          </div>
        </div>
      </div>

      <!-- NOTA MÉDICA -->
      <div class="grid grid-cols-2 gap-3">
        <textarea v-model="d.note.padecimientoActual" :disabled="finished" class="border rounded-xl p-3" rows="4" placeholder="Padecimiento actual" />
        <textarea v-model="d.note.antecedentes" :disabled="finished" class="border rounded-xl p-3" rows="4" placeholder="Antecedentes" />
        <textarea v-model="d.note.exploracionFisica" :disabled="finished" class="border rounded-xl p-3" rows="4" placeholder="Exploración física" />
        <textarea v-model="d.note.estudiosParaclinicos" :disabled="finished" class="border rounded-xl p-3" rows="4" placeholder="Estudios paraclínicos" />
        <textarea v-model="d.note.diagnostico" :disabled="finished" class="border rounded-xl p-3" rows="4" placeholder="Diagnóstico(s)" />
        <textarea v-model="d.note.planTratamiento" :disabled="finished" class="border rounded-xl p-3" rows="4" placeholder="Plan / Tratamiento" />
      </div>

      <div class="grid grid-cols-2 gap-3 mt-4">
        <div class="border rounded-xl p-4">
          <div class="font-semibold mb-2">Vigilar datos de alarma</div>
          <div class="grid grid-cols-2 gap-2 text-sm">
            <label class="flex gap-2 items-center"><input type="checkbox" v-model="d.note.vig.fiebre38" :disabled="finished" /> Fiebre > 38°C</label>
            <label class="flex gap-2 items-center"><input type="checkbox" v-model="d.note.vig.convulsiones" :disabled="finished" /> Convulsiones</label>
            <label class="flex gap-2 items-center"><input type="checkbox" v-model="d.note.vig.alteracionAlerta" :disabled="finished" /> Alteración alerta</label>
            <label class="flex gap-2 items-center"><input type="checkbox" v-model="d.note.vig.sangradoActivo" :disabled="finished" /> Sangrado activo</label>
            <label class="flex gap-2 items-center"><input type="checkbox" v-model="d.note.vig.deshidratacion" :disabled="finished" /> Deshidratación</label>
            <label class="flex gap-2 items-center"><input type="checkbox" v-model="d.note.vig.vomitosFrecuentes" :disabled="finished" /> Vómitos frecuentes</label>
            <label class="flex gap-2 items-center"><input type="checkbox" v-model="d.note.vig.irritabilidad" :disabled="finished" /> Irritabilidad</label>
            <label class="flex gap-2 items-center"><input type="checkbox" v-model="d.note.vig.llantoInconsolable" :disabled="finished" /> Llanto inconsolable</label>
            <label class="flex gap-2 items-center"><input type="checkbox" v-model="d.note.vig.dificultadRespiratoria" :disabled="finished" /> Dificultad respiratoria</label>
            <label class="flex gap-2 items-center"><input type="checkbox" v-model="d.note.vig.choque" :disabled="finished" /> Datos de choque</label>
            <label class="flex gap-2 items-center"><input type="checkbox" v-model="d.note.vig.deterioroNeurologico" :disabled="finished" /> Deterioro neurológico</label>
          </div>
        </div>

        <div class="border rounded-xl p-4 space-y-2">
          <div class="font-semibold">Contrarreferencia</div>
          <div class="text-sm">Solicitar seguimiento en su Centro de Salud o 1er nivel:</div>

          <label class="flex gap-2 items-center text-sm">
            <input type="checkbox" v-model="d.note.contraRefFollowUp" :disabled="finished" />
            Sí
          </label>

          <input v-if="d.note.contraRefFollowUp"
                 v-model="d.note.contraRefWhen"
                 :disabled="finished"
                 placeholder="¿En cuánto tiempo?"
                 class="w-full border rounded-xl p-2 text-sm" />

          <div class="font-semibold mt-3">Pronóstico</div>
          <textarea v-model="d.note.pronostico" :disabled="finished" class="w-full border rounded-xl p-3 min-h-[90px]" />
        </div>
      </div>
    </div>
  </div>
</template>
