<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useAdminUsersStore, type Role } from "../stores/adminUsers";

const s = useAdminUsersStore();

const ROLE_LABEL: Record<Role, string> = {
  NURSE_TRIAGE: "Enfermería (Triage)",
  CASHIER: "Caja",
  DOCTOR: "Médico",
  ADMIN: "Administrador",
  CONSULTOR: "Consultor",
};

function roleBadge(role: Role) {
  if (role === "ADMIN") return "bg-gray-800 text-white";
  if (role === "DOCTOR") return "bg-blue-600 text-white";
  if (role === "CASHIER") return "bg-emerald-600 text-white";
  if (role === "NURSE_TRIAGE") return "bg-purple-600 text-white";
  return "bg-gray-200 text-gray-700";
}

function roleIcon(role: Role) {
  if (role === "ADMIN") return "⚙";
  if (role === "DOCTOR") return "👨‍⚕️";
  if (role === "CASHIER") return "💳";
  if (role === "NURSE_TRIAGE") return "🩺";
  return "👤";
}

function avatarClass(role: Role) {
  return "w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 " + roleBadge(role);
}

function rolePillClass(role: Role) {
  return "text-xs px-2.5 py-0.5 rounded-full font-semibold " + roleBadge(role);
}

const roleOptions = computed(() => [
  { value: "", label: "Todos los roles" },
  { value: "NURSE_TRIAGE", label: ROLE_LABEL.NURSE_TRIAGE },
  { value: "CASHIER", label: ROLE_LABEL.CASHIER },
  { value: "DOCTOR", label: ROLE_LABEL.DOCTOR },
  { value: "ADMIN", label: ROLE_LABEL.ADMIN },
  { value: "CONSULTOR", label: ROLE_LABEL.CONSULTOR },
]);

onMounted(() => s.fetch());
</script>

<template>
  <div class="p-6">
    <!-- Page header -->
    <div class="mb-6 flex items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2 mb-1">
          <div class="w-2.5 h-2.5 rounded-full bg-gray-600"></div>
          <span class="text-xs font-semibold uppercase tracking-wider text-gray-600">Administrador</span>
        </div>
        <h1 class="text-2xl font-bold text-gray-800">Gestión de Usuarios</h1>
        <p class="text-sm text-gray-500 mt-0.5">Administra las cuentas de acceso al sistema</p>
      </div>

      <div class="flex gap-2">
        <button class="btn-secondary flex items-center gap-2" @click="s.fetch">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
          Refrescar
        </button>
        <button class="btn-primary flex items-center gap-2" @click="s.openCreate">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
          </svg>
          Nuevo usuario
        </button>
      </div>
    </div>

    <!-- Filtros -->
    <div class="card p-4 mb-5">
      <div class="grid grid-cols-12 gap-3">
        <input
            v-model="s.q"
            class="input-base col-span-6"
            placeholder="Buscar por nombre o correo electrónico..."
            @keyup.enter="s.fetch"
        />
        <select v-model="s.role" class="input-base col-span-3">
          <option v-for="o in roleOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
        <button class="col-span-3 btn-primary" @click="s.fetch">Aplicar filtros</button>
      </div>
    </div>

    <!-- Tabla -->
    <div class="card overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-gray-50 border-b border-gray-100">
        <tr>
          <th class="th">Nombre</th>
          <th class="th">Correo electrónico</th>
          <th class="th">Rol</th>
          <th class="th">Cédula</th>
          <th class="th">Acciones</th>
        </tr>
        </thead>

        <tbody class="divide-y divide-gray-50">
        <tr v-for="u in s.rows" :key="u.id" class="hover:bg-gray-100 transition-colors">
          <td class="td">
            <div class="flex items-center gap-2.5">
              <div :class="avatarClass(u.role)">
                {{ u.name.charAt(0).toUpperCase() }}
              </div>
              <span class="font-semibold text-gray-800">{{ u.name }}</span>
            </div>
          </td>

          <td class="td text-gray-500">{{ u.email }}</td>

          <td class="td">
            <span :class="rolePillClass(u.role)">
              {{ ROLE_LABEL[u.role] || u.role }}
            </span>
          </td>

          <td class="td font-mono text-xs text-gray-500">{{ u.cedula || "—" }}</td>

          <td class="td">
            <div class="flex gap-2">
              <button
                  class="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium hover:bg-gray-50 transition-colors"
                  @click="s.openEdit(u)"
              >Editar</button>
              <button
                  class="px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs font-medium hover:bg-red-100 transition-colors"
                  @click="s.remove(u.id)"
              >Eliminar</button>
            </div>
          </td>
        </tr>

        <tr v-if="!s.rows.length">
          <td colspan="5" class="py-12 text-center text-gray-400">
            <div class="flex flex-col items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
              <span class="text-sm">Sin usuarios registrados</span>
            </div>
          </td>
        </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal crear/editar -->
    <div
        v-if="s.modalOpen"
        class="overlay-backdrop flex items-center justify-center p-4 z-40"
        @click.self="s.modalOpen=false"
    >
      <div class="w-full max-w-xl card shadow-2xl overflow-hidden">
        <div class="bg-gray-50 border-b px-6 py-4 flex items-start justify-between gap-3">
          <div>
            <h2 class="font-bold text-gray-800">
              {{ s.mode === 'create' ? 'Crear usuario' : 'Editar usuario' }}
            </h2>
            <p class="text-sm text-gray-500">
              {{ s.mode === 'create' ? 'Se generará acceso al sistema' : 'Actualiza datos y/o contraseña' }}
            </p>
          </div>
          <button class="btn-secondary text-xs py-1.5" @click="s.modalOpen=false">Cerrar</button>
        </div>

        <div class="p-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Nombre completo</label>
            <input v-model="s.form.name" class="input-base" placeholder="Ej. Dr. Juan Pérez" />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Correo electrónico</label>
            <input v-model="s.form.email" class="input-base" placeholder="correo@hospital.com" type="email" />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Rol</label>
              <select v-model="s.form.role" class="input-base">
                <option value="NURSE_TRIAGE">Enfermería (Triage)</option>
                <option value="CASHIER">Caja</option>
                <option value="DOCTOR">Médico</option>
                <option value="ADMIN">Administrador</option>
                <option value="CONSULTOR">Consultor</option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Cédula <span class="text-gray-400 font-normal">(solo médico)</span></label>
              <input v-model="s.form.cedula" class="input-base" placeholder="Número de cédula" />
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">
              {{ s.mode === "create" ? "Contraseña" : "Nueva contraseña (dejar vacío para no cambiar)" }}
            </label>
            <input v-model="s.form.password" type="password" class="input-base" placeholder="••••••••" />
          </div>

          <div class="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <button class="btn-secondary" @click="s.modalOpen=false">Cancelar</button>
            <button class="btn-primary disabled:opacity-50" :disabled="s.saving" @click="s.save">
              {{ s.mode === 'create' ? 'Crear usuario' : 'Guardar cambios' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
