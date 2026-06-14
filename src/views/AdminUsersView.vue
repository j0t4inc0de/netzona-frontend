<script setup>
import { computed, ref, watch } from 'vue'
import { useTelemetricsStore } from '../stores/telemetrics'
import { useAuthStore } from '../stores/auth'
import { toast } from 'vue-sonner'
import { api } from '../services/api'

const store = useTelemetricsStore()
const authStore = useAuthStore()

// Edición de Perfil de un Trabajador/Usuario
const editingUser = ref(null)

const startEditWorker = (worker) => {
  const selectedGroupId = worker.groups && worker.groups.length > 0 ? worker.groups[0] : null
  editingUser.value = { 
    ...worker, 
    selectedGroupId 
  }
}

const saveWorkerDetails = async () => {
  if (!editingUser.value.name.trim() || !editingUser.value.username.trim() || !editingUser.value.rut.trim()) {
    toast.error('Complete todos los campos obligatorios.')
    return
  }

  const nameParts = editingUser.value.name.trim().split(/\s+/)
  const nombres = nameParts[0] || ''
  const apellidos = nameParts.slice(1).join(' ') || ''
  const email = editingUser.value.username.includes('@') ? editingUser.value.username.trim().toLowerCase() : `${editingUser.value.username.trim().toLowerCase()}@netzona.cl`
  const rut = editingUser.value.rut.trim()

  const body = {
    nombres,
    apellidos,
    email,
    rut
  }

  const isNetzonaAdmin = authStore.currentUser?.group_names.includes('admin_netzona')
  if (isNetzonaAdmin) {
    if (editingUser.value.selectedGroupId) {
      body.groups = [editingUser.value.selectedGroupId]
    }
    if (editingUser.value.empresa) {
      body.empresa = editingUser.value.empresa
    }
  }

  try {
    const res = await api(`/cuentas/usuarios/${editingUser.value.id}/`, {
      method: 'PATCH',
      body: JSON.stringify(body)
    })

    if (res.ok) {
      toast.success('Perfil de usuario actualizado con éxito.')
      editingUser.value = null
      await store.fetchDataFromBackend()
    } else {
      const errorData = await res.json().catch(() => ({}))
      const errorMsg = errorData.email?.[0] || errorData.rut?.[0] || errorData.nombres?.[0] || 'Error al actualizar perfil.'
      toast.error(errorMsg)
    }
  } catch {
    toast.error('Error de conexión al guardar cambios.')
  }
}

// Filtrar trabajadores/usuarios según el rol de la persona autenticada
const filteredWorkers = computed(() => {
  return store.workers.filter((w) => {
    if (authStore.currentUser && w.id === authStore.currentUser.id) return false
    
    // Si no es admin_netzona, solo puede ver y editar trabajadores
    const isNetzonaAdmin = authStore.currentUser?.group_names.includes('admin_netzona')
    if (!isNetzonaAdmin && w.role !== 'trabajador') return false
    
    return true
  })
})

// Formulario de Usuario Nuevo
const workerName = ref('')
const workerUsername = ref('')
const workerRut = ref('')
const selectedGroupId = ref(null)
const selectedEmpresaId = ref(null)
const selectedPermissions = ref([])
const formErrors = ref({})

// Grupos permitidos según el rol del usuario logueado
const allowedGroups = computed(() => {
  const isNetzonaAdmin = authStore.currentUser?.group_names.includes('admin_netzona')
  if (isNetzonaAdmin) {
    return store.groups
  } else {
    return store.groups.filter(g => g.name === 'trabajador')
  }
})

// Auto-seleccionar grupo por defecto
watch(() => store.groups, (newGroups) => {
  if (newGroups && newGroups.length > 0) {
    const isNetzonaAdmin = authStore.currentUser?.group_names.includes('admin_netzona')
    if (!isNetzonaAdmin) {
      const workerGroup = newGroups.find(g => g.name === 'trabajador')
      if (workerGroup) {
        selectedGroupId.value = workerGroup.id
      }
    } else {
      // Si es técnico, por defecto selecciona trabajador o el primero
      const workerGroup = newGroups.find(g => g.name === 'trabajador')
      selectedGroupId.value = workerGroup ? workerGroup.id : newGroups[0].id
    }
  }
}, { immediate: true })

