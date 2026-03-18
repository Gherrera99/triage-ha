<script setup lang="ts">
import { ref } from "vue";
import { useAuthStore } from "../stores/auth";
import { useRouter } from "vue-router";

const auth = useAuthStore();
const router = useRouter();

const email = ref("");
const password = ref("");
const loading = ref(false);
const errorMsg = ref("");

function homeByRole(role?: string) {
  switch (role) {
    case "NURSE_TRIAGE": return "/triage";
    case "CASHIER": return "/cashier";
    case "DOCTOR": return "/doctor";
    case "ADMIN": return "/admin/reports";
    case "CONSULTOR": return "/admin/reports";
    default: return "/login";
  }
}

async function submit() {
  errorMsg.value = "";
  loading.value = true;
  try {
    await auth.login(email.value, password.value);
    router.push(homeByRole(auth.user?.role));
  } catch {
    errorMsg.value = "Credenciales incorrectas. Verifica tu usuario y contrasena.";
  } finally {
    loading.value = false;
  }
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

        <!-- Error -->
        <div v-if="errorMsg" class="login-error">
          {{ errorMsg }}
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
