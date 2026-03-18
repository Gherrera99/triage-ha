<script setup lang="ts">
//web/src/App.vue
import { computed, onMounted, watch } from "vue";
import { useRouter, RouterView, RouterLink, useRoute } from "vue-router";
import { useAuthStore } from "./stores/auth";
import { useSocket } from "./composables/useSocket";
import DoctorAlertOverlay from "./components/DoctorAlertOverlay.vue";


const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const { connect, disconnect } = useSocket();

const isLogin = computed(() => route.path === "/login");

const ROLE_LABEL: Record<string, string> = {
  NURSE_TRIAGE: "Enfermería",
  CASHIER: "Caja",
  DOCTOR: "Médico",
  ADMIN: "Administrador",
  CONSULTOR: "Consultor",
};

onMounted(() => {
  auth.init();
  if (auth.token) connect();
});

watch(
    () => auth.token,
    (t) => {
      if (t) connect();
      else disconnect();
    },
    { immediate: true }
);

const user = computed(() => auth.user);
const role = computed(() => auth.user?.role ?? null);

const menu = computed(() => {
  if (!role.value) return [];
  if (role.value === "NURSE_TRIAGE") return [{ to: "/triage", label: "Triage" }];
  if (role.value === "CASHIER") return [{ to: "/cashier", label: "Caja" }];
  if (role.value === "DOCTOR") return [{ to: "/doctor", label: "Urgencias" }];
  if (role.value === "ADMIN") {
    return [
      { to: "/triage", label: "Triage" },
      { to: "/cashier", label: "Caja" },
      { to: "/doctor", label: "Urgencias" },
      { to: "/admin", label: "Reportes" },
      { to: "/admin/users", label: "Usuarios" },
    ];
  }
  if (role.value === "CONSULTOR") {
    return [{ to: "/admin", label: "Reportes" }];
  }
  return [];
});

function logout() {
  disconnect();
  auth.logout();
  router.push("/login");
}

function userInitial(name: string) {
  return name ? name.charAt(0).toUpperCase() : "?";
}
</script>

<template>
  <!-- Login: sin navbar, sin contenedor -->
  <div v-if="isLogin" class="h-screen w-screen overflow-hidden">
    <RouterView />
  </div>

  <!-- App normal con navbar -->
  <div v-else class="min-h-screen bg-slate-50">
    <header class="bg-gradient-to-r from-blue-700 to-blue-800 shadow-lg sticky top-0 z-30">
      <div class="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
        <div class="flex items-center gap-6">
          <div class="flex items-center gap-2.5">
            <div class="nav-icon-wrap">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" class="w-5 h-5">
                <path d="M9 3h6v6h6v6h-6v6H9v-6H3v-6h6z"/>
              </svg>
            </div>
            <span class="font-bold text-white text-lg tracking-wide">Sistema Triage</span>
          </div>

          <nav v-if="menu.length" class="flex items-center gap-1">
            <RouterLink
                v-for="item in menu"
                :key="item.to"
                :to="item.to"
                class="nav-link"
                active-class="nav-link-active"
            >
              {{ item.label }}
            </RouterLink>
          </nav>
        </div>

        <div class="flex items-center gap-3" v-if="user">
          <div class="text-right leading-tight hidden sm:block">
            <div class="text-sm font-medium text-white">{{ user.name }}</div>
            <div class="text-xs text-blue-200">
              {{ ROLE_LABEL[user.role] || user.role }}
              <span v-if="user.cedula"> · Cedula: {{ user.cedula }}</span>
            </div>
          </div>
          <div class="nav-avatar">{{ userInitial(user.name) }}</div>
          <button class="nav-logout" @click="logout">Salir</button>
        </div>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-0">
      <RouterView />
    </main>

    <DoctorAlertOverlay v-if="role === 'DOCTOR'" />
  </div>
</template>