const handleAddWorker = async () => {
  formErrors.value = {}
  if (!workerName.value.trim() || !workerUsername.value.trim() || !workerRut.value.trim()) {
    toast.error('Por favor complete todos los datos obligatorios.')
    return
  }

  const isNetzonaAdmin = authStore.currentUser?.group_names.includes('admin_netzona')
  if (isNetzonaAdmin && !selectedEmpresaId.value) {
    toast.error('Debe seleccionar una empresa.')
    return
  }

  try {
    await store.addWorker(
      workerName.value.trim(),
      workerUsername.value.trim(),
      selectedPermissions.value,
      selectedGroupId.value,
      workerRut.value.trim(),
      selectedEmpresaId.value
    )

    toast.success(`Usuario "${workerName.value}" registrado con éxito.`)
    workerName.value = ''
    workerUsername.value = ''
    workerRut.value = ''
    selectedPermissions.value = []
    formErrors.value = {}
  } catch (err) {
    if (err && typeof err === 'object') {
      formErrors.value = err
      const mainError = err.detail || err.non_field_errors?.[0] || 'Error al registrar el usuario. Verifique los campos.'
      toast.error(mainError)
    } else {
      toast.error('Error al registrar el usuario.')
    }
  }
}

const handleRemoveWorker = async (id) => {
  if (confirm('¿Está seguro de eliminar este usuario?')) {
    try {
      await store.removeWorker(id)
      toast.success('Usuario eliminado correctamente')
    } catch {
      toast.error('Error al eliminar el usuario')
    }
  }
}

// Edición de Permisos (Accesos) de un Trabajador
const editingWorkerId = ref(null)
const editingPermissions = ref([])

const startEditPermissions = (worker) => {
  editingWorkerId.value = worker.id
  editingPermissions.value = [...worker.permissions]
}

const savePermissions = async () => {
  try {
    await store.updateWorkerPermissions(editingWorkerId.value, editingPermissions.value)
    toast.success('Accesos actualizados correctamente')
    editingWorkerId.value = null
    editingPermissions.value = []
  } catch {
    toast.error('Error al actualizar los accesos')
  }
}

const cancelEdit = () => {
  editingWorkerId.value = null
  editingPermissions.value = []
}

const getPermissionNames = (permissionIds) => {
  if (!permissionIds || permissionIds.length === 0) return 'Ninguno (Sin accesos)'
  return permissionIds
    .map((id) => {
      const predio = store.predios.find((p) => p.id === id)
      if (predio) return predio.name
      const cerro = store.cerros.find((c) => c.id === id)
      if (cerro) return cerro.name
      return id
    })
    .join(', ')
}
</script>

