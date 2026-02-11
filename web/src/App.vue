<script setup lang="ts">
//web/src/App.vue
import { computed, onMounted, watch } from "vue";
import { useRouter, RouterView, RouterLink } from "vue-router";
import { useAuthStore } from "./stores/auth";
import { useSocket } from "./composables/useSocket";
import DoctorAlertOverlay from "./components/DoctorAlertOverlay.vue";


const auth = useAuthStore();
const router = useRouter();
const { connect, disconnect } = useSocket();

onMounted(() => {
  auth.init();
  if (auth.token) connect();
});

// opcional: si haces login y token cambia, conecta socket automáticamente
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
  if (role.value === "ADMIN" || role.value === "CONSULTOR") {
    return [
      { to: "/admin/reports", label: "Reportes" },
      ...(role.value === "ADMIN" ? [{ to: "/admin/users", label: "Usuarios" }] : []),
    ];
  }
  return [];
});

function logout() {
  disconnect();
  auth.logout();
  router.push("/login");
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <header class="bg-white border-b">
      <div class="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div class="flex items-center gap-4">
          <div class="font-semibold text-lg">Sistema Triage</div>

          <nav v-if="menu.length" class="flex items-center gap-2">
            <RouterLink
                v-for="item in menu"
                :key="item.to"
                :to="item.to"
                class="px-3 py-2 rounded-xl text-sm hover:bg-gray-100"
                active-class="bg-blue-50 text-blue-700"
            >
              {{ item.label }}
            </RouterLink>
          </nav>
        </div>

        <div class="flex items-center gap-3" v-if="user">
          <div class="text-right leading-tight">
            <div class="text-sm font-medium">{{ user.name }}</div>
            <div class="text-xs text-gray-500">
              {{ user.role }}
              <span v-if="user.cedula">· Cédula: {{ user.cedula }}</span>
            </div>
          </div>

          <button class="px-3 py-2 rounded-xl border text-sm hover:bg-gray-50" @click="logout">
            Salir
          </button>
        </div>
      </div>
    </header>

    <main class="max-w-7xl mx-auto">
      <RouterView />
    </main>

    <DoctorAlertOverlay v-if="role === 'DOCTOR'" />

  </div>
</template>
