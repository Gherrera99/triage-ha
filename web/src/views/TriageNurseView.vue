<script setup lang="ts">
import { computed, onMounted, reactive, ref, onBeforeUnmount, watch } from "vue";
import { useTriageNurseStore, type TriageColor, type NurseTriageRow } from "../stores/triageNurse";
import { useSocket } from "../composables/useSocket";
import TriageGuideTable from "../components/TriageGuideTable.vue";

const s = useTriageNurseStore();

type Tab = "NEW" | "LIST";
const tab = ref<Tab>("NEW");

type StatusTab = "ESPERA" | "CONSULTA" | "ATENDIDO" | "NO_ATENDIDO";
const statusTab = ref<StatusTab>("ESPERA");

const { socket } = useSocket();
let offA: any;

const MOTIVOS = [
  "CONSULTA",
  "RETIRO DE PUNTOS",
  "NEBULIZACIONES",
  "INYECCIONES",
] as const;

function isConsultaMotivo(v: string) {
  return String(v ?? "").trim().toUpperCase() === "CONSULTA";
}

function calcAgeParts(birthDate: string | null | undefined) {
  if (!birthDate) return null;

  const birth = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return null;

  const now = new Date();

  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();

  if (now.getDate() < birth.getDate()) {
    months -= 1;
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  if (years < 0) return null;

  return { years, months };
}

function formatFullAge(birthDate: string | null | undefined) {
  const age = calcAgeParts(birthDate);
  if (!age) return "";

  const ya = age.years === 1 ? "año" : "años";
  const ma = age.months === 1 ? "mes" : "meses";
  return `${age.years} ${ya} y ${age.months} ${ma}`;
}

const form = reactive({
  expediente: "SIN EXPEDIENTE",
  motivoUrgencia: "CONSULTA",
  patientFullName: "",
  birthDate: "",
  patientAge: null as number | null, // años enteros para backend
  sex: "M" as "M" | "F" | "O",
  responsibleName: "",
  speaksMaya: false,
  observaciones: "",

  // semáforo
  appearance: "VERDE" as TriageColor,
  respiration: "VERDE" as TriageColor,
  circulation: "VERDE" as TriageColor,

  // signos vitales
  weightKg: null as number | null,
  heightCm: null as number | null,
  temperatureC: null as number | null,
  heartRate: null as number | null,
  respiratoryRate: null as number | null,
  bloodPressure: "",

  // flags
  hadPriorCareSamePathology: false,
  priorCarePlace: "",
  hasReferral: false,
  referralPlace: "",
});

const isConsulta = computed(() => isConsultaMotivo(form.motivoUrgencia));

const agePreview = computed(() => formatFullAge(form.birthDate));

watch(
    () => form.birthDate,
    (v) => {
      const parts = calcAgeParts(v);
      form.patientAge = parts ? parts.years : null;
    },
    { immediate: true }
);

watch(
    () => form.motivoUrgencia,
    (v) => {
      if (!isConsultaMotivo(v)) {
        form.appearance = "VERDE";
        form.respiration = "VERDE";
        form.circulation = "VERDE";

        form.weightKg = null;
        form.heightCm = null;
        form.temperatureC = null;
        form.heartRate = null;
        form.respiratoryRate = null;
        form.bloodPressure = "";

        form.hadPriorCareSamePathology = false;
        form.priorCarePlace = "";
        form.hasReferral = false;
        form.referralPlace = "";
      }
    }
);

const classificationPreview = computed<TriageColor>(() => {
  const rank: Record<TriageColor, number> = { VERDE: 1, AMARILLO: 2, ROJO: 3 };
  return [form.appearance, form.respiration, form.circulation].sort((a, b) => rank[a] - rank[b])[2];
});

function statusOf(r: NurseTriageRow): StatusTab {
  if (r.refusedPayment || r.noShow) return "NO_ATENDIDO";
  if (r.closedAt && !r.medicalNote?.consultationFinishedAt) return "ATENDIDO";
  if (r.medicalNote?.consultationFinishedAt) return "ATENDIDO";
  if (r.medicalNote?.consultationStartedAt) return "CONSULTA";
  return "ESPERA";
}

function badge(c: TriageColor) {
  return c === "ROJO" ? "bg-red-600" : c === "AMARILLO" ? "bg-yellow-400 text-black" : "bg-green-600";
}

function slaMinutes(c: TriageColor) {
  return c === "VERDE" ? 45 : c === "AMARILLO" ? 30 : 0;
}

function payLabel(v: "PENDING" | "PAID") {
  return v === "PAID" ? "PAGADO" : "PENDIENTE";
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

async function saveNew() {
  if (!form.motivoUrgencia.trim() || !form.patientFullName.trim()) {
    return alert("Motivo de urgencia y Nombre completo son requeridos");
  }

  const payload = {
    motivoUrgencia: form.motivoUrgencia,
    observaciones: form.observaciones.trim() || null,

    appearance: isConsulta.value ? form.appearance : "VERDE",
    respiration: isConsulta.value ? form.respiration : "VERDE",
    circulation: isConsulta.value ? form.circulation : "VERDE",
    classification: isConsulta.value ? classificationPreview.value : "VERDE",

    weightKg: isConsulta.value ? form.weightKg : null,
    heightCm: isConsulta.value ? form.heightCm : null,
    temperatureC: isConsulta.value ? form.temperatureC : null,
    heartRate: isConsulta.value ? form.heartRate : null,
    respiratoryRate: isConsulta.value ? form.respiratoryRate : null,
    bloodPressure: isConsulta.value ? (form.bloodPressure.trim() || null) : null,

    hadPriorCareSamePathology: isConsulta.value ? form.hadPriorCareSamePathology : false,
    priorCarePlace: isConsulta.value && form.hadPriorCareSamePathology ? (form.priorCarePlace.trim() || null) : null,
    hasReferral: isConsulta.value ? form.hasReferral : false,
    referralPlace: isConsulta.value && form.hasReferral ? (form.referralPlace.trim() || null) : null,

    patient: {
      expediente: form.expediente.trim() || "SIN EXPEDIENTE",
      fullName: form.patientFullName.trim(),
      birthDate: form.birthDate || null,
      age: form.patientAge,
      sex: form.sex,
      mayaHabla: form.speaksMaya,
      responsibleName: form.responsibleName.trim() || null,
    },
  };

  try {
    const created = await s.createTriage(payload);
    alert(`✅ Triage guardado. ID: ${created.id}`);

    form.expediente = "SIN EXPEDIENTE";
    form.motivoUrgencia = "CONSULTA";
    form.patientFullName = "";
    form.birthDate = "";
    form.patientAge = null;
    form.sex = "M";
    form.responsibleName = "";
    form.speaksMaya = false;
    form.observaciones = "";

    form.appearance = "VERDE";
    form.respiration = "VERDE";
    form.circulation = "VERDE";

    form.weightKg = null;
    form.heightCm = null;
    form.temperatureC = null;
    form.heartRate = null;
    form.respiratoryRate = null;
    form.bloodPressure = "";

    form.hadPriorCareSamePathology = false;
    form.priorCarePlace = "";
    form.hasReferral = false;
    form.referralPlace = "";

    tab.value = "LIST";
  } catch (e: any) {
    const status = e?.response?.status;
    if (status === 401) return alert("⚠️ No autorizado. Vuelve a iniciar sesión.");
    alert(`Error al guardar: ${e?.response?.data?.error || e.message || "Desconocido"}`);
  }
}

// LISTA + REVALORACIÓN
const q = ref("");

const filtered = computed(() => {
  const term = q.value.trim().toLowerCase();
  const rank: Record<TriageColor, number> = { VERDE: 1, AMARILLO: 2, ROJO: 3 };

  return s.rows
      .filter((r) => {
        if (!term) return true;
        const p = r.patient;
        return (
            String(r.id).includes(term) ||
            (p.fullName || "").toLowerCase().includes(term) ||
            (p.expediente || "").toLowerCase().includes(term) ||
            (r.motivoUrgencia || "").toLowerCase().includes(term)
        );
      })
      .sort((a, b) => {
        const byClass = rank[b.classification] - rank[a.classification];
        if (byClass !== 0) return byClass;
        return new Date(a.triageAt).getTime() - new Date(b.triageAt).getTime();
      });
});

const filteredByStatus = computed(() => {
  return filtered.value.filter((r) => statusOf(r) === statusTab.value);
});

const showRevalue = ref(false);
const re = reactive({
  id: 0,
  appearance: "VERDE" as TriageColor,
  respiration: "VERDE" as TriageColor,
  circulation: "VERDE" as TriageColor,

  weightKg: null as number | null,
  heightCm: null as number | null,
  temperatureC: null as number | null,
  heartRate: null as number | null,
  respiratoryRate: null as number | null,
  bloodPressure: "",

  hadPriorCareSamePathology: false,
  priorCarePlace: "",
  hasReferral: false,
  referralPlace: "",
});

const reClassPreview = computed<TriageColor>(() => {
  const rank: Record<TriageColor, number> = { VERDE: 1, AMARILLO: 2, ROJO: 3 };
  return [re.appearance, re.respiration, re.circulation].sort((a, b) => rank[a] - rank[b])[2];
});

function canRevalue(row: NurseTriageRow) {
  return statusOf(row) === "ESPERA" && isConsultaMotivo(row.motivoUrgencia);
}

function openRevalue(row: NurseTriageRow) {
  if (!canRevalue(row)) return;

  s.select(row.id);
  re.id = row.id;
  re.appearance = row.appearance;
  re.respiration = row.respiration;
  re.circulation = row.circulation;

  re.weightKg = row.weightKg ?? null;
  re.heightCm = row.heightCm ?? null;
  re.temperatureC = row.temperatureC ?? null;
  re.heartRate = row.heartRate ?? null;
  re.respiratoryRate = row.respiratoryRate ?? null;
  re.bloodPressure = row.bloodPressure ?? "";

  re.hadPriorCareSamePathology = !!row.hadPriorCareSamePathology;
  re.priorCarePlace = row.priorCarePlace ?? "";
  re.hasReferral = !!row.hasReferral;
  re.referralPlace = row.referralPlace ?? "";

  showRevalue.value = true;
}

async function submitRevalue() {
  try {
    await s.revalue(re.id, {
      appearance: re.appearance,
      respiration: re.respiration,
      circulation: re.circulation,

      weightKg: re.weightKg,
      heightCm: re.heightCm,
      temperatureC: re.temperatureC,
      heartRate: re.heartRate,
      respiratoryRate: re.respiratoryRate,
      bloodPressure: re.bloodPressure.trim() || null,

      hadPriorCareSamePathology: re.hadPriorCareSamePathology,
      priorCarePlace: re.hadPriorCareSamePathology ? (re.priorCarePlace.trim() || null) : null,
      hasReferral: re.hasReferral,
      referralPlace: re.hasReferral ? (re.referralPlace.trim() || null) : null,
    });

    alert("✅ Revaloración guardada");
    showRevalue.value = false;
  } catch (e: any) {
    const status = e?.response?.status;
    if (status === 401) return alert("⚠️ No autorizado. Vuelve a iniciar sesión.");
    alert(`Error al revalorar: ${e?.response?.data?.error || e.message || "Desconocido"}`);
  }
}

onMounted(async () => {
  await s.fetchRecent();

  const refresh = () => s.fetchRecent();

  socket.on("triage:new", refresh);
  socket.on("triage:updated", refresh);
  socket.on("payment:paid", refresh);
  socket.on("consultation:started", refresh);
  socket.on("consultation:finished", refresh);

  offA = () => {
    socket.off("triage:new", refresh);
    socket.off("triage:updated", refresh);
    socket.off("payment:paid", refresh);
    socket.off("consultation:started", refresh);
    socket.off("consultation:finished", refresh);
  };
});

onBeforeUnmount(() => {
  offA?.();
});
</script>

<template>
  <div class="p-6 max-w-7xl mx-auto">
    <div class="bg-white rounded-2xl shadow p-6">
      <div class="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 class="text-2xl font-semibold">Enfermería - Triage</h1>
          <div class="text-sm text-gray-500 mt-1">Captura, lista y revaloración de pacientes</div>
        </div>

        <div class="flex gap-2">
          <button
              class="px-4 py-2 rounded-xl border text-sm"
              :class="tab === 'NEW' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'hover:bg-gray-50'"
              @click="tab='NEW'"
          >
            Nuevo Triage
          </button>
          <button
              class="px-4 py-2 rounded-xl border text-sm"
              :class="tab === 'LIST' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'hover:bg-gray-50'"
              @click="tab='LIST'"
          >
            Pacientes (Lista)
          </button>
          <button
              class="px-4 py-2 rounded-xl border text-sm hover:bg-gray-50"
              @click="s.openOwnReportPdf()"
          >
            Imprimir reporte
          </button>
        </div>
      </div>

      <!-- TAB: NEW -->
      <div v-if="tab === 'NEW'">
        <div class="flex items-center justify-between mb-4" v-if="isConsulta">
          <div class="flex items-center gap-2">
            <span class="text-white text-xs px-2 py-1 rounded-full" :class="badge(classificationPreview)">
              {{ classificationPreview }}
            </span>
            <span class="text-sm text-gray-600">
              SLA: {{ slaMinutes(classificationPreview) }} min
            </span>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="text-sm font-medium">No. Expediente</label>
            <input v-model="form.expediente" class="w-full border rounded-xl p-2" />
          </div>

          <div>
            <label class="text-sm font-medium">Motivo de urgencia *</label>
            <select v-model="form.motivoUrgencia" class="w-full border rounded-xl p-2">
              <option v-for="m in MOTIVOS" :key="m" :value="m">{{ m }}</option>
            </select>
          </div>

          <div>
            <label class="text-sm font-medium">Nombre completo *</label>
            <input v-model="form.patientFullName" class="w-full border rounded-xl p-2" />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-sm font-medium">Fecha de nacimiento</label>
              <input v-model="form.birthDate" type="date" class="w-full border rounded-xl p-2" />
            </div>
            <div>
              <label class="text-sm font-medium">Edad</label>
              <input :value="agePreview" class="w-full border rounded-xl p-2 bg-gray-50" readonly />
            </div>
          </div>

          <div>
            <label class="text-sm font-medium">Responsable</label>
            <input v-model="form.responsibleName" class="w-full border rounded-xl p-2" />
          </div>

          <div>
            <label class="text-sm font-medium">Sexo</label>
            <select v-model="form.sex" class="w-full border rounded-xl p-2">
              <option value="M">M</option>
              <option value="F">F</option>
              <option value="O">O</option>
            </select>
          </div>

          <div class="flex items-center gap-2 mt-6">
            <input type="checkbox" v-model="form.speaksMaya" />
            <span class="text-sm">Habla Maya</span>
          </div>

          <div class="col-span-2">
            <label class="text-sm font-medium">Observaciones</label>
            <textarea
                v-model="form.observaciones"
                class="w-full border rounded-xl p-2"
                rows="3"
                placeholder="Observaciones generales"
            />
          </div>
        </div>

        <template v-if="isConsulta">
          <TriageGuideTable class="mt-6" />

          <div class="mt-6 grid grid-cols-3 gap-4">
            <div class="border rounded-2xl p-4">
              <div class="font-semibold mb-2">Apariencia</div>
              <select v-model="form.appearance" class="w-full border rounded-xl p-2">
                <option value="VERDE">Verde</option>
                <option value="AMARILLO">Amarillo</option>
                <option value="ROJO">Rojo</option>
              </select>
            </div>

            <div class="border rounded-2xl p-4">
              <div class="font-semibold mb-2">Respiración</div>
              <select v-model="form.respiration" class="w-full border rounded-xl p-2">
                <option value="VERDE">Verde</option>
                <option value="AMARILLO">Amarillo</option>
                <option value="ROJO">Rojo</option>
              </select>
            </div>

            <div class="border rounded-2xl p-4">
              <div class="font-semibold mb-2">Circulación</div>
              <select v-model="form.circulation" class="w-full border rounded-xl p-2">
                <option value="VERDE">Verde</option>
                <option value="AMARILLO">Amarillo</option>
                <option value="ROJO">Rojo</option>
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

          <div class="mt-6 border rounded-2xl p-4">
            <div class="font-semibold mb-3">Datos adicionales</div>

            <div class="grid grid-cols-2 gap-4">
              <div class="border rounded-2xl p-4">
                <div class="font-semibold mb-2">Atención previa por misma patología</div>
                <label class="flex items-center gap-2 text-sm">
                  <input type="checkbox" v-model="form.hadPriorCareSamePathology" />
                  Sí
                </label>
                <input
                    v-if="form.hadPriorCareSamePathology"
                    v-model="form.priorCarePlace"
                    class="mt-2 w-full border rounded-xl p-2"
                    placeholder="Lugar de atención previa"
                />
              </div>

              <div class="border rounded-2xl p-4">
                <div class="font-semibold mb-2">Paciente con referencia</div>
                <label class="flex items-center gap-2 text-sm">
                  <input type="checkbox" v-model="form.hasReferral" />
                  Sí
                </label>
                <input
                    v-if="form.hasReferral"
                    v-model="form.referralPlace"
                    class="mt-2 w-full border rounded-xl p-2"
                    placeholder="Lugar de referencia"
                />
              </div>
            </div>
          </div>
        </template>

        <div class="mt-6 flex justify-end">
          <button
              class="px-4 py-2 rounded-xl bg-blue-600 text-white disabled:opacity-50"
              :disabled="s.saving"
              @click="saveNew"
          >
            Guardar Triage
          </button>
        </div>
      </div>

      <!-- TAB: LIST -->
      <div v-else>
        <div class="flex items-center justify-between gap-4 mb-4">
          <div class="flex items-center gap-2">
            <input
                v-model="q"
                class="border rounded-xl p-2 w-96"
                placeholder="Buscar por nombre, expediente, motivo o ID..."
            />
            <button class="px-3 py-2 rounded-xl border text-sm hover:bg-gray-50" @click="s.fetchRecent()">
              Refrescar
            </button>
          </div>

          <div class="text-sm text-gray-500">
            {{ filteredByStatus.length }} registros
          </div>
        </div>

        <div class="overflow-auto border rounded-2xl">
          <div class="flex gap-2 mb-3">
            <button
                class="px-3 py-2 rounded-xl border text-sm"
                :class="statusTab==='ESPERA' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'hover:bg-gray-50'"
                @click="statusTab='ESPERA'"
            >EN ESPERA</button>

            <button
                class="px-3 py-2 rounded-xl border text-sm"
                :class="statusTab==='CONSULTA' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'hover:bg-gray-50'"
                @click="statusTab='CONSULTA'"
            >EN CONSULTA</button>

            <button
                class="px-3 py-2 rounded-xl border text-sm"
                :class="statusTab==='ATENDIDO' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'hover:bg-gray-50'"
                @click="statusTab='ATENDIDO'"
            >ATENDIDO</button>

            <button
                class="px-3 py-2 rounded-xl border text-sm"
                :class="statusTab==='NO_ATENDIDO' ? 'bg-red-50 border-red-200 text-red-700' : 'hover:bg-gray-50'"
                @click="statusTab='NO_ATENDIDO'"
            >NO ATENDIDO</button>
          </div>

          <table class="w-full text-sm">
            <thead class="bg-gray-50">
            <tr class="text-left border-b">
              <th class="py-2 px-3">ID</th>
              <th class="py-2 px-3">Fecha/Hora</th>
              <th class="py-2 px-3">Expediente</th>
              <th class="py-2 px-3">Paciente</th>
              <th class="py-2 px-3">Motivo</th>
              <th class="py-2 px-3">Clasif.</th>
              <th class="py-2 px-3">Pago</th>
              <th class="py-2 px-3">Acciones</th>
            </tr>
            </thead>

            <tbody>
            <tr v-for="r in filteredByStatus" :key="r.id" class="border-b">
              <td class="py-2 px-3">{{ r.id }}</td>
              <td class="py-2 px-3">{{ fmtMerida(r.triageAt) }}</td>
              <td class="py-2 px-3">{{ r.patient.expediente || "SIN EXPEDIENTE" }}</td>
              <td class="py-2 px-3">
                <div class="font-medium">{{ r.patient.fullName }}</div>
                <div class="text-xs text-gray-500">
                  {{ r.patient.age || "-" }} · {{ r.patient.sex ?? "-" }}
                  <span v-if="r.patient.mayaHabla">· Maya</span>
                  <span v-if="r.patient.responsibleName">· Resp: {{ r.patient.responsibleName }}</span>
                </div>
              </td>
              <td class="py-2 px-3">{{ r.motivoUrgencia }}</td>
              <td class="py-2 px-3">
                  <span class="text-white text-xs px-2 py-1 rounded-full" :class="badge(r.classification)">
                    {{ r.classification }}
                  </span>
              </td>
              <td class="py-2 px-3">
                  <span
                      class="text-xs px-2 py-1 rounded-full"
                      :class="r.paidStatus === 'PAID' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'"
                  >
                    {{ payLabel(r.paidStatus) }}
                  </span>
              </td>
              <td class="py-2 px-3">
                <button
                    class="px-3 py-1 rounded-xl border text-xs hover:bg-gray-50 disabled:opacity-50"
                    :disabled="!canRevalue(r)"
                    @click="openRevalue(r)"
                >
                  Revalorar
                </button>
              </td>
            </tr>

            <tr v-if="!filteredByStatus.length">
              <td colspan="8" class="py-6 text-center text-gray-500">Sin registros</td>
            </tr>
            </tbody>
          </table>
        </div>

        <!-- Panel Revaloración -->
        <div
            v-if="showRevalue"
            class="fixed inset-0 bg-black/30 flex justify-end"
            @click.self="showRevalue=false"
        >
          <div class="w-full max-w-xl h-full bg-white p-6 overflow-auto">
            <div class="flex items-start justify-between gap-4 mb-4">
              <div>
                <div class="text-lg font-semibold">Revaloración</div>
                <div class="text-sm text-gray-500">
                  ID: {{ re.id }} · Clasificación preview:
                  <span class="text-white text-xs px-2 py-1 rounded-full" :class="badge(reClassPreview)">{{ reClassPreview }}</span>
                </div>
              </div>
              <button class="px-3 py-2 rounded-xl border text-sm hover:bg-gray-50" @click="showRevalue=false">Cerrar</button>
            </div>

            <div class="grid grid-cols-3 gap-3">
              <div class="border rounded-2xl p-4">
                <div class="font-semibold mb-2">Apariencia</div>
                <select v-model="re.appearance" class="w-full border rounded-xl p-2">
                  <option value="VERDE">Verde</option>
                  <option value="AMARILLO">Amarillo</option>
                  <option value="ROJO">Rojo</option>
                </select>
              </div>
              <div class="border rounded-2xl p-4">
                <div class="font-semibold mb-2">Respiración</div>
                <select v-model="re.respiration" class="w-full border rounded-xl p-2">
                  <option value="VERDE">Verde</option>
                  <option value="AMARILLO">Amarillo</option>
                  <option value="ROJO">Rojo</option>
                </select>
              </div>
              <div class="border rounded-2xl p-4">
                <div class="font-semibold mb-2">Circulación</div>
                <select v-model="re.circulation" class="w-full border rounded-xl p-2">
                  <option value="VERDE">Verde</option>
                  <option value="AMARILLO">Amarillo</option>
                  <option value="ROJO">Rojo</option>
                </select>
              </div>
            </div>

            <div class="mt-4 border rounded-2xl p-4">
              <div class="font-semibold mb-3">Signos vitales</div>
              <div class="grid grid-cols-3 gap-3">
                <input v-model.number="re.weightKg" type="number" step="0.01" class="border rounded-xl p-2" placeholder="Peso (kg)" />
                <input v-model.number="re.heightCm" type="number" step="0.01" class="border rounded-xl p-2" placeholder="Talla (cm)" />
                <input v-model.number="re.temperatureC" type="number" step="0.1" class="border rounded-xl p-2" placeholder="Temp (°C)" />
                <input v-model.number="re.heartRate" type="number" class="border rounded-xl p-2" placeholder="FC" />
                <input v-model.number="re.respiratoryRate" type="number" class="border rounded-xl p-2" placeholder="FR" />
                <input v-model="re.bloodPressure" class="border rounded-xl p-2" placeholder="T.A. 120/80" />
              </div>
            </div>

            <div class="mt-4 border rounded-2xl p-4">
              <div class="font-semibold mb-3">Datos adicionales</div>
              <div class="grid grid-cols-2 gap-4">
                <div class="border rounded-2xl p-4">
                  <div class="font-semibold mb-2">Atención previa por misma patología</div>
                  <label class="flex items-center gap-2 text-sm">
                    <input type="checkbox" v-model="re.hadPriorCareSamePathology" />
                    Sí
                  </label>
                  <input
                      v-if="re.hadPriorCareSamePathology"
                      v-model="re.priorCarePlace"
                      class="mt-2 w-full border rounded-xl p-2"
                      placeholder="Lugar de atención previa"
                  />
                </div>
                <div class="border rounded-2xl p-4">
                  <div class="font-semibold mb-2">Paciente con referencia</div>
                  <label class="flex items-center gap-2 text-sm">
                    <input type="checkbox" v-model="re.hasReferral" />
                    Sí
                  </label>
                  <input
                      v-if="re.hasReferral"
                      v-model="re.referralPlace"
                      class="mt-2 w-full border rounded-xl p-2"
                      placeholder="Lugar de referencia"
                  />
                </div>
              </div>
            </div>

            <div class="mt-6 flex justify-end">
              <button
                  class="px-4 py-2 rounded-xl bg-blue-600 text-white disabled:opacity-50"
                  :disabled="s.saving"
                  @click="submitRevalue"
              >
                Guardar Revaloración
              </button>
            </div>
          </div>
        </div>
      </div>
      <!-- /TAB LIST -->
    </div>
  </div>
</template>