<template>
  <div class="space-y-8 max-w-6xl mx-auto">
    <!-- Encabezado -->
    <div class="flex justify-between items-center">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">Administración de Personal</h1>
        <p class="text-sm text-mako-500 dark:text-mako-400 mt-1">
          Cree accesos y configure la jerarquía/permisos de visualización para sus operadores y
          trabajadores.
        </p>
      </div>
      <div
        class="px-4 py-2 bg-primary/10 border border-primary/20 rounded-full text-xs font-bold text-primary"
      >
        Rol: {{ authStore.currentUser?.role === 'tecnico' ? 'Admin Netzona' : 'Administrador' }}
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <!-- Formulario para agregar trabajador -->
      <div
        class="lg:col-span-1 p-6 bg-white/85 dark:bg-mako-900/60 backdrop-blur-xl border border-white/40 dark:border-white/5 rounded-[2rem] shadow-lg flex flex-col justify-between"
      >
        <div>
          <h2 class="text-xl font-semibold mb-4 flex items-center gap-2">
            <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M18 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Agregar Usuario
          </h2>

          <form @submit.prevent="handleAddWorker" class="space-y-4">
            <div>
              <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5"
                >Nombre Completo *</label
              >
              <input
                v-model="workerName"
                type="text"
                placeholder="Ej. Pedro Díaz"
                class="w-full px-4 py-3 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none focus:border-primary text-sm transition-all"
                :class="{'border-red-500': formErrors.nombres || formErrors.apellidos}"
              />
              <p v-if="formErrors.nombres" class="text-red-500 text-[10px] mt-1">{{ formErrors.nombres[0] }}</p>
              <p v-if="formErrors.apellidos" class="text-red-500 text-[10px] mt-1">{{ formErrors.apellidos[0] }}</p>
            </div>

            <div>
              <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5"
                >RUT *</label
              >
              <input
                v-model="workerRut"
                type="text"
                placeholder="Ej. 12.345.678-5"
                class="w-full px-4 py-3 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none focus:border-primary text-sm transition-all"
                :class="{'border-red-500': formErrors.rut}"
              />
              <p v-if="formErrors.rut" class="text-red-500 text-[10px] mt-1">{{ formErrors.rut[0] }}</p>
            </div>

            <div>
              <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5"
                >Email / Usuario *</label
              >
              <input
                v-model="workerUsername"
                type="text"
                placeholder="Ej. pedro.diaz"
                class="w-full px-4 py-3 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none focus:border-primary text-sm transition-all"
                :class="{'border-red-500': formErrors.email}"
              />
              <p v-if="formErrors.email" class="text-red-500 text-[10px] mt-1">{{ formErrors.email[0] }}</p>
            </div>

            <!-- Selector de Rol (si hay más de 1 grupo disponible, p. ej. Admin Netzona) -->
            <div v-if="allowedGroups.length > 1">
              <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5"
                >Rol / Tipo de Usuario *</label
              >
              <select
                v-model="selectedGroupId"
                class="w-full px-4 py-3 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none focus:border-primary text-sm transition-all text-mako-900 dark:text-white"
              >
                <option v-for="g in allowedGroups" :key="g.id" :value="g.id">
                  {{ g.name === 'admin_netzona' ? 'Admin Netzona' : g.name === 'cliente_empresa' ? 'Cliente Empresa' : 'Trabajador' }}
                </option>
              </select>
              <p v-if="formErrors.groups" class="text-red-500 text-[10px] mt-1">{{ formErrors.groups[0] }}</p>
            </div>

            <!-- Selector de Empresa (solo si el usuario logueado es Admin Netzona) -->
            <div v-if="authStore.currentUser?.group_names.includes('admin_netzona')">
              <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5"
                >Empresa Cliente *</label
              >
              <select
                v-model="selectedEmpresaId"
                class="w-full px-4 py-3 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none focus:border-primary text-sm transition-all text-mako-900 dark:text-white"
              >
                <option :value="null" disabled>Seleccione una empresa</option>
                <option v-for="c in store.clients" :key="c.id" :value="c.id">
                  {{ c.name }}
                </option>
              </select>
              <p v-if="formErrors.empresa" class="text-red-500 text-[10px] mt-1">{{ formErrors.empresa[0] }}</p>
            </div>

            <!-- Asignación de Permisos de visualización (sólo aplica si se crea un Trabajador) -->
            <div v-if="!selectedGroupId || store.groups.find(g => g.id === selectedGroupId)?.name === 'trabajador'">
              <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-2"
                >Permisos de Visualización (Sitios)</label
              >

              <div
                class="space-y-2 max-h-40 overflow-y-auto p-2 bg-mako-100/50 dark:bg-mako-800/20 border border-mako-200 dark:border-white/5 rounded-xl"
              >
                <p class="text-[10px] uppercase font-bold text-mako-400">Predios Agrícolas</p>
                <div v-for="p in store.predios" :key="p.id" class="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    v-model="selectedPermissions"
                    :value="p.id"
                    class="accent-primary"
                  />
                  <span>{{ p.name }}</span>
                </div>

                <p class="text-[10px] uppercase font-bold text-mako-400 mt-2">Cerros Telecom</p>
                <div v-for="c in store.cerros" :key="c.id" class="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    v-model="selectedPermissions"
                    :value="c.id"
                    class="accent-primary"
                  />
                  <span>{{ c.name }}</span>
                </div>
              </div>
            </div>

            <button
              type="submit"
              class="w-full py-3.5 rounded-xl bg-primary text-white font-bold hover:shadow-[0_0_15px_rgba(0,209,94,0.3)] transition-all duration-300"
            >
              Registrar Usuario
            </button>
          </form>
        </div>
      </div>

      <!-- Listado de Trabajadores / Usuarios -->
      <div
        class="lg:col-span-2 p-6 bg-white/85 dark:bg-mako-900/60 backdrop-blur-xl border border-white/40 dark:border-white/5 rounded-[2rem] shadow-lg flex flex-col justify-between"
      >
        <div>
          <h2 class="text-xl font-semibold mb-4">Usuarios y Trabajadores Autorizados</h2>

          <!-- Modal o Sección de edición rápida inline de accesos -->
          <div
            v-if="editingWorkerId"
            class="mb-6 p-4 bg-primary/5 border border-primary/20 rounded-2xl space-y-4"
          >
            <h3 class="font-semibold text-sm">
              Modificar accesos para:
              <span class="text-primary font-bold">{{
                store.workers.find((w) => w.id === editingWorkerId)?.name
              }}</span>
            </h3>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <p class="text-xs uppercase font-bold text-mako-400 mb-1.5">Predios</p>
                <div v-for="p in store.predios" :key="p.id" class="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    v-model="editingPermissions"
                    :value="p.id"
                    class="accent-primary"
                  />
                  <span>{{ p.name }}</span>
                </div>
              </div>

              <div>
                <p class="text-xs uppercase font-bold text-mako-400 mb-1.5">Cerros</p>
                <div v-for="c in store.cerros" :key="c.id" class="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    v-model="editingPermissions"
                    :value="c.id"
                    class="accent-primary"
                  />
                  <span>{{ c.name }}</span>
                </div>
              </div>
            </div>

            <div class="flex gap-2 justify-end">
              <button
                @click="cancelEdit"
                class="px-4 py-2 border border-mako-300 dark:border-mako-700 text-xs rounded-xl hover:bg-mako-100 dark:hover:bg-white/5"
              >
                Cancelar
              </button>
              <button
                @click="savePermissions"
                class="px-4 py-2 bg-primary text-mako-950 font-bold text-xs rounded-xl hover:shadow-[0_0_10px_rgba(0,209,94,0.3)]"
              >
                Guardar Accesos
              </button>
            </div>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr
                  class="border-b border-mako-200 dark:border-white/5 text-xs uppercase tracking-wider text-mako-400"
                >
                  <th class="py-3 px-4">Nombre</th>
                  <th class="py-3 px-4">RUT</th>
                  <th class="py-3 px-4">Email</th>
                  <th class="py-3 px-4">Rol</th>
                  <th class="py-3 px-4">Accesos Autorizados</th>
                  <th class="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="w in filteredWorkers"
                  :key="w.id"
                  class="border-b border-mako-100 dark:border-white/5 hover:bg-mako-100/40 dark:hover:bg-white/5 transition-colors text-sm"
                >
                  <td class="py-3.5 px-4 font-semibold">{{ w.name }}</td>
                  <td class="py-3.5 px-4 font-mono text-xs text-mako-600 dark:text-mako-350">{{ w.rut || '-' }}</td>
                  <td class="py-3.5 px-4 font-mono text-xs text-mako-500 dark:text-mako-400">
                    {{ w.username }}
                  </td>
                  <td class="py-3.5 px-4 text-xs font-semibold">
                    <span :class="{
                      'text-blue-400 bg-blue-400/10 px-2.5 py-1 rounded-full': w.role === 'tecnico',
                      'text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-full': w.role === 'admin',
                      'text-primary bg-primary/10 px-2.5 py-1 rounded-full': w.role === 'trabajador'
                    }">
                      {{ w.role === 'tecnico' ? 'Admin Netzona' : w.role === 'admin' ? 'Cliente Empresa' : 'Trabajador' }}
                    </span>
                  </td>
                  <td class="py-3.5 px-4 text-xs">
                    <span class="text-mako-700 dark:text-mako-300 font-medium">
                      {{ w.role === 'trabajador' ? getPermissionNames(w.permissions) : 'Global (Todo)' }}
                    </span>
                  </td>
                  <td class="py-3.5 px-4 text-right space-x-2">
                    <button
                      @click="startEditWorker(w)"
                      class="px-2.5 py-1.5 text-xs font-semibold bg-mako-100 hover:bg-mako-200 dark:bg-white/5 dark:hover:bg-white/10 rounded-lg text-blue-400 transition-all"
                    >
                      Editar datos
                    </button>
                    <button
                      v-if="w.role === 'trabajador'"
                      @click="startEditPermissions(w)"
                      class="px-2.5 py-1.5 text-xs font-semibold bg-mako-100 hover:bg-mako-200 dark:bg-white/5 dark:hover:bg-white/10 rounded-lg text-primary transition-all"
                    >
                      Editar accesos
                    </button>
                    <button
                      @click="handleRemoveWorker(w.id)"
                      class="px-2.5 py-1.5 text-xs font-semibold bg-red-500/10 hover:bg-red-500/25 border border-red-500/25 text-red-500 rounded-lg transition-all"
                    >
                      Quitar
                    </button>
                  </td>
                </tr>
                <tr v-if="filteredWorkers.length === 0">
                  <td colspan="6" class="text-center py-6 text-mako-400 italic">
                    No hay trabajadores registrados.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal para Editar Datos de Trabajador/Usuario -->
    <div v-if="editingUser" class="fixed inset-0 bg-mako-950/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div class="bg-white/95 dark:bg-mako-900/95 border border-mako-200 dark:border-white/10 rounded-[2rem] shadow-2xl w-full max-w-md p-6 relative">
        <button @click="editingUser = null" class="absolute top-4 right-4 p-2 rounded-full hover:bg-mako-100 dark:hover:bg-white/10 text-mako-400">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
        
        <h3 class="text-lg font-bold mb-4 flex items-center gap-2">
          <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
          Editar Datos de Usuario
        </h3>
        
        <div class="space-y-4">
          <div>
            <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">Nombre Completo *</label>
            <input v-model="editingUser.name" type="text" class="w-full px-4 py-3 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none focus:border-primary text-sm text-mako-900 dark:text-white" />
          </div>
          <div>
            <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">RUT *</label>
            <input v-model="editingUser.rut" type="text" class="w-full px-4 py-3 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none focus:border-primary text-sm text-mako-900 dark:text-white" />
          </div>
          <div>
            <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">Email / Usuario *</label>
            <input v-model="editingUser.username" type="text" class="w-full px-4 py-3 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none focus:border-primary text-sm text-mako-900 dark:text-white" />
          </div>

          <!-- Selector de Rol en edición (solo para Admin Netzona) -->
          <div v-if="authStore.currentUser?.group_names.includes('admin_netzona')">
            <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">Rol / Tipo de Usuario *</label>
            <select v-model="editingUser.selectedGroupId" class="w-full px-4 py-3 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none focus:border-primary text-sm text-mako-900 dark:text-white">
              <option v-for="g in store.groups" :key="g.id" :value="g.id">
                {{ g.name === 'admin_netzona' ? 'Admin Netzona' : g.name === 'cliente_empresa' ? 'Cliente Empresa' : 'Trabajador' }}
              </option>
            </select>
          </div>

          <!-- Selector de Empresa en edición (solo para Admin Netzona) -->
          <div v-if="authStore.currentUser?.group_names.includes('admin_netzona')">
            <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">Empresa Cliente *</label>
            <select v-model="editingUser.empresa" class="w-full px-4 py-3 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none focus:border-primary text-sm text-mako-900 dark:text-white">
              <option v-for="c in store.clients" :key="c.id" :value="c.id">
                {{ c.name }}
              </option>
            </select>
          </div>

          <div class="flex gap-2 justify-end mt-4">
            <button @click="editingUser = null" class="px-4 py-2 border border-mako-300 dark:border-mako-700 text-xs rounded-xl hover:bg-mako-100 dark:hover:bg-white/5">
              Cancelar
            </button>
            <button @click="saveWorkerDetails" class="px-4 py-2 bg-primary text-mako-950 font-bold text-xs rounded-xl hover:shadow-[0_0_10px_rgba(0,209,94,0.3)]">
              Guardar Cambios
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
