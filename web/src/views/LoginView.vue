<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useAuthStore } from "../stores/auth";
import { useRouter } from "vue-router";
import { primeSpeech } from "../services/speechAlert";
import { homeByRole } from "../utils/roleHome";
import type { AxiosError } from "axios";

// Tipado de la respuesta 401 del backend
interface LoginErrorBody {
  error?: string;
  attemptsRemaining?: number;
  maxAttempts?: number;
}

const auth = useAuthStore();
const router = useRouter();

const email = ref("");
const password = ref("");
const loading = ref(false);
const errorMsg = ref("");
// Intentos restantes que devuelve el backend en la respuesta 401
const attemptsRemaining = ref<number | null>(null);

// Banner de cuenta desactivada que puede llegar desde el evento socket auth:disabled
// o desde el interceptor 403 del api. Se consume aquí y se limpia para no persistir.
const banner = ref("");

onMounted(() => {
  if (auth.loginBanner) {
    banner.value = auth.loginBanner;
    auth.loginBanner = "";
  }
});

async function submit() {
  errorMsg.value = "";
  attemptsRemaining.value = null;
  banner.value = "";
  loading.value = true;
  // Pre-calienta el motor TTS aprovechando el user gesture del click.
  // Sin esto, el primer "Nuevo paciente en espera" tarda 300-1000ms en sonar.
  primeSpeech();
  try {
    await auth.login(email.value, password.value);
    // El guard del router se encarga del fork: si mustChangePassword=true irá a
    // /cambiar-password aunque aquí empujemos al home del rol.
    router.push(homeByRole(auth.user?.role));
  } catch (err) {
    const axErr = err as AxiosError<LoginErrorBody>;
    const status = axErr.response?.status;
    const body = axErr.response?.data;

    if (status === 404) {
      errorMsg.value = "El usuario ingresado no existe";
    } else if (status === 401) {
      errorMsg.value = body?.error ?? "La contraseña ingresada es incorrecta";
      // Mostrar contador si el backend lo incluye y quedan intentos
      if (typeof body?.attemptsRemaining === "number" && body.attemptsRemaining > 0) {
        attemptsRemaining.value = body.attemptsRemaining;
      }
    } else if (status === 403) {
      errorMsg.value =
        "Usuario desactivado, comunícate con el área de tecnologías de la información";
    } else if (body?.error) {
      errorMsg.value = body.error;
    } else {
      errorMsg.value = "Ocurrió un error inesperado. Intenta de nuevo.";
    }
  } finally {
    loading.value = false;
  }
}

// Limpiar el contador cuando el usuario modifica la contraseña
function onPasswordInput() {
  attemptsRemaining.value = null;
}
</script>

<template>
  <div class="login-page">
    <!-- Blobs decorativos -->
    <div class="login-blob login-blob-tl"></div>
    <div class="login-blob login-blob-br"></div>

    <div class="login-wrapper">
      <!-- Icono + título arriba de la card -->
      <div class="login-header">
        <div class="login-logo">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" class="w-8 h-8">
            <path d="M9 3h6v6h6v6h-6v6H9v-6H3v-6h6z"/>
          </svg>
        </div>
        <h1 class="login-title">SISTEMA TRIAGE</h1>
        <p class="login-subtitle">Accede con tu usuario institucional</p>
      </div>

      <!-- Card -->
      <div class="login-card">
        <h2 class="login-card-heading">Iniciar sesion</h2>
        <p class="login-card-sub">Ingresa tus credenciales para continuar</p>

        <!-- Banner de cuenta desactivada (viene de evento socket o cierre por admin) -->
        <div
          v-if="banner"
          class="mb-4 rounded-lg bg-amber-50 border border-amber-300 px-4 py-3 text-sm text-amber-800 flex items-start gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 mt-0.5 shrink-0 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
          <span>{{ banner }}</span>
        </div>

        <!-- Error de login -->
        <div v-if="errorMsg" class="login-error">
          {{ errorMsg }}
        </div>

        <!-- Contador de intentos restantes (solo en error 401 con intentos > 0) -->
        <div
          v-if="attemptsRemaining !== null"
          class="mb-4 rounded-lg bg-amber-50 border border-amber-300 px-4 py-2.5 text-sm text-amber-800 flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
          <span>
            Te {{ attemptsRemaining === 1 ? "queda" : "quedan" }}
            <strong>{{ attemptsRemaining }} {{ attemptsRemaining === 1 ? "intento" : "intentos" }}</strong>
            antes de que tu cuenta sea bloqueada.
          </span>
        </div>

        <div class="login-fields">
          <!-- Email -->
          <div>
            <label class="login-label">Usuario</label>
            <div class="login-input-wrap">
              <span class="login-input-icon">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                </svg>
              </span>
              <input
                v-model="email"
                type="email"
                class="login-input"
                placeholder="Usuario"
                @keyup.enter="submit"
              />
            </div>
          </div>

          <!-- Password -->
          <div>
            <label class="login-label">Contraseña</label>
            <div class="login-input-wrap">
              <span class="login-input-icon">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                </svg>
              </span>
              <input
                v-model="password"
                type="password"
                class="login-input"
                placeholder="••••••••"
                @input="onPasswordInput"
                @keyup.enter="submit"
              />
            </div>
          </div>

          <!-- Botón -->
          <button
            class="login-btn"
            :disabled="loading"
            @click="submit"
          >
            <span v-if="loading" class="login-btn-loading">
              <svg class="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Verificando...
            </span>
            <span v-else>Entrar</span>
          </button>
        </div>

        <p class="login-hint">
          Si tienes problemas para acceder, valida tu usuario con el administrador del sistema.
        </p>
      </div>

      <p class="login-footer">Hospital de la Amistad &bull; Sistema de Triage</p>
    </div>
  </div>
</template>
