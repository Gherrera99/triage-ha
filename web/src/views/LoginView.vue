<script setup lang="ts">
import { ref } from "vue";
import { useAuthStore } from "../stores/auth";
import { useRouter } from "vue-router";

const auth = useAuthStore();
const router = useRouter();

const email = ref("admin@hospital.local");
const password = ref("Admin123*");
const loading = ref(false);

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
  try {
    await auth.login(email.value, password.value);
    router.push(homeByRole(auth.user?.role));
  } catch (e: any) {
    alert("Error login");
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 p-6">
    <div class="bg-white w-full max-w-md rounded-2xl shadow p-6">
      <h1 class="text-2xl font-semibold mb-4">Sistema Triage</h1>

      <div class="space-y-3">
        <input v-model="email" class="w-full border rounded-xl p-3" placeholder="Email" />
        <input v-model="password" type="password" class="w-full border rounded-xl p-3" placeholder="Password" />

        <button
            class="w-full bg-blue-600 text-white rounded-xl p-3 disabled:opacity-50"
            :disabled="loading"
            @click="submit"
        >
          Entrar
        </button>
      </div>

      <p class="text-xs text-gray-500 mt-4">
        Usuarios seed: admin / triage / caja / doctor (password: Admin123*)
      </p>
    </div>
  </div>
</template>
