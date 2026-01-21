<script setup lang="ts">
import { reactive, watch } from "vue";

const props = defineProps<{
  recordId: number;
  initial: any;
}>();

const emit = defineEmits<{
  (e: "save", payload: any): void;
}>();

const form = reactive({
  padecimientoActual: "",
  antecedentes: "",
  exploracionFisica: "",
  estudios: "",
  diagnostico: "",
  planTratamiento: "",
  pronostico: "",
  contraRefFollowUp: false,
  contraRefWhen: "",

  // vigilancia
  vigFiebre38: false,
  vigConvulsiones: false,
  vigAlteracionAlerta: false,
  vigSangradoActivo: false,
  vigDeshidratacion: false,
  vigVomitosFrecuentes: false,
  vigIrritabilidad: false,
  vigLlantoInconsolable: false,
  vigDificultadRespiratoria: false,
  vigChoque: false,
  vigDeterioroNeurologico: false,
});

watch(
    () => props.initial,
    (v) => Object.assign(form, v ?? {}),
    { immediate: true }
);

function save() {
  emit("save", { ...form });
}
</script>

<template>
  <div class="space-y-4">
    <div class="grid grid-cols-2 gap-4">
      <div class="space-y-2">
        <label class="text-sm font-medium">Padecimiento actual</label>
        <textarea v-model="form.padecimientoActual" class="w-full border rounded-xl p-3 min-h-[90px]" />
      </div>

      <div class="space-y-2">
        <label class="text-sm font-medium">Antecedentes</label>
        <textarea v-model="form.antecedentes" class="w-full border rounded-xl p-3 min-h-[90px]" />
      </div>

      <div class="space-y-2">
        <label class="text-sm font-medium">Exploración física</label>
        <textarea v-model="form.exploracionFisica" class="w-full border rounded-xl p-3 min-h-[90px]" />
      </div>

      <div class="space-y-2">
        <label class="text-sm font-medium">Estudios</label>
        <textarea v-model="form.estudios" class="w-full border rounded-xl p-3 min-h-[90px]" />
      </div>

      <div class="space-y-2">
        <label class="text-sm font-medium">Diagnóstico</label>
        <textarea v-model="form.diagnostico" class="w-full border rounded-xl p-3 min-h-[90px]" />
      </div>

      <div class="space-y-2">
        <label class="text-sm font-medium">Plan / Tratamiento</label>
        <textarea v-model="form.planTratamiento" class="w-full border rounded-xl p-3 min-h-[90px]" />
      </div>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div class="border rounded-xl p-4">
        <div class="font-semibold mb-2">Vigilancia estrecha</div>
        <div class="grid grid-cols-2 gap-2 text-sm">
          <label class="flex gap-2 items-center"><input type="checkbox" v-model="form.vigFiebre38" /> Fiebre > 38°C</label>
          <label class="flex gap-2 items-center"><input type="checkbox" v-model="form.vigConvulsiones" /> Convulsiones</label>
          <label class="flex gap-2 items-center"><input type="checkbox" v-model="form.vigAlteracionAlerta" /> Alteración alerta</label>
          <label class="flex gap-2 items-center"><input type="checkbox" v-model="form.vigSangradoActivo" /> Sangrado activo</label>
          <label class="flex gap-2 items-center"><input type="checkbox" v-model="form.vigDeshidratacion" /> Deshidratación</label>
          <label class="flex gap-2 items-center"><input type="checkbox" v-model="form.vigVomitosFrecuentes" /> Vómitos frecuentes</label>
          <label class="flex gap-2 items-center"><input type="checkbox" v-model="form.vigIrritabilidad" /> Irritabilidad</label>
          <label class="flex gap-2 items-center"><input type="checkbox" v-model="form.vigLlantoInconsolable" /> Llanto que no cede</label>
          <label class="flex gap-2 items-center"><input type="checkbox" v-model="form.vigDificultadRespiratoria" /> Dificultad respiratoria</label>
          <label class="flex gap-2 items-center"><input type="checkbox" v-model="form.vigChoque" /> Datos de choque</label>
          <label class="flex gap-2 items-center"><input type="checkbox" v-model="form.vigDeterioroNeurologico" /> Deterioro neurológico</label>
        </div>
      </div>

      <div class="border rounded-xl p-4 space-y-2">
        <div class="font-semibold">Contrarreferencia</div>
        <label class="flex gap-2 items-center text-sm">
          <input type="checkbox" v-model="form.contraRefFollowUp" />
          Solicitar seguimiento
        </label>
        <input v-model="form.contraRefWhen" placeholder="¿En cuánto tiempo?" class="w-full border rounded-xl p-2 text-sm" />

        <div class="font-semibold mt-3">Pronóstico</div>
        <textarea v-model="form.pronostico" class="w-full border rounded-xl p-3 min-h-[70px]" />
      </div>
    </div>

    <div class="flex justify-end">
      <button class="px-4 py-2 rounded-lg bg-blue-600 text-white" @click="save">Guardar Nota</button>
    </div>
  </div>
</template>
