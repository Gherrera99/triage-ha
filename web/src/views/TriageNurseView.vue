<script setup lang="ts">
import { computed, onMounted, reactive, ref, onBeforeUnmount, watch } from "vue";
import { useTriageNurseStore, type NurseTriageRow } from "../stores/triageNurse";
import { slaMinutes, type TriageColor } from "../utils/triage";
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
  patientAge: null as number | null,
  sex: "M" as "M" | "F" | "O",
  responsibleName: "",
  speaksMaya: false,
  observaciones: "",

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
  if (r.medicalNote?.consultationFinishedAt) return "ATENDIDO";
  if (r.closedAt && !r.medicalNote?.consultationFinishedAt) return "ATENDIDO";
  if (r.medicalNote?.consultationStartedAt) return "CONSULTA";
  return "ESPERA";
}

function badgeClass(c: TriageColor) {
  return c === "ROJO" ? "badge-rojo" : c === "AMARILLO" ? "badge-amarillo" : "badge-verde";
}

function tabClass(active: boolean) {
  return active ? "tab-btn tab-btn-active" : "tab-btn tab-btn-inactive";
}

function tabNoAtendidoClass(active: boolean) {
  return active
    ? "tab-btn bg-red-600 border-red-600 text-white"
    : "tab-btn border-gray-200 text-gray-600 hover:bg-gray-50";
}

function classifBannerClass(c: TriageColor) {
  const base = "mb-6 rounded-2xl px-5 py-4 flex items-center justify-between ";
  if (c === "ROJO") return base + "bg-red-50 border border-red-200";
  if (c === "AMARILLO") return base + "bg-amber-50 border border-amber-200";
  return base + "bg-emerald-50 border border-emerald-200";
}

function badgeSpanClass(c: TriageColor) {
  return badgeClass(c) + " text-sm px-3 py-1";
}

function checkboxClass(checked: boolean) {
  const base = "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ";
  return base + (checked ? "bg-blue-600 border-blue-600" : "border-gray-300");
}

