<script setup lang="ts">
import { computed, onMounted, reactive, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useDoctorStore } from "../stores/doctor";

const d = useDoctorStore();
const route = useRoute();
const router = useRouter();
const id = Number(route.params.id);

const finished = computed(() => !!d.detail?.medicalNote?.consultationFinishedAt);

const noteErrors = reactive<Record<string, string>>({});
function noteErrClass(field: string) {
  return noteErrors[field] ? "ring-2 ring-red-400 border-red-400 bg-red-50" : "";
}

function scrollToFirstNoteError() {
  const first = Object.keys(noteErrors)[0];
  if (!first) return;
  const el = document.getElementById(`doctor-field-${first}`);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    (el.querySelector("input,select,textarea") as HTMLElement | null)?.focus();
  }
}

watch(() => d.note.padecimientoActual, () => delete noteErrors.padecimientoActual);
watch(() => d.note.antecedentes, () => delete noteErrors.antecedentes);
watch(() => d.note.exploracionFisica, () => delete noteErrors.exploracionFisica);
watch(() => d.note.estudiosParaclinicos, () => delete noteErrors.estudiosParaclinicos);
watch(() => d.note.diagnostico, () => delete noteErrors.diagnostico);
watch(() => d.note.planTratamiento, () => delete noteErrors.planTratamiento);
watch(() => d.note.pronostico, () => delete noteErrors.pronostico);
watch(() => d.note.contraRefWhen, () => delete noteErrors.contraRefWhen);
watch(() => d.note.contraRefFollowUp, (v) => { if (!v) delete noteErrors.contraRefWhen; });

function fmt(iso: string) {
  const dt = new Date(iso);
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Merida",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  }).format(dt);
}

// Solo valida la condicional de contrarreferencia (permite guardar borradores)
function validateForSave(): boolean {
  for (const k of Object.keys(noteErrors)) delete noteErrors[k];
  if (d.note.contraRefFollowUp && !String(d.note.contraRefWhen ?? "").trim()) {
    noteErrors.contraRefWhen = "Especificar el plazo (ej. 48 hrs)";
  }
  return Object.keys(noteErrors).length === 0;
}

// Antes de finalizar, todos los campos clinicos deben estar llenos
function validateForFinish(): boolean {
  for (const k of Object.keys(noteErrors)) delete noteErrors[k];

  const required: Array<[string, string, string]> = [
    ["padecimientoActual", String(d.note.padecimientoActual ?? ""), "Padecimiento actual obligatorio"],
    ["antecedentes", String(d.note.antecedentes ?? ""), "Antecedentes obligatorios"],
    ["exploracionFisica", String(d.note.exploracionFisica ?? ""), "Exploracion fisica obligatoria"],
    ["estudiosParaclinicos", String(d.note.estudiosParaclinicos ?? ""), "Estudios paraclinicos obligatorios"],
    ["diagnostico", String(d.note.diagnostico ?? ""), "Diagnostico obligatorio"],
    ["planTratamiento", String(d.note.planTratamiento ?? ""), "Plan / tratamiento obligatorio"],
    ["pronostico", String(d.note.pronostico ?? ""), "Pronostico obligatorio"],
  ];
  for (const [field, value, msg] of required) {
    if (!value.trim()) noteErrors[field] = msg;
  }
  if (d.note.contraRefFollowUp && !String(d.note.contraRefWhen ?? "").trim()) {
    noteErrors.contraRefWhen = "Especificar el plazo (ej. 48 hrs)";
  }
  return Object.keys(noteErrors).length === 0;
}

async function save() {
  if (!validateForSave()) {
    setTimeout(scrollToFirstNoteError, 50);
    return;
  }
  try {
    await d.save(id);
    alert("✅ Nota guardada");
  } catch (e: any) {
    alert(`Error al guardar: ${e?.response?.data?.error || e.message || "Desconocido"}`);
  }
}

async function finish() {
  if (!validateForFinish()) {
    setTimeout(scrollToFirstNoteError, 50);
    return;
  }
  if (!confirm("¿Finalizar consulta? Después quedará solo lectura.")) return;
  try {
    await d.save(id);
    await d.finish(id);
    alert("✅ Consulta finalizada");
    router.push("/doctor");
  } catch (e: any) {
    alert(`Error: ${e?.response?.data?.error || e.message || "Desconocido"}`);
  }
}

function close() {
  router.push("/doctor");
}

function classifBadgeClass(c: string) {
  const base = "text-xs px-2.5 py-0.5 rounded-full font-semibold text-white ";
  if (c === "ROJO") return base + "bg-red-500";
  if (c === "AMARILLO") return base + "bg-amber-400";
  return base + "bg-emerald-500";
}

function checkboxClass(checked: boolean) {
  const base = "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ";
  return base + (checked ? "bg-blue-600 border-blue-600" : "border-gray-300");
}

onMounted(async () => {
  await d.loadDetail(id);
});
</script>

