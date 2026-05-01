<script setup lang="ts">
import { ref, computed } from "vue";
import { useAuthStore } from "../stores/auth";
import { useRouter } from "vue-router";
import { passwordChecks, isPasswordValid } from "../utils/passwordPolicy";
import { homeByRole } from "../utils/roleHome";
import type { AxiosError } from "axios";

const auth = useAuthStore();
const router = useRouter();

const currentPassword = ref("");
const newPassword = ref("");
const confirmPassword = ref("");
const loading = ref(false);
const successMsg = ref("");
const errorMsg = ref("");
const errorDetails = ref<string[]>([]);

// Checks reactivos de la nueva contraseña
const checks = computed(() => passwordChecks(newPassword.value));

// Check adicional: coincidencia de confirmación
const passwordsMatch = computed(
  () => newPassword.value.length > 0 && newPassword.value === confirmPassword.value
);

// El botón solo se habilita cuando todo es válido
const canSubmit = computed(
  () =>
    currentPassword.value.length > 0 &&
    isPasswordValid(newPassword.value) &&
    passwordsMatch.value &&
    !loading.value
);

async function submit() {
  if (!canSubmit.value) return;

  loading.value = true;
  errorMsg.value = "";
  errorDetails.value = [];
  successMsg.value = "";

  try {
    await auth.changePassword({
      currentPassword: currentPassword.value,
      newPassword: newPassword.value,
      confirmPassword: confirmPassword.value,
    });

    successMsg.value = "Contraseña actualizada correctamente.";

    // Redirigir al home del rol después de 1.2 s para que el usuario vea el mensaje
    setTimeout(() => {
      router.push(homeByRole(auth.user?.role));
    }, 1200);
  } catch (err) {
    const axErr = err as AxiosError<{ error?: string; details?: string[] }>;
    const body = axErr.response?.data;

    if (body?.details && body.details.length > 0) {
      errorDetails.value = body.details;
    } else if (body?.error) {
      errorMsg.value = body.error;
    } else {
      errorMsg.value = "Ocurrió un error al actualizar la contraseña. Intenta de nuevo.";
    }
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-page">
    <!-- Blobs decorativos (misma paleta que LoginView) -->
    <div class="login-blob login-blob-tl"></div>
    <div class="login-blob login-blob-br"></div>

    <div class="login-wrapper">
      <!-- Cabecera -->
      <div class="login-header">
        <div class="login-logo">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" class="w-8 h-8">
            <path d="M9 3h6v6h6v6h-6v6H9v-6H3v-6h6z"/>
          </svg>
        </div>
        <h1 class="login-title">SISTEMA TRIAGE</h1>
        <p class="login-subtitle">Actualiza tu contraseña para continuar</p>
      </div>

      <!-- Card -->
      <div class="login-card">
        <h2 class="login-card-heading">Cambiar contraseña</h2>
        <p class="login-card-sub">
          {{ auth.user?.mustChangePassword
            ? "Tu cuenta requiere establecer una nueva contraseña antes de continuar."
            : "Establece una nueva contraseña para tu cuenta." }}
        </p>

        <!-- Banner de éxito -->
        <div
          v-if="successMsg"
          class="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
          </svg>
          {{ successMsg }}
        </div>

        <!-- Banner de error general -->
        <div v-if="errorMsg" class="login-error">
          {{ errorMsg }}
        </div>

        <!-- Lista de errores de política del backend -->
        <div
          v-if="errorDetails.length > 0"
          class="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
        >
          <p class="font-semibold mb-1">Corrige los siguientes problemas:</p>
          <ul class="list-disc list-inside space-y-0.5">
            <li v-for="d in errorDetails" :key="d">{{ d }}</li>
          </ul>
        </div>

        <div class="login-fields">
          <!-- Contraseña actual -->
          <div>
            <label class="login-label">Contraseña actual</label>
            <div class="login-input-wrap">
              <span class="login-input-icon">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                </svg>
              </span>
              <input
                v-model="currentPassword"
                type="password"
                class="login-input"
                placeholder="Tu contraseña actual"
                autocomplete="current-password"
                @keyup.enter="submit"
              />
            </div>
          </div>

          <!-- Nueva contraseña -->
          <div>
            <label class="login-label">Nueva contraseña</label>
            <div class="login-input-wrap">
              <span class="login-input-icon">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
                </svg>
              </span>
              <input
                v-model="newPassword"
                type="password"
                class="login-input"
                placeholder="Nueva contraseña"
                autocomplete="new-password"
                @keyup.enter="submit"
              />
            </div>

            <!-- Checks de política en vivo -->
            <ul class="mt-2.5 space-y-1.5">
              <li
                v-for="check in checks"
                :key="check.id"
                class="flex items-center gap-2 text-xs transition-colors"
                :class="check.ok ? 'text-green-700' : 'text-gray-400'"
              >
                <!-- Icono check verde vs circulo outline gris -->
                <svg
                  v-if="check.ok"
                  xmlns="http://www.w3.org/2000/svg"
                  class="w-3.5 h-3.5 text-green-600 shrink-0"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                </svg>
                <svg
                  v-else
                  xmlns="http://www.w3.org/2000/svg"
                  class="w-3.5 h-3.5 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <circle cx="12" cy="12" r="9"/>
                </svg>
                {{ check.label }}
              </li>
            </ul>
          </div>

          <!-- Confirmar nueva contraseña -->
          <div>
            <label class="login-label">Confirmar nueva contraseña</label>
            <div class="login-input-wrap">
              <span class="login-input-icon">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                </svg>
              </span>
              <input
                v-model="confirmPassword"
                type="password"
                class="login-input"
                :class="confirmPassword.length > 0 && !passwordsMatch ? 'border-red-400 ring-1 ring-red-300' : ''"
                placeholder="Repite la nueva contraseña"
                autocomplete="new-password"
                @keyup.enter="submit"
              />
            </div>
            <!-- Indicador de coincidencia -->
            <p
              v-if="confirmPassword.length > 0"
              class="mt-1.5 text-xs flex items-center gap-1.5"
              :class="passwordsMatch ? 'text-green-700' : 'text-red-500'"
            >
              <svg v-if="passwordsMatch" xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
              </svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
              {{ passwordsMatch ? "Las contraseñas coinciden" : "Las contraseñas no coinciden" }}
            </p>
          </div>

          <!-- Botón -->
          <button
            class="login-btn"
            :disabled="!canSubmit"
            @click="submit"
          >
            <span v-if="loading" class="login-btn-loading">
              <svg class="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Guardando...
            </span>
            <span v-else>Guardar contraseña</span>
          </button>
        </div>

        <p class="login-hint">
          Si tienes problemas, contacta al administrador del sistema.
        </p>
      </div>

      <p class="login-footer">Hospital de la Amistad &bull; Sistema de Triage</p>
    </div>
  </div>
</template>