function payBadgeClass(paid: string) {
  const base = "text-xs px-2 py-0.5 rounded-full font-medium ";
  return base + (paid === "PAID" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600");
}


function payLabel(v: "PENDING" | "PAID") {
  return v === "PAID" ? "Pagado" : "Pendiente";
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

function hasMax3Decimals(v: number | null): boolean {
  if (v === null || v === undefined || Number.isNaN(v)) return false;
  if (!Number.isFinite(v)) return false;
  return Math.abs(v - Math.round(v * 1000) / 1000) < 1e-9;
}

// ====== Validacion inline (bordes rojos + mensaje debajo) ======
const formErrors = reactive<Record<string, string>>({});

function clearFormErrors() {
  for (const k of Object.keys(formErrors)) delete formErrors[k];
}

function fieldErrClass(field: string) {
  return formErrors[field] ? "ring-2 ring-red-400 border-red-400 bg-red-50" : "";
}

function scrollToFirstError() {
  const first = Object.keys(formErrors)[0];
  if (!first) return;
  const el = document.getElementById(`triage-field-${first}`);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    (el.querySelector("input,select,textarea") as HTMLElement | null)?.focus();
  }
}

// Auto-limpia el error de un campo cuando el usuario lo modifica
watch(() => form.birthDate, () => delete formErrors.birthDate);
watch(() => form.responsibleName, () => delete formErrors.responsibleName);
watch(() => form.patientFullName, () => delete formErrors.patientFullName);
watch(() => form.motivoUrgencia, () => delete formErrors.motivoUrgencia);
watch(() => form.weightKg, () => delete formErrors.weightKg);
watch(() => form.heightCm, () => delete formErrors.heightCm);
watch(() => form.temperatureC, () => delete formErrors.temperatureC);
watch(() => form.heartRate, () => delete formErrors.heartRate);
watch(() => form.respiratoryRate, () => delete formErrors.respiratoryRate);
watch(() => form.bloodPressure, () => delete formErrors.bloodPressure);
watch(() => form.priorCarePlace, () => delete formErrors.priorCarePlace);
watch(() => form.referralPlace, () => delete formErrors.referralPlace);

async function saveNew() {
  clearFormErrors();
  if (!form.motivoUrgencia.trim()) formErrors.motivoUrgencia = "Obligatorio";
  if (!form.patientFullName.trim()) formErrors.patientFullName = "Obligatorio";
  if (!form.birthDate) formErrors.birthDate = "Fecha de nacimiento obligatoria";
  if (!form.responsibleName.trim()) formErrors.responsibleName = "Nombre del responsable obligatorio";

  if (isConsulta.value) {
    const numericChecks: Array<[string, number | null]> = [
      ["weightKg", form.weightKg],
      ["heightCm", form.heightCm],
      ["temperatureC", form.temperatureC],
      ["heartRate", form.heartRate],
      ["respiratoryRate", form.respiratoryRate],
    ];
    for (const [field, val] of numericChecks) {
      if (val === null || val === undefined || Number.isNaN(val as any)) {
        formErrors[field] = "Obligatorio";
      } else if (!hasMax3Decimals(val)) {
        formErrors[field] = "Máximo 3 decimales";
      }
    }
    if (!form.bloodPressure.trim()) formErrors.bloodPressure = "Obligatoria";

    if (form.hadPriorCareSamePathology && !form.priorCarePlace.trim()) {
      formErrors.priorCarePlace = "Especificar el lugar";
    }
    if (form.hasReferral && !form.referralPlace.trim()) {
      formErrors.referralPlace = "Especificar el lugar";
    }
  }

  if (Object.keys(formErrors).length) {
    setTimeout(scrollToFirstError, 50);
    return;
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

const reErrors = reactive<Record<string, string>>({});
function reErrClass(field: string) {
  return reErrors[field] ? "ring-2 ring-red-400 border-red-400 bg-red-50" : "";
}
watch(() => re.weightKg, () => delete reErrors.weightKg);
watch(() => re.heightCm, () => delete reErrors.heightCm);
watch(() => re.temperatureC, () => delete reErrors.temperatureC);
watch(() => re.heartRate, () => delete reErrors.heartRate);
watch(() => re.respiratoryRate, () => delete reErrors.respiratoryRate);
watch(() => re.priorCarePlace, () => delete reErrors.priorCarePlace);
watch(() => re.referralPlace, () => delete reErrors.referralPlace);

async function submitRevalue() {
  for (const k of Object.keys(reErrors)) delete reErrors[k];
  const checks: Array<[string, number | null]> = [
    ["weightKg", re.weightKg],
    ["heightCm", re.heightCm],
    ["temperatureC", re.temperatureC],
    ["heartRate", re.heartRate],
    ["respiratoryRate", re.respiratoryRate],
  ];
  for (const [field, val] of checks) {
    if (val !== null && val !== undefined && !Number.isNaN(val as any) && !hasMax3Decimals(val)) {
      reErrors[field] = "Máximo 3 decimales";
    }
  }
  if (re.hadPriorCareSamePathology && !re.priorCarePlace.trim()) {
    reErrors.priorCarePlace = "Especificar el lugar";
  }
  if (re.hasReferral && !re.referralPlace.trim()) {
    reErrors.referralPlace = "Especificar el lugar";
  }
  if (Object.keys(reErrors).length) return;

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
  <div class="p-6">
    <!-- Page header -->
    <div class="mb-6 flex items-start justify-between gap-4">
      <div>
        <div class="flex items-center gap-2 mb-1">
          <div class="w-2.5 h-2.5 rounded-full bg-purple-500"></div>
          <span class="text-xs font-semibold uppercase tracking-wider text-purple-600">Enfermería</span>
        </div>
        <h1 class="text-2xl font-bold text-gray-800">Registro de Triage</h1>
        <p class="text-sm text-gray-500 mt-0.5">Captura, lista y revaloración de pacientes</p>
      </div>

      <div class="flex items-center gap-2">
        <button
            :class="tabClass(tab === 'NEW')"
            @click="tab='NEW'"
        >
          <span class="flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
            </svg>
            Nuevo Triage
          </span>
        </button>
        <button
            :class="tabClass(tab === 'LIST')"
            @click="tab='LIST'"
        >
          Pacientes
        </button>
        <button class="btn-secondary" @click="s.openOwnReportPdf()">
          Imprimir reporte
        </button>
      </div>
    </div>

    <!-- TAB: NEW -->
    <div v-if="tab === 'NEW'">
      <!-- Classification preview banner -->
      <div
          v-if="isConsulta"
          :class="classifBannerClass(classificationPreview)"
      >
        <div class="flex items-center gap-3">
          <span :class="badgeSpanClass(classificationPreview)">
            {{ classificationPreview }}
          </span>
          <span class="text-sm font-medium text-gray-700">Clasificación actual</span>
        </div>
        <span class="text-sm text-gray-500">
          SLA: <span class="font-semibold">{{ slaMinutes(classificationPreview) }} min</span>
        </span>
      </div>

      <!-- Datos del paciente -->
      <div class="card p-6 mb-4">
        <p class="section-label">Datos del paciente</p>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">No. Expediente</label>
            <input v-model="form.expediente" class="input-base" placeholder="SIN EXPEDIENTE" />
          </div>

          <div id="triage-field-motivoUrgencia">
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Motivo de urgencia <span class="text-red-500">*</span></label>
            <select v-model="form.motivoUrgencia" :class="['input-base', fieldErrClass('motivoUrgencia')]">
              <option v-for="m in MOTIVOS" :key="m" :value="m">{{ m }}</option>
            </select>
            <p v-if="formErrors.motivoUrgencia" class="text-xs text-red-600 mt-1">{{ formErrors.motivoUrgencia }}</p>
          </div>

          <div class="col-span-2" id="triage-field-patientFullName">
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Nombre completo <span class="text-red-500">*</span></label>
            <input v-model="form.patientFullName" :class="['input-base', fieldErrClass('patientFullName')]" placeholder="Nombre y apellidos del paciente" />
            <p v-if="formErrors.patientFullName" class="text-xs text-red-600 mt-1">{{ formErrors.patientFullName }}</p>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div id="triage-field-birthDate">
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Fecha de nacimiento <span class="text-red-500">*</span></label>
              <input v-model="form.birthDate" type="date" :class="['input-base', fieldErrClass('birthDate')]" />
              <p v-if="formErrors.birthDate" class="text-xs text-red-600 mt-1">{{ formErrors.birthDate }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Edad calculada</label>
              <input :value="agePreview" class="input-base bg-gray-50 text-gray-500 cursor-not-allowed" readonly placeholder="—" />
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Sexo</label>
            <select v-model="form.sex" class="input-base">
              <option value="M">Masculino</option>
              <option value="F">Femenino</option>
            </select>
          </div>

          <div id="triage-field-responsibleName">
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Nombre del responsable <span class="text-red-500">*</span></label>
            <input v-model="form.responsibleName" :class="['input-base', fieldErrClass('responsibleName')]" placeholder="Nombre del tutor o responsable" />
            <p v-if="formErrors.responsibleName" class="text-xs text-red-600 mt-1">{{ formErrors.responsibleName }}</p>
          </div>

          <div class="col-span-2">
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Observaciones</label>
            <textarea
                v-model="form.observaciones"
                class="input-base resize-none"
                rows="3"
                placeholder="Observaciones generales de enfermería..."
            />
          </div>

          <div class="col-span-2">
            <label class="flex items-center gap-2.5 cursor-pointer select-none">
              <div :class="checkboxClass(form.speaksMaya)">
                <svg v-if="form.speaksMaya" xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414L8.414 15l-4.121-4.121a1 1 0 111.414-1.414L8.414 12.172l7.879-7.879a1 1 0 011.414 0z" clip-rule="evenodd"/>
                </svg>
              </div>
              <input type="checkbox" v-model="form.speaksMaya" class="sr-only" />
              <span class="text-sm text-gray-700">Paciente habla Maya</span>
            </label>
          </div>
        </div>
      </div>

      <!-- Semáforo + signos vitales (solo CONSULTA) -->
      <template v-if="isConsulta">
        <TriageGuideTable class="mb-4" />

        <div class="card p-6 mb-4">
          <p class="section-label">Clasificación (Semáforo)</p>
          <div class="grid grid-cols-3 gap-4">
            <div v-for="(field, label) in { Apariencia: 'appearance', Respiración: 'respiration', Circulación: 'circulation' }" :key="label">
              <label class="block text-sm font-medium text-gray-700 mb-1.5">{{ label }}</label>
              <select v-model="(form as any)[field]" class="input-base">
                <option value="VERDE">Verde</option>
                <option value="AMARILLO">Amarillo</option>
                <option value="ROJO">Rojo</option>
              </select>
            </div>
          </div>
        </div>

        <div class="card p-6 mb-4">
          <p class="section-label">Signos vitales</p>
          <div class="grid grid-cols-3 gap-4">
            <div id="triage-field-weightKg">
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Peso (kg) <span class="text-red-500">*</span></label>
              <input v-model.number="form.weightKg" type="number" step="0.001" min="0" :class="['input-base', fieldErrClass('weightKg')]" placeholder="0.000" />
              <p v-if="formErrors.weightKg" class="text-xs text-red-600 mt-1">{{ formErrors.weightKg }}</p>
            </div>
            <div id="triage-field-heightCm">
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Talla (cm) <span class="text-red-500">*</span></label>
              <input v-model.number="form.heightCm" type="number" step="0.001" min="0" :class="['input-base', fieldErrClass('heightCm')]" placeholder="0.000" />
              <p v-if="formErrors.heightCm" class="text-xs text-red-600 mt-1">{{ formErrors.heightCm }}</p>
            </div>
            <div id="triage-field-temperatureC">
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Temperatura (°C) <span class="text-red-500">*</span></label>
              <input v-model.number="form.temperatureC" type="number" step="0.001" min="0" :class="['input-base', fieldErrClass('temperatureC')]" placeholder="36.500" />
              <p v-if="formErrors.temperatureC" class="text-xs text-red-600 mt-1">{{ formErrors.temperatureC }}</p>
            </div>
            <div id="triage-field-heartRate">
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Frec. Cardíaca <span class="text-red-500">*</span></label>
              <input v-model.number="form.heartRate" type="number" step="0.001" min="0" :class="['input-base', fieldErrClass('heartRate')]" placeholder="lpm" />
              <p v-if="formErrors.heartRate" class="text-xs text-red-600 mt-1">{{ formErrors.heartRate }}</p>
            </div>
            <div id="triage-field-respiratoryRate">
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Frec. Respiratoria <span class="text-red-500">*</span></label>
              <input v-model.number="form.respiratoryRate" type="number" step="0.001" min="0" :class="['input-base', fieldErrClass('respiratoryRate')]" placeholder="rpm" />
              <p v-if="formErrors.respiratoryRate" class="text-xs text-red-600 mt-1">{{ formErrors.respiratoryRate }}</p>
            </div>
            <div id="triage-field-bloodPressure">
              <label class="block text-sm font-medium text-gray-700 mb-1.5">T.A. <span class="text-red-500">*</span></label>
              <input v-model="form.bloodPressure" :class="['input-base', fieldErrClass('bloodPressure')]" placeholder="120/80" />
              <p v-if="formErrors.bloodPressure" class="text-xs text-red-600 mt-1">{{ formErrors.bloodPressure }}</p>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4 mb-4">
          <div class="card p-5">
            <p class="section-label">Atención previa</p>
            <label class="flex items-center gap-2.5 cursor-pointer mb-3">
              <div :class="checkboxClass(form.hadPriorCareSamePathology)">
                <svg v-if="form.hadPriorCareSamePathology" xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414L8.414 15l-4.121-4.121a1 1 0 111.414-1.414L8.414 12.172l7.879-7.879a1 1 0 011.414 0z" clip-rule="evenodd"/>
                </svg>
              </div>
              <input type="checkbox" v-model="form.hadPriorCareSamePathology" class="sr-only" />
              <span class="text-sm text-gray-700">Atención previa misma patología</span>
            </label>
            <div v-if="form.hadPriorCareSamePathology" id="triage-field-priorCarePlace">
              <input
                  v-model="form.priorCarePlace"
                  :class="['input-base', fieldErrClass('priorCarePlace')]"
                  placeholder="Lugar de atención previa *"
              />
              <p v-if="formErrors.priorCarePlace" class="text-xs text-red-600 mt-1">{{ formErrors.priorCarePlace }}</p>
            </div>
          </div>

          <div class="card p-5">
            <p class="section-label">Referencia</p>
            <label class="flex items-center gap-2.5 cursor-pointer mb-3">
              <div :class="checkboxClass(form.hasReferral)">
                <svg v-if="form.hasReferral" xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414L8.414 15l-4.121-4.121a1 1 0 111.414-1.414L8.414 12.172l7.879-7.879a1 1 0 011.414 0z" clip-rule="evenodd"/>
                </svg>
              </div>
              <input type="checkbox" v-model="form.hasReferral" class="sr-only" />
              <span class="text-sm text-gray-700">Paciente con referencia</span>
            </label>
            <div v-if="form.hasReferral" id="triage-field-referralPlace">
              <input
                  v-model="form.referralPlace"
                  :class="['input-base', fieldErrClass('referralPlace')]"
                  placeholder="Lugar de referencia *"
              />
              <p v-if="formErrors.referralPlace" class="text-xs text-red-600 mt-1">{{ formErrors.referralPlace }}</p>
            </div>
          </div>
        </div>
      </template>

      <div class="flex justify-end">
        <button class="btn-primary px-6 py-3 text-base" :disabled="s.saving" @click="saveNew">
          <span v-if="s.saving" class="flex items-center gap-2">
            <svg class="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            Guardando...
          </span>
          <span v-else>Guardar Triage</span>
        </button>
      </div>
    </div>

    <!-- TAB: LIST -->
    <div v-else>
      <!-- Toolbar -->
      <div class="flex items-center justify-between gap-4 mb-4">
        <div class="flex items-center gap-3 flex-1">
          <input
              v-model="q"
              class="input-base max-w-md"
              placeholder="Buscar por nombre, expediente, motivo o ID..."
          />
          <button class="btn-secondary" @click="s.fetchRecent()">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
          </button>
        </div>
        <span class="text-sm text-gray-500">{{ filteredByStatus.length }} registros</span>
      </div>

      <!-- Status tabs -->
      <div class="flex gap-2 mb-4">
        <button
            :class="tabClass(statusTab==='ESPERA')"
            @click="statusTab='ESPERA'"
        >En espera</button>
        <button
            :class="tabClass(statusTab==='CONSULTA')"
            @click="statusTab='CONSULTA'"
        >En consulta</button>
        <button
            :class="tabClass(statusTab==='ATENDIDO')"
            @click="statusTab='ATENDIDO'"
        >Atendido</button>
        <button
            :class="tabNoAtendidoClass(statusTab==='NO_ATENDIDO')"
            @click="statusTab='NO_ATENDIDO'"
        >No atendido</button>
      </div>

      <div class="card overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 border-b border-gray-100">
          <tr>
            <th class="th">Fecha / Hora</th>
            <th class="th">Expediente</th>
            <th class="th">Paciente</th>
            <th class="th">Motivo</th>
            <th class="th">Clasif.</th>
            <th class="th">Pago</th>
            <th class="th">Acciones</th>
          </tr>
          </thead>

          <tbody class="divide-y divide-gray-50">
          <tr v-for="r in filteredByStatus" :key="r.id" class="hover:bg-gray-100 transition-colors">
            <td class="td text-gray-500 text-xs whitespace-nowrap">{{ fmtMerida(r.triageAt) }}</td>
            <td class="td font-mono text-xs">{{ r.patient.expediente || "—" }}</td>
            <td class="td">
              <div class="font-semibold text-gray-800">{{ r.patient.fullName }}</div>
              <div class="text-xs text-gray-400 mt-0.5">
                {{ r.patient.age || "—" }} · {{ r.patient.sex ?? "—" }}
                <span v-if="r.patient.mayaHabla"> · Maya</span>
                <span v-if="r.patient.responsibleName"> · {{ r.patient.responsibleName }}</span>
              </div>
            </td>
            <td class="td">{{ r.motivoUrgencia }}</td>
            <td class="td">
              <span :class="badgeClass(r.classification)">{{ r.classification }}</span>
            </td>
            <td class="td">
              <span :class="payBadgeClass(r.paidStatus)">{{ payLabel(r.paidStatus) }}</span>
            </td>
            <td class="td">
              <button
                  class="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  :disabled="!canRevalue(r)"
                  @click="openRevalue(r)"
              >
                Revalorar
              </button>
            </td>
          </tr>

          <tr v-if="!filteredByStatus.length">
            <td colspan="7" class="py-12 text-center text-gray-400">
              <div class="flex flex-col items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                </svg>
                <span class="text-sm">Sin registros en esta categoría</span>
              </div>
            </td>
          </tr>
          </tbody>
        </table>
      </div>

      <!-- Panel Revaloración -->
      <div
          v-if="showRevalue"
          class="overlay-backdrop flex justify-end z-40"
          @click.self="showRevalue=false"
      >
        <div class="w-full max-w-xl h-full bg-white shadow-xl p-6 overflow-auto">
          <div class="flex items-start justify-between gap-4 mb-6">
            <div>
              <h2 class="text-lg font-bold text-gray-800">Revaloración</h2>
              <div class="flex items-center gap-2 mt-1">
                <span :class="badgeClass(reClassPreview)">{{ reClassPreview }}</span>
              </div>
            </div>
            <button class="btn-secondary" @click="showRevalue=false">Cerrar</button>
          </div>

          <div class="card p-5 mb-4">
            <p class="section-label">Semáforo</p>
            <div class="grid grid-cols-3 gap-3">
              <div v-for="(field, label) in { Apariencia: 'appearance', Respiración: 'respiration', Circulación: 'circulation' }" :key="label">
                <label class="block text-sm font-medium text-gray-700 mb-1.5">{{ label }}</label>
                <select v-model="(re as any)[field]" class="input-base">
                  <option value="VERDE">Verde</option>
                  <option value="AMARILLO">Amarillo</option>
                  <option value="ROJO">Rojo</option>
                </select>
              </div>
            </div>
          </div>

          <div class="card p-5 mb-4">
            <p class="section-label">Signos vitales</p>
            <div class="grid grid-cols-3 gap-3">
              <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">Peso (kg)</label>
                <input v-model.number="re.weightKg" type="number" step="0.001" min="0" :class="['input-base', reErrClass('weightKg')]" placeholder="0.000" />
                <p v-if="reErrors.weightKg" class="text-xs text-red-600 mt-1">{{ reErrors.weightKg }}</p>
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">Talla (cm)</label>
                <input v-model.number="re.heightCm" type="number" step="0.001" min="0" :class="['input-base', reErrClass('heightCm')]" placeholder="0.000" />
                <p v-if="reErrors.heightCm" class="text-xs text-red-600 mt-1">{{ reErrors.heightCm }}</p>
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">Temp (°C)</label>
                <input v-model.number="re.temperatureC" type="number" step="0.001" min="0" :class="['input-base', reErrClass('temperatureC')]" placeholder="36.500" />
                <p v-if="reErrors.temperatureC" class="text-xs text-red-600 mt-1">{{ reErrors.temperatureC }}</p>
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">F.C.</label>
                <input v-model.number="re.heartRate" type="number" step="0.001" min="0" :class="['input-base', reErrClass('heartRate')]" placeholder="lpm" />
                <p v-if="reErrors.heartRate" class="text-xs text-red-600 mt-1">{{ reErrors.heartRate }}</p>
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">F.R.</label>
                <input v-model.number="re.respiratoryRate" type="number" step="0.001" min="0" :class="['input-base', reErrClass('respiratoryRate')]" placeholder="rpm" />
                <p v-if="reErrors.respiratoryRate" class="text-xs text-red-600 mt-1">{{ reErrors.respiratoryRate }}</p>
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">T.A.</label>
                <input v-model="re.bloodPressure" class="input-base" placeholder="120/80" />
              </div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4 mb-6">
            <div class="card p-4">
              <p class="section-label">Atención previa</p>
              <label class="flex items-center gap-2 text-sm mb-2 cursor-pointer">
                <input type="checkbox" v-model="re.hadPriorCareSamePathology" class="rounded" />
                Sí, atención previa
              </label>
              <div v-if="re.hadPriorCareSamePathology">
                <input v-model="re.priorCarePlace" :class="['input-base', reErrClass('priorCarePlace')]" placeholder="Lugar *" />
                <p v-if="reErrors.priorCarePlace" class="text-xs text-red-600 mt-1">{{ reErrors.priorCarePlace }}</p>
              </div>
            </div>
            <div class="card p-4">
              <p class="section-label">Referencia</p>
              <label class="flex items-center gap-2 text-sm mb-2 cursor-pointer">
                <input type="checkbox" v-model="re.hasReferral" class="rounded" />
                Viene referido
              </label>
              <div v-if="re.hasReferral">
                <input v-model="re.referralPlace" :class="['input-base', reErrClass('referralPlace')]" placeholder="Lugar *" />
                <p v-if="reErrors.referralPlace" class="text-xs text-red-600 mt-1">{{ reErrors.referralPlace }}</p>
              </div>
            </div>
          </div>

          <div class="flex justify-end">
            <button class="btn-primary px-6 py-2.5" :disabled="s.saving" @click="submitRevalue">
              Guardar Revaloración
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
