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
  if (role === "ADMIN") return "bg-gray-900 text-white";
  if (role === "DOCTOR") return "bg-blue-600 text-white";
  if (role === "CASHIER") return "bg-emerald-600 text-white";
  if (role === "NURSE_TRIAGE") return "bg-purple-600 text-white";
  return "bg-gray-200 text-gray-900";
}

const roleOptions = computed(() => [
  { value: "", label: "Todos" },
  { value: "NURSE_TRIAGE", label: ROLE_LABEL.NURSE_TRIAGE },
  { value: "CASHIER", label: ROLE_LABEL.CASHIER },
  { value: "DOCTOR", label: ROLE_LABEL.DOCTOR },
  { value: "ADMIN", label: ROLE_LABEL.ADMIN },
  { value: "CONSULTOR", label: ROLE_LABEL.CONSULTOR },
]);

onMounted(() => s.fetch());
</script>

<template>
  <div class="p-6 max-w-7xl mx-auto">
    <div class="bg-white rounded-2xl shadow p-6">
      <div class="flex items-center justify-between gap-3 mb-4">
        <h1 class="text-2xl font-semibold">Usuarios</h1>

        <div class="flex gap-2">
          <button class="px-4 py-2 rounded-xl border" @click="s.fetch">Refrescar</button>
          <button class="px-4 py-2 rounded-xl bg-blue-600 text-white" @click="s.openCreate">
            Nuevo usuario
          </button>
        </div>
      </div>

      <!-- filtros -->
      <div class="grid grid-cols-12 gap-3 mb-5">
        <input
            v-model="s.q"
            class="col-span-6 border rounded-xl p-2"
            placeholder="Buscar por nombre o usuario..."
            @keyup.enter="s.fetch"
        />

        <select v-model="s.role" class="col-span-3 border rounded-xl p-2">
          <option v-for="o in roleOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>

        <button class="col-span-3 px-4 py-2 rounded-xl bg-emerald-600 text-white" @click="s.fetch">
          Aplicar
        </button>
      </div>

      <!-- tabla -->
      <div class="overflow-auto border rounded-2xl">
        <table class="w-full text-sm">
          <thead class="bg-gray-50">
          <tr class="text-left border-b">
            <th class="py-2 px-3">ID</th>
            <th class="py-2 px-3">Nombre</th>
            <th class="py-2 px-3">Usuario</th>
            <th class="py-2 px-3">Rol</th>
            <th class="py-2 px-3">Cédula</th>
            <th class="py-2 px-3">Acciones</th>
          </tr>
          </thead>

          <tbody>
          <tr v-for="u in s.rows" :key="u.id" class="border-b">
            <td class="py-2 px-3">{{ u.id }}</td>
            <td class="py-2 px-3">{{ u.name }}</td>
            <td class="py-2 px-3">{{ u.email }}</td>
            <td class="py-2 px-3">
                <span class="text-xs px-2 py-1 rounded-full" :class="roleBadge(u.role)">
                  {{ ROLE_LABEL[u.role] || u.role }}
                </span>
            </td>
            <td class="py-2 px-3">{{ u.cedula || "-" }}</td>
            <td class="py-2 px-3">
              <div class="flex gap-2">
                <button class="px-3 py-1 rounded-xl border text-xs" @click="s.openEdit(u)">Editar</button>
                <button class="px-3 py-1 rounded-xl border text-xs text-rose-700" @click="s.remove(u.id)">Eliminar</button>
              </div>
            </td>
          </tr>

          <tr v-if="!s.rows.length">
            <td colspan="6" class="py-8 text-center text-gray-500">Sin usuarios</td>
          </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- modal create/edit -->
    <div v-if="s.modalOpen" class="fixed inset-0 bg-black/40 flex items-center justify-center p-4" @click.self="s.modalOpen=false">
      <div class="w-full max-w-xl bg-white rounded-2xl shadow p-6">
        <div class="flex items-start justify-between gap-3 mb-4">
          <div>
            <div class="text-lg font-semibold">
              {{ s.mode === 'create' ? 'Crear usuario' : 'Editar usuario' }}
            </div>
            <div class="text-sm text-gray-500">
              {{ s.mode === 'create' ? 'Se generará acceso al sistema' : 'Actualiza datos y/o contraseña' }}
            </div>
          </div>
          <button class="px-3 py-2 rounded-xl border text-sm" @click="s.modalOpen=false">Cerrar</button>
        </div>

        <div class="space-y-3">
          <div>
            <label class="text-sm font-medium">Nombre</label>
            <input v-model="s.form.name" class="w-full border rounded-xl p-2" />
          </div>

          <div>
            <label class="text-sm font-medium">Usuario</label>
            <input v-model="s.form.email" class="w-full border rounded-xl p-2" placeholder="correo@dominio.com" />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-sm font-medium">Rol</label>
              <select v-model="s.form.role" class="w-full border rounded-xl p-2">
                <option value="NURSE_TRIAGE">Enfermería (Triage)</option>
                <option value="CASHIER">Caja</option>
                <option value="DOCTOR">Médico</option>
                <option value="ADMIN">Administrador</option>
                <option value="CONSULTOR">Consultor</option>
              </select>
            </div>

            <div>
              <label class="text-sm font-medium">Cédula (solo médico)</label>
              <input v-model="s.form.cedula" class="w-full border rounded-xl p-2" />
            </div>
          </div>

          <div>
            <label class="text-sm font-medium">
              {{ s.mode === "create" ? "Contraseña" : "Nueva contraseña (opcional)" }}
            </label>
            <input v-model="s.form.password" type="password" class="w-full border rounded-xl p-2" />
          </div>

          <div class="flex justify-end gap-2 pt-2">
            <button class="px-4 py-2 rounded-xl border" @click="s.modalOpen=false">Cancelar</button>
            <button class="px-4 py-2 rounded-xl bg-blue-600 text-white disabled:opacity-50" :disabled="s.saving" @click="s.save">
              Guardar
            </button>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>