<template>
  <div class="p-6" v-if="d.detail">
    <!-- Header -->
    <div class="mb-5 flex items-start justify-between gap-4">
      <div>
        <div class="flex items-center gap-2 mb-1">
          <button class="text-xs text-blue-600 hover:underline flex items-center gap-1" @click="close">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
            </svg>
            Volver
          </button>
          <span class="text-gray-300">·</span>
          <span class="text-xs font-semibold uppercase tracking-wider text-blue-600">Consulta médica</span>
        </div>
        <h1 class="text-2xl font-bold text-gray-800">{{ d.detail.patient.fullName }}</h1>
        <div class="flex items-center gap-2 mt-1">
          <span :class="classifBadgeClass(d.detail.classification)">{{ d.detail.classification }}</span>
          <span class="text-sm text-gray-500">Triage: {{ fmt(d.detail.triageAt) }}</span>
          <span v-if="finished" class="text-xs px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">Consulta finalizada</span>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <button class="btn-secondary" @click="d.openPdf(id)">
          <span class="flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
            </svg>
            PDF
          </span>
        </button>
        <button
            class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-40"
            :disabled="finished"
            @click="save"
        >
          Guardar nota
        </button>
        <button
            class="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-40"
            :disabled="finished"
            @click="finish"
        >
          Finalizar consulta
        </button>
      </div>
    </div>

    <!-- Info rápida enfermería -->
    <div class="grid grid-cols-2 gap-4 mb-5">
      <div class="card p-5">
        <p class="section-label">Datos del paciente</p>
        <div class="space-y-1.5 text-sm text-gray-700">
          <div>Expediente: <span class="font-semibold">{{ d.detail.patient.expediente || "—" }}</span></div>
          <div>Edad: <span class="font-semibold">{{ d.detail.patient.age ?? "—" }}</span> · Sexo: <span class="font-semibold">{{ d.detail.patient.sex ?? "—" }}</span></div>
          <div v-if="d.detail.patient.responsibleName">Responsable: {{ d.detail.patient.responsibleName }}</div>
          <div v-if="d.detail.patient.mayaHabla" class="text-purple-600 font-medium">Habla Maya</div>
          <div>Enfermero: {{ d.detail.nurse?.name || "—" }}</div>
        </div>
      </div>

      <div class="card p-5">
        <p class="section-label">Signos vitales</p>
        <div class="grid grid-cols-3 gap-3 text-sm">
          <div class="bg-gray-50 rounded-lg p-2.5 text-center">
            <div class="text-xs text-gray-400 mb-0.5">Peso</div>
            <div class="font-bold">{{ d.detail.weightKg ?? "—" }}</div>
          </div>
          <div class="bg-gray-50 rounded-lg p-2.5 text-center">
            <div class="text-xs text-gray-400 mb-0.5">Talla</div>
            <div class="font-bold">{{ d.detail.heightCm ?? "—" }}</div>
          </div>
          <div class="bg-gray-50 rounded-lg p-2.5 text-center">
            <div class="text-xs text-gray-400 mb-0.5">Temp</div>
            <div class="font-bold">{{ d.detail.temperatureC ?? "—" }}</div>
          </div>
          <div class="bg-gray-50 rounded-lg p-2.5 text-center">
            <div class="text-xs text-gray-400 mb-0.5">F.C.</div>
            <div class="font-bold">{{ d.detail.heartRate ?? "—" }}</div>
          </div>
          <div class="bg-gray-50 rounded-lg p-2.5 text-center">
            <div class="text-xs text-gray-400 mb-0.5">F.R.</div>
            <div class="font-bold">{{ d.detail.respiratoryRate ?? "—" }}</div>
          </div>
          <div class="bg-gray-50 rounded-lg p-2.5 text-center">
            <div class="text-xs text-gray-400 mb-0.5">T.A.</div>
            <div class="font-bold">{{ d.detail.bloodPressure ?? "—" }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Nota médica -->
    <div class="card p-6 mb-4">
      <p class="section-label">Nota médica</p>
      <div class="grid grid-cols-2 gap-4">
        <div id="doctor-field-padecimientoActual">
          <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Padecimiento actual <span class="text-red-500">*</span></label>
          <textarea v-model="d.note.padecimientoActual" :disabled="finished" :class="['input-base resize-none disabled:bg-gray-50 disabled:text-gray-500', noteErrClass('padecimientoActual')]" rows="4" placeholder="Describa el padecimiento actual..." />
          <p v-if="noteErrors.padecimientoActual" class="text-xs text-red-600 mt-1">{{ noteErrors.padecimientoActual }}</p>
        </div>
        <div id="doctor-field-antecedentes">
          <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Antecedentes <span class="text-red-500">*</span></label>
          <textarea v-model="d.note.antecedentes" :disabled="finished" :class="['input-base resize-none disabled:bg-gray-50 disabled:text-gray-500', noteErrClass('antecedentes')]" rows="4" placeholder="Antecedentes relevantes..." />
          <p v-if="noteErrors.antecedentes" class="text-xs text-red-600 mt-1">{{ noteErrors.antecedentes }}</p>
        </div>
        <div id="doctor-field-exploracionFisica">
          <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Exploración física <span class="text-red-500">*</span></label>
          <textarea v-model="d.note.exploracionFisica" :disabled="finished" :class="['input-base resize-none disabled:bg-gray-50 disabled:text-gray-500', noteErrClass('exploracionFisica')]" rows="4" placeholder="Hallazgos de exploración..." />
          <p v-if="noteErrors.exploracionFisica" class="text-xs text-red-600 mt-1">{{ noteErrors.exploracionFisica }}</p>
        </div>
        <div id="doctor-field-estudiosParaclinicos">
          <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Estudios paraclínicos <span class="text-red-500">*</span></label>
          <textarea v-model="d.note.estudiosParaclinicos" :disabled="finished" :class="['input-base resize-none disabled:bg-gray-50 disabled:text-gray-500', noteErrClass('estudiosParaclinicos')]" rows="4" placeholder="Estudios de laboratorio, imagen..." />
          <p v-if="noteErrors.estudiosParaclinicos" class="text-xs text-red-600 mt-1">{{ noteErrors.estudiosParaclinicos }}</p>
        </div>
        <div id="doctor-field-diagnostico">
          <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Diagnóstico(s) <span class="text-red-500">*</span></label>
          <textarea v-model="d.note.diagnostico" :disabled="finished" :class="['input-base resize-none disabled:bg-gray-50 disabled:text-gray-500', noteErrClass('diagnostico')]" rows="4" placeholder="Diagnóstico principal y secundarios..." />
          <p v-if="noteErrors.diagnostico" class="text-xs text-red-600 mt-1">{{ noteErrors.diagnostico }}</p>
        </div>
        <div id="doctor-field-planTratamiento">
          <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Plan / Tratamiento <span class="text-red-500">*</span></label>
          <textarea v-model="d.note.planTratamiento" :disabled="finished" :class="['input-base resize-none disabled:bg-gray-50 disabled:text-gray-500', noteErrClass('planTratamiento')]" rows="4" placeholder="Indicaciones y tratamiento..." />
          <p v-if="noteErrors.planTratamiento" class="text-xs text-red-600 mt-1">{{ noteErrors.planTratamiento }}</p>
        </div>
      </div>
    </div>

    <!-- Vigilancia + Contrarreferencia -->
    <div class="grid grid-cols-2 gap-4 mb-4">
      <div class="card p-5">
        <p class="section-label">Vigilar datos de alarma</p>
        <textarea
            v-model="d.note.vigilanciaTexto"
            :disabled="finished"
            class="input-base resize-none disabled:bg-gray-50 disabled:text-gray-500"
            rows="6"
            placeholder="Especificar datos de alarma / vigilancia que el paciente debe monitorear..."
        />
      </div>

      <div class="card p-5">
        <p class="section-label">Contrarreferencia</p>
        <p class="text-sm text-gray-500 mb-3">Solicitar seguimiento en Centro de Salud o 1er nivel:</p>

        <label class="flex items-center gap-2.5 mb-3 cursor-pointer">
          <div :class="checkboxClass(d.note.contraRefFollowUp)">
            <svg v-if="d.note.contraRefFollowUp" xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 text-white" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414L8.414 15l-4.121-4.121a1 1 0 111.414-1.414L8.414 12.172l7.879-7.879a1 1 0 011.414 0z" clip-rule="evenodd"/>
            </svg>
          </div>
          <input type="checkbox" v-model="d.note.contraRefFollowUp" :disabled="finished" class="sr-only" />
          <span class="text-sm text-gray-700">Sí, requiere seguimiento</span>
        </label>

        <template v-if="d.note.contraRefFollowUp">
          <div id="doctor-field-contraRefWhen">
            <input
                v-model="d.note.contraRefWhen"
                :disabled="finished"
                placeholder="¿En cuánto tiempo? (ej. 48 hrs) *"
                :class="['input-base mb-1 disabled:bg-gray-50', noteErrClass('contraRefWhen')]"
            />
            <p v-if="noteErrors.contraRefWhen" class="text-xs text-red-600 mb-3">{{ noteErrors.contraRefWhen }}</p>
            <div v-else class="mb-4"></div>
          </div>
        </template>

        <p class="section-label">Pronóstico <span class="text-red-500">*</span></p>
        <div id="doctor-field-pronostico">
          <textarea
              v-model="d.note.pronostico"
              :disabled="finished"
              :class="['input-base resize-none disabled:bg-gray-50 disabled:text-gray-500', noteErrClass('pronostico')]"
              rows="3"
              placeholder="Pronóstico del paciente..."
          />
          <p v-if="noteErrors.pronostico" class="text-xs text-red-600 mt-1">{{ noteErrors.pronostico }}</p>
        </div>
      </div>
    </div>

    <!-- Footer actions -->
    <div class="flex justify-end gap-2 pb-4">
      <button class="btn-secondary" @click="close">Volver al panel</button>
      <button
          class="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-40"
          :disabled="finished"
          @click="save"
      >
        Guardar nota
      </button>
      <button
          class="bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-40"
          :disabled="finished"
          @click="finish"
      >
        Finalizar consulta
      </button>
    </div>
  </div>
</template>