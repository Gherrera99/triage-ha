<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";
import { useAdminUsersStore, type Role, type UserRow } from "../stores/adminUsers";
import { useSocket } from "../composables/useSocket";

const s = useAdminUsersStore();
const { connect } = useSocket();

// ── Paginación ──────────────────────────────────────────────────────────────
const PAGE_SIZE = 20;
const currentPage = ref(1);

// ── Filtros client-side adicionales ─────────────────────────────────────────
const filterConnected = ref<"" | "online" | "offline">("");
const filterActive = ref<"" | "active" | "inactive">("");

const ROLE_LABEL: Record<Role, string> = {
  NURSE_TRIAGE: "Enfermería",
  CASHIER: "Caja",
  DOCTOR: "Médico",
  ADMIN: "Administrador",
  CONSULTOR: "Consultor",
};

// Etiqueta legible de la razón de desactivación que llega del backend
function deactivatedReasonLabel(reason: string | null): string {
  if (!reason) return "Desactivado por administrador";
  if (reason === "INTENTOS_FALLIDOS") return "Bloqueo automático por intentos fallidos";
  if (reason === "MANUAL" || reason === "BAJA_PERSONAL") return "Desactivado por administrador";
  return reason;
}

function roleBadge(role: Role): string {
  if (role === "ADMIN") return "bg-gray-800 text-white";
  if (role === "DOCTOR") return "bg-blue-600 text-white";
  if (role === "CASHIER") return "bg-emerald-600 text-white";
  if (role === "NURSE_TRIAGE") return "bg-purple-600 text-white";
  return "bg-gray-200 text-gray-700";
}

function avatarClass(role: Role): string {
  return "w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 " + roleBadge(role);
}

function rolePillClass(role: Role): string {
  return "inline-block whitespace-nowrap text-xs px-2.5 py-0.5 rounded-full font-semibold " + roleBadge(role);
}

const roleOptions = computed(() => [
  { value: "", label: "Todos los roles" },
  { value: "NURSE_TRIAGE", label: ROLE_LABEL.NURSE_TRIAGE },
  { value: "CASHIER", label: ROLE_LABEL.CASHIER },
  { value: "DOCTOR", label: ROLE_LABEL.DOCTOR },
  { value: "ADMIN", label: ROLE_LABEL.ADMIN },
  { value: "CONSULTOR", label: ROLE_LABEL.CONSULTOR },
]);

function isConnected(user: UserRow): boolean {
  return s.connectedUserIds.has(user.id);
}

// Lista filtrada client-side (sobre los rows ya traídos del backend)
const filteredRows = computed(() => {
  let list = s.rows;

  if (filterConnected.value === "online") {
    list = list.filter((u) => s.connectedUserIds.has(u.id));
  } else if (filterConnected.value === "offline") {
    list = list.filter((u) => !s.connectedUserIds.has(u.id));
  }

  if (filterActive.value === "active") {
    list = list.filter((u) => u.active);
  } else if (filterActive.value === "inactive") {
    list = list.filter((u) => !u.active);
  }

  return list;
});

const totalPages = computed(() => Math.max(1, Math.ceil(filteredRows.value.length / PAGE_SIZE)));

const pagedRows = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE;
  return filteredRows.value.slice(start, start + PAGE_SIZE);
});

// Texto informativo "Mostrando A-B de N"
const rangeLabel = computed(() => {
  const total = filteredRows.value.length;
  if (total === 0) return "Sin resultados";
  const start = (currentPage.value - 1) * PAGE_SIZE + 1;
  const end = Math.min(currentPage.value * PAGE_SIZE, total);
  return `Mostrando ${start}–${end} de ${total}`;
});

// Resetear página cuando cambian los filtros client-side o el backend recarga
watch(
  [filterConnected, filterActive, () => s.rows],
  () => { currentPage.value = 1; }
);

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function prevPage() {
  if (currentPage.value > 1) {
    currentPage.value--;
    scrollToTop();
  }
}

