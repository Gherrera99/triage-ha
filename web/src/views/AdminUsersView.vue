<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useAdminUsersStore } from "../stores/adminUsers";

const s = useAdminUsersStore();

onMounted(() => s.fetch());

const createForm = ref({
  email: "",
  name: "",
  role: "NURSE_TRIAGE",
  password: "",
  cedula: "",
});

async function create() {
  if (!createForm.value.email || !createForm.value.name || !createForm.value.password) {
    return alert("Faltan campos");
  }
  await s.create({
    email: createForm.value.email,
    name: createForm.value.name,
    role: createForm.value.role,
    password: createForm.value.password,
    cedula: createForm.value.cedula || null,
  });
  createForm.value = { email: "", name: "", role: "NURSE_TRIAGE", password: "", cedula: "" };
}

</script>

<template>
  <div class="p-6 max-w-6xl mx-auto">
    <div class="bg-white rounded-2xl shadow p-6">
      <h1 class="text-2xl font-semibold mb-4">Usuarios (Admin)</h1>

      <div class="border rounded-2xl p-4 mb-6">
        <div class="font-semibold mb-3">Crear usuario</div>
        <div class="grid grid-cols-5 gap-3">
          <input v-model="createForm.email" class="border rounded-xl p-2" placeholder="email" />
          <input v-model="createForm.fullName" class="border rounded-xl p-2" placeholder="nombre" />
          <select v-model="createForm.role" class="border rounded-xl p-2">
            <option value="NURSE_TRIAGE">NURSE_TRIAGE</option>
            <option value="CASHIER">CASHIER</option>
            <option value="DOCTOR">DOCTOR</option>l
            <option value="ADMIN">ADMIN</option>
            <option value="CONSULTOR">CONSULTOR</option>
          </select>
          <input v-model="createForm.password" type="password" class="border rounded-xl p-2" placeholder="password" />
          <input v-model="createForm.licenseNo" class="border rounded-xl p-2" placeholder="cédula (doctor)" />
        </div>
        <div class="flex justify-end mt-3">
          <button class="bg-blue-600 text-white rounded-xl px-4 py-2" @click="create">Crear</button>
        </div>
      </div>

      <div class="overflow-auto">
        <table class="w-full text-sm">
          <thead>
          <tr class="text-left border-b">
            <th class="py-2">ID</th>
            <th>Email</th>
            <th>Nombre</th>
            <th>Rol</th>
            <th>Cédula</th>
            <th>Activo</th>
          </tr>
          </thead>
          <tbody>
          <tr v-for="u in s.users" :key="u.id" class="border-b">
            <td class="py-2">{{ u.id }}</td>
            <td>{{ u.email }}</td>
            <td>{{ u.name }}</td>
            <td>{{ u.role }}</td>
            <td>{{ u.cedula || "-" }}</td>
<!--            <td>-->
<!--              <input-->
<!--                  type="checkbox"-->
<!--                  :checked="u.isActive"-->
<!--                  @change="s.update(u.id, { isActive: !u.isActive })"-->
<!--              />-->
<!--            </td>-->
          </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