function nextPage() {
  if (currentPage.value < totalPages.value) {
    currentPage.value++;
    scrollToTop();
  }
}

function firstPage() {
  if (currentPage.value !== 1) {
    currentPage.value = 1;
    scrollToTop();
  }
}

function lastPage() {
  if (currentPage.value !== totalPages.value) {
    currentPage.value = totalPages.value;
    scrollToTop();
  }
}

// Al aplicar filtros de servidor también reseteamos página
function applyFilters() {
  currentPage.value = 1;
  s.fetch();
}

onMounted(() => {
  s.fetch();
  // Asegurar que el socket esté conectado y suscribir presencia
  connect();
  s.subscribePresence();
});

onBeforeUnmount(() => {
  s.unsubscribePresence();
});
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
        <!-- Búsqueda por nombre/usuario (server-side) -->
        <input
          v-model="s.q"
          class="input-base col-span-12 sm:col-span-5"
          placeholder="Buscar por nombre o usuario..."
          @keyup.enter="applyFilters"
        />
        <!-- Filtro rol (server-side) -->
        <select v-model="s.role" class="input-base col-span-6 sm:col-span-2">
          <option v-for="o in roleOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
        <!-- Filtro conectado (client-side) -->
        <select v-model="filterConnected" class="input-base col-span-6 sm:col-span-2">
          <option value="">Conectado: Todos</option>
          <option value="online">En línea</option>
          <option value="offline">Desconectado</option>
        </select>
        <!-- Filtro estado (client-side) -->
        <select v-model="filterActive" class="input-base col-span-6 sm:col-span-2">
          <option value="">Estado: Todos</option>
          <option value="active">Activo</option>
          <option value="inactive">Desactivado</option>
        </select>
        <button class="col-span-6 sm:col-span-1 btn-primary" @click="applyFilters">Aplicar</button>
      </div>
    </div>

    <!-- Tabla -->
    <div class="card overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-gray-50 border-b border-gray-100">
          <tr>
            <th class="th">Nombre</th>
            <th class="th">Usuario</th>
            <th class="th">Rol</th>
            <th class="th">Cédula</th>
            <th class="th">Conectado</th>
            <th class="th">Estado</th>
            <th class="th">Acciones</th>
          </tr>
        </thead>

        <tbody class="divide-y divide-gray-50">
          <tr v-for="u in pagedRows" :key="u.id" class="hover:bg-gray-100 transition-colors" :class="!u.active ? 'opacity-60' : ''">
            <!-- Nombre -->
            <td class="td">
              <div class="flex items-center gap-2.5">
                <div :class="avatarClass(u.role)">
                  {{ u.name.charAt(0).toUpperCase() }}
                </div>
                <div>
                  <span class="font-semibold text-gray-800">{{ u.name }}</span>
                  <p v-if="u.mustChangePassword" class="text-xs text-amber-600 font-medium mt-0.5">
                    El usuario debe cambiar su contraseña
                  </p>
                </div>
              </div>
            </td>

            <!-- Email -->
            <td class="td text-gray-500">{{ u.email }}</td>

            <!-- Rol -->
            <td class="td">
              <span :class="rolePillClass(u.role)">
                {{ ROLE_LABEL[u.role] || u.role }}
              </span>
            </td>

            <!-- Cédula -->
            <td class="td font-mono text-xs text-gray-500">{{ u.cedula || "—" }}</td>

            <!-- Conectado (presencia socket) -->
            <td class="td">
              <span
                v-if="isConnected(u)"
                class="inline-flex items-center gap-1 text-xs font-medium text-green-700"
              >
                <span class="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
                En línea
              </span>
              <span
                v-else
                class="inline-flex items-center gap-1 text-xs font-medium text-gray-400"
              >
                <span class="w-2 h-2 rounded-full bg-gray-300 inline-block"></span>
                Desconectado
              </span>
            </td>

            <!-- Estado activo/desactivado -->
            <td class="td">
              <div v-if="u.active">
                <span class="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                  Activo
                </span>
              </div>
              <div v-else class="max-w-[160px]">
                <span
                  class="inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full"
                  :title="deactivatedReasonLabel(u.deactivatedReason)"
                >
                  Desactivado
                </span>
                <p class="text-[11px] text-gray-400 mt-0.5 leading-tight break-words">
                  {{ deactivatedReasonLabel(u.deactivatedReason) }}
                </p>
              </div>
            </td>

            <!-- Acciones -->
            <td class="td">
              <div class="flex flex-wrap gap-1.5">
                <!-- Editar (siempre disponible) -->
                <button
                  class="px-2.5 py-1 rounded-md border border-gray-200 text-xs font-medium hover:bg-gray-50 transition-colors"
                  @click="s.openEdit(u)"
                >Editar</button>

                <!-- Desactivar / Reactivar -->
                <button
                  v-if="u.active"
                  class="px-2.5 py-1 rounded-md border border-amber-200 bg-amber-50 text-amber-700 text-xs font-medium hover:bg-amber-100 transition-colors"
                  @click="s.openDeactivate(u.id)"
                >Desactivar</button>
                <button
                  v-else
                  class="px-2.5 py-1 rounded-md border border-green-300 bg-green-100 text-green-800 text-xs font-semibold hover:bg-green-200 transition-colors !opacity-100"
                  @click="s.activate(u.id)"
                >Reactivar</button>

                <!-- Resetear contraseña -->
                <button
                  class="px-2.5 py-1 rounded-md border border-blue-200 bg-blue-50 text-blue-700 text-xs font-medium hover:bg-blue-100 transition-colors"
                  @click="s.resetPassword(u.id)"
                >Resetear pwd</button>
              </div>
            </td>
          </tr>

          <!-- Estado vacío -->
          <tr v-if="!filteredRows.length && !s.loading">
            <td colspan="7" class="py-12 text-center text-gray-400">
              <div class="flex flex-col items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
                <span class="text-sm">Sin usuarios que coincidan con los filtros</span>
              </div>
            </td>
          </tr>

          <!-- Skeleton de carga -->
          <tr v-if="s.loading">
            <td colspan="7" class="py-8 text-center text-gray-400 text-sm">Cargando usuarios...</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Paginación (solo si hay más de una página) -->
    <div
      v-if="totalPages > 1"
      class="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3"
    >
      <span class="text-sm text-gray-500">{{ rangeLabel }}</span>
      <div class="flex items-center gap-2">
        <button
          class="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          :disabled="currentPage === 1"
          @click="firstPage"
          title="Primera página"
        >« Primera</button>
        <button
          class="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          :disabled="currentPage === 1"
          @click="prevPage"
        >‹ Anterior</button>
        <span class="text-sm text-gray-600 px-1">
          Página <strong>{{ currentPage }}</strong> de <strong>{{ totalPages }}</strong>
        </span>
        <button
          class="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          :disabled="currentPage === totalPages"
          @click="nextPage"
        >Siguiente ›</button>
        <button
          class="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          :disabled="currentPage === totalPages"
          @click="lastPage"
          title="Última página"
        >Última »</button>
      </div>
    </div>

    <!-- ================================================================ -->
    <!-- Modal crear/editar usuario                                        -->
    <!-- ================================================================ -->
    <div
      v-if="s.modalOpen"
      class="overlay-backdrop flex items-center justify-center p-4 z-40"
      @click.self="s.modalOpen = false"
    >
      <div class="w-full max-w-xl card shadow-2xl overflow-hidden">
        <div class="bg-gray-50 border-b px-6 py-4 flex items-start justify-between gap-3">
          <div>
            <h2 class="font-bold text-gray-800">
              {{ s.mode === "create" ? "Crear usuario" : "Editar usuario" }}
            </h2>
            <p class="text-sm text-gray-500">
              {{ s.mode === "create" ? "Se generará acceso al sistema" : "Actualiza datos y/o contraseña" }}
            </p>
          </div>
          <button class="btn-secondary text-xs py-1.5" @click="s.modalOpen = false">Cerrar</button>
        </div>

        <div class="p-6 space-y-4">
          <!-- Error de guardado visible en el modal -->
          <div
            v-if="s.saveError"
            class="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
          >
            {{ s.saveError }}
          </div>

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
            <button class="btn-secondary" @click="s.modalOpen = false">Cancelar</button>
            <button
              class="btn-primary disabled:opacity-50"
              :disabled="s.saving"
              @click="s.save"
            >
              {{ s.mode === "create" ? "Crear usuario" : "Guardar cambios" }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ================================================================ -->
    <!-- Modal confirmar desactivación                                     -->
    <!-- ================================================================ -->
    <div
      v-if="s.deactivateModalOpen"
      class="overlay-backdrop flex items-center justify-center p-4 z-50"
      @click.self="s.deactivateModalOpen = false"
    >
      <div class="w-full max-w-md card shadow-2xl overflow-hidden">
        <div class="bg-amber-50 border-b border-amber-200 px-6 py-4 flex items-start justify-between gap-3">
          <div>
            <h2 class="font-bold text-amber-800">Desactivar usuario</h2>
            <p class="text-sm text-amber-600">El usuario perderá acceso inmediatamente</p>
          </div>
          <button class="btn-secondary text-xs py-1.5" @click="s.deactivateModalOpen = false">Cerrar</button>
        </div>

        <div class="p-6 space-y-4">
          <p class="text-sm text-gray-600">
            Opcionalmente, indica la razón de desactivación (visible para el administrador):
          </p>
          <textarea
            v-model="s.deactivateReason"
            class="input-base w-full resize-none"
            rows="3"
            placeholder="Ej. Baja del personal, fin de contrato... (opcional)"
          ></textarea>

          <div class="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <button class="btn-secondary" @click="s.deactivateModalOpen = false">Cancelar</button>
            <button
              class="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
              :disabled="s.deactivating"
              @click="s.deactivate"
            >
              {{ s.deactivating ? "Desactivando..." : "Confirmar desactivación" }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ================================================================ -->
    <!-- Modal contraseña temporal (solo se muestra una vez)              -->
    <!-- ================================================================ -->
    <div
      v-if="s.tempPasswordModal"
      class="overlay-backdrop flex items-center justify-center p-4 z-50"
    >
      <div class="w-full max-w-md card shadow-2xl overflow-hidden">
        <div class="bg-blue-50 border-b border-blue-200 px-6 py-4">
          <h2 class="font-bold text-blue-800">Contraseña temporal generada</h2>
          <p class="text-sm text-blue-600 mt-0.5">Esta es la única vez que podrás ver esta contraseña</p>
        </div>

        <div class="p-6 space-y-4">
          <p class="text-sm text-gray-600">
            Comparte esta contraseña temporal con el usuario. Al ingresar, el sistema le solicitará
            establecer una nueva contraseña de inmediato.
          </p>

          <!-- Contraseña con fondo de codigo -->
          <div class="bg-gray-900 rounded-lg px-4 py-3 flex items-center justify-between gap-3">
            <code class="text-green-400 font-mono text-lg tracking-widest select-all">
              {{ s.tempPassword }}
            </code>
            <button
              class="shrink-0 text-xs text-gray-400 hover:text-white transition-colors flex items-center gap-1"
              @click="s.copyTempPassword"
            >
              <svg v-if="!s.tempPasswordCopied" xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
              </svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
              </svg>
              {{ s.tempPasswordCopied ? "Copiado" : "Copiar" }}
            </button>
          </div>

          <div class="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700 flex items-start gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
            Cópiala ahora. No podrás recuperarla después.
          </div>

          <div class="flex justify-end pt-2 border-t border-gray-100">
            <button
              class="btn-primary"
              @click="s.tempPasswordModal = false"
            >
              Entendido, cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
