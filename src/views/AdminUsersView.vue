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
const isSavingDetails = ref(false)

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

  isSavingDetails.value = true

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
  } finally {
    isSavingDetails.value = false
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
const isAddModalOpen = ref(false)
const isSubmitting = ref(false)

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

  isSubmitting.value = true

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
    isAddModalOpen.value = false
  } catch (err) {
    if (err && typeof err === 'object') {
      formErrors.value = err
      const mainError = err.detail || err.non_field_errors?.[0] || 'Error al registrar el usuario. Verifique los campos.'
      toast.error(mainError)
    } else {
      toast.error('Error al registrar el usuario.')
    }
  } finally {
    isSubmitting.value = false
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
const isSavingPermissions = ref(false)

const startEditPermissions = (worker) => {
  editingWorkerId.value = worker.id
  editingPermissions.value = [...worker.permissions]
}

const savePermissions = async () => {
  isSavingPermissions.value = true
  try {
    await store.updateWorkerPermissions(editingWorkerId.value, editingPermissions.value)
    toast.success('Accesos actualizados correctamente')
    editingWorkerId.value = null
    editingPermissions.value = []
  } catch {
    toast.error('Error al actualizar los accesos')
  } finally {
    isSavingPermissions.value = false
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
  <div class="space-y-6 max-w-7xl mx-auto">
    <!-- Navbar / Header Area -->
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/85 dark:bg-mako-900/60 backdrop-blur-xl border border-white/40 dark:border-white/5 rounded-[2rem] p-6 shadow-sm">
      <div class="flex items-center gap-4">
        <div class="p-3 bg-primary/10 rounded-2xl hidden sm:block">
          <svg class="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
        </div>
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-mako-900 dark:text-white">Gestión de Usuarios</h1>
          <p class="text-sm text-mako-500 dark:text-mako-400 mt-0.5">
            Administración de personal y control de accesos.
          </p>
        </div>
      </div>
      
      <div class="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
        <div class="px-5 py-2.5 bg-mako-100 dark:bg-mako-800 rounded-xl text-xs font-semibold text-mako-600 dark:text-mako-300 w-full sm:w-auto text-center border border-mako-200 dark:border-mako-700">
          Rol: <span class="text-primary font-bold">{{ authStore.currentUser?.role === 'tecnico' ? 'Admin Netzona' : 'Administrador' }}</span>
        </div>
        <button
          @click="isAddModalOpen = true"
          class="rounded-xl relative w-full sm:w-48 h-12 cursor-pointer flex items-center border border-primary bg-primary group overflow-hidden transition-all hover:shadow-[0_0_20px_rgba(0,209,94,0.4)]"
        >
          <span
            class="text-white font-bold w-full text-center sm:text-left sm:ml-6 transform group-hover:translate-x-40 transition-all duration-300"
          >
            Nuevo Usuario
          </span>
          <span
            class="absolute right-0 h-full w-12 rounded-xl bg-primary flex items-center justify-center transform group-hover:translate-x-0 group-hover:w-full transition-all duration-300"
          >
            <svg
              class="w-6 h-6 text-white"
              fill="none"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              viewBox="0 0 24 24"
            >
              <line x1="12" x2="12" y1="5" y2="19"></line>
              <line x1="5" x2="19" y1="12" y2="12"></line>
            </svg>
          </span>
        </button>
      </div>
    </div>

    <!-- Main Content: Table -->
    <div class="bg-white/85 dark:bg-mako-900/60 backdrop-blur-xl border border-white/40 dark:border-white/5 rounded-[2rem] shadow-sm overflow-hidden">
      <!-- Empty State -->
      <div v-if="filteredWorkers.length === 0" class="p-16 text-center">
        <svg class="w-16 h-16 text-mako-300 dark:text-mako-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
        <h3 class="text-lg font-semibold text-mako-600 dark:text-mako-300">No hay usuarios registrados</h3>
        <p class="text-sm text-mako-400 mt-1">Comience agregando un nuevo usuario al sistema.</p>
      </div>

      <!-- Users Table -->
      <div v-else class="overflow-x-auto custom-scrollbar sm:overflow-visible">
        <table class="w-full text-left whitespace-nowrap block sm:table">
          <thead class="hidden sm:table-header-group bg-mako-50 dark:bg-mako-800/50 border-b border-mako-100 dark:border-mako-700/50">
            <tr class="text-xs uppercase tracking-widest text-mako-500 dark:text-mako-400 font-bold">
              <th class="px-6 py-5">Usuario</th>
              <th class="px-6 py-5">Contacto</th>
              <th class="px-6 py-5">Rol</th>
              <th class="px-6 py-5">Accesos Permitidos</th>
              <th class="px-6 py-5 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody class="flex flex-col sm:table-row-group gap-4 sm:gap-0 p-4 sm:p-0 divide-y-0 sm:divide-y sm:divide-mako-100 dark:sm:divide-mako-800/60">
            <tr v-for="w in filteredWorkers" :key="w.id" class="block sm:table-row hover:bg-mako-50/50 dark:hover:bg-white/5 transition-colors group bg-white dark:bg-mako-800/40 sm:bg-transparent rounded-2xl sm:rounded-none border border-mako-100 dark:border-mako-700/50 sm:border-0 overflow-hidden shadow-sm sm:shadow-none">
              <!-- Usuario -->
              <td class="block sm:table-cell px-4 py-4 sm:px-6 sm:py-4 border-b border-mako-50 dark:border-mako-700/30 sm:border-0 bg-mako-50/50 dark:bg-mako-800/30 sm:bg-transparent">
                <div class="flex items-center gap-4">
                  <div class="w-11 h-11 rounded-full bg-mako-100 dark:bg-mako-800 flex items-center justify-center text-sm font-bold text-mako-600 dark:text-mako-300 border-2 border-white dark:border-mako-700 shadow-sm shrink-0">
                    {{ w.name.charAt(0).toUpperCase() }}
                  </div>
                  <div>
                    <p class="font-bold text-mako-900 dark:text-white text-sm">{{ w.name }}</p>
                    <p class="text-xs text-mako-500 font-mono mt-0.5">{{ w.rut || 'Sin RUT' }}</p>
                  </div>
                </div>
              </td>
              <!-- Contacto -->
              <td class="flex sm:table-cell justify-between items-center px-4 py-3 sm:px-6 sm:py-4 border-b border-mako-50 dark:border-mako-700/30 sm:border-0">
                <span class="text-[10px] font-bold text-mako-400 uppercase sm:hidden">Contacto</span>
                <div class="flex items-center gap-2 text-sm text-mako-600 dark:text-mako-350 bg-mako-50 dark:bg-mako-800/30 px-3 py-1.5 rounded-lg border border-mako-100 dark:border-mako-700/50 w-max max-w-[200px] sm:max-w-none truncate">
                  <svg class="w-4 h-4 text-mako-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                  <span class="truncate">{{ w.username }}</span>
                </div>
              </td>
              <!-- Rol -->
              <td class="flex sm:table-cell justify-between items-center px-4 py-3 sm:px-6 sm:py-4 border-b border-mako-50 dark:border-mako-700/30 sm:border-0">
                <span class="text-[10px] font-bold text-mako-400 uppercase sm:hidden">Rol</span>
                <span :class="{
                  'text-blue-600 bg-blue-500/10 dark:text-blue-400': w.role === 'tecnico',
                  'text-amber-600 bg-amber-500/10 dark:text-amber-400': w.role === 'admin',
                  'text-primary bg-primary/10': w.role === 'trabajador'
                }" class="inline-block px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider">
                  {{ w.role === 'tecnico' ? 'Admin Netzona' : w.role === 'admin' ? 'Cliente Empresa' : 'Trabajador' }}
                </span>
              </td>
              <!-- Accesos Permitidos -->
              <td class="flex sm:table-cell justify-between items-center px-4 py-3 sm:px-6 sm:py-4 border-b border-mako-50 dark:border-mako-700/30 sm:border-0">
                <span class="text-[10px] font-bold text-mako-400 uppercase sm:hidden shrink-0 mr-4">Accesos</span>
                <p class="text-xs text-mako-600 dark:text-mako-400 truncate sm:whitespace-normal bg-mako-50 dark:bg-mako-800/20 px-3 py-1.5 rounded-lg border border-mako-100 dark:border-mako-700/30 max-w-[150px] sm:max-w-xs" :title="w.role === 'trabajador' ? getPermissionNames(w.permissions) : 'Global (Acceso total)'">
                  {{ w.role === 'trabajador' ? getPermissionNames(w.permissions) : 'Global (Acceso total)' }}
                </p>
              </td>
              <!-- Acciones -->
              <td class="flex sm:table-cell justify-between sm:justify-end items-center px-4 py-3 sm:px-6 sm:py-4 bg-mako-50/30 dark:bg-mako-800/20 sm:bg-transparent">
                <span class="text-[10px] font-bold text-mako-400 uppercase sm:hidden">Acciones</span>
                <div class="flex gap-1 justify-end">
                  <button @click="startEditWorker(w)" class="p-2 text-mako-400 hover:text-blue-500 hover:bg-blue-500/10 bg-white dark:bg-mako-800 sm:bg-transparent shadow-sm sm:shadow-none border border-mako-100 dark:border-mako-700 sm:border-0 rounded-xl transition-colors" title="Editar perfil">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                  </button>
                  <button v-if="w.role === 'trabajador'" @click="startEditPermissions(w)" class="p-2 text-mako-400 hover:text-primary hover:bg-primary/10 bg-white dark:bg-mako-800 sm:bg-transparent shadow-sm sm:shadow-none border border-mako-100 dark:border-mako-700 sm:border-0 rounded-xl transition-colors" title="Editar accesos">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"></path></svg>
                  </button>
                  <button @click="handleRemoveWorker(w.id)" class="p-2 text-mako-400 hover:text-red-500 hover:bg-red-500/10 bg-white dark:bg-mako-800 sm:bg-transparent shadow-sm sm:shadow-none border border-mako-100 dark:border-mako-700 sm:border-0 rounded-xl transition-colors" title="Eliminar usuario">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal para Agregar Usuario -->
    <div v-if="isAddModalOpen" class="fixed inset-0 bg-mako-950/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div class="bg-white/95 dark:bg-mako-900/95 border border-mako-200 dark:border-white/10 rounded-[2rem] shadow-2xl w-full max-w-lg p-6 lg:p-8 relative max-h-[90vh] overflow-y-auto custom-scrollbar">
        <button @click="isAddModalOpen = false" class="absolute top-6 right-6 p-2 rounded-full hover:bg-mako-100 dark:hover:bg-white/10 text-mako-400 transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
        
        <h3 class="text-xl font-bold mb-6 flex items-center gap-3 text-mako-900 dark:text-white">
          <div class="p-2 bg-primary/10 rounded-xl">
            <svg class="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          </div>
          Registrar Nuevo Usuario
        </h3>
        
        <form @submit.prevent="handleAddWorker" class="space-y-5">
          <div>
            <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">Nombre Completo *</label>
            <input v-model="workerName" type="text" placeholder="Ej. Pedro Díaz" class="w-full px-4 py-3.5 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none focus:border-primary text-sm text-mako-900 dark:text-white transition-all" :class="{'border-red-500': formErrors.nombres || formErrors.apellidos}" />
            <p v-if="formErrors.nombres" class="text-red-500 text-[10px] mt-1">{{ formErrors.nombres[0] }}</p>
            <p v-if="formErrors.apellidos" class="text-red-500 text-[10px] mt-1">{{ formErrors.apellidos[0] }}</p>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">RUT *</label>
              <input v-model="workerRut" type="text" placeholder="Ej. 12.345.678-5" class="w-full px-4 py-3.5 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none focus:border-primary text-sm text-mako-900 dark:text-white transition-all" :class="{'border-red-500': formErrors.rut}" />
              <p v-if="formErrors.rut" class="text-red-500 text-[10px] mt-1">{{ formErrors.rut[0] }}</p>
            </div>

            <div>
              <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">Email / Usuario *</label>
              <input v-model="workerUsername" type="text" placeholder="Ej. pedro.diaz" class="w-full px-4 py-3.5 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none focus:border-primary text-sm text-mako-900 dark:text-white transition-all" :class="{'border-red-500': formErrors.email}" />
              <p v-if="formErrors.email" class="text-red-500 text-[10px] mt-1">{{ formErrors.email[0] }}</p>
            </div>
          </div>

          <div v-if="allowedGroups.length > 1">
            <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">Rol / Tipo de Usuario *</label>
            <select v-model="selectedGroupId" class="w-full px-4 py-3.5 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none focus:border-primary text-sm text-mako-900 dark:text-white transition-all appearance-none cursor-pointer">
              <option v-for="g in allowedGroups" :key="g.id" :value="g.id">
                {{ g.name === 'admin_netzona' ? 'Admin Netzona' : g.name === 'cliente_empresa' ? 'Cliente Empresa' : 'Trabajador' }}
              </option>
            </select>
            <p v-if="formErrors.groups" class="text-red-500 text-[10px] mt-1">{{ formErrors.groups[0] }}</p>
          </div>

          <div v-if="authStore.currentUser?.group_names.includes('admin_netzona')">
            <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">Empresa Cliente *</label>
            <select v-model="selectedEmpresaId" class="w-full px-4 py-3.5 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none focus:border-primary text-sm text-mako-900 dark:text-white transition-all appearance-none cursor-pointer">
              <option :value="null" disabled>Seleccione una empresa</option>
              <option v-for="c in store.clients" :key="c.id" :value="c.id">
                {{ c.name }}
              </option>
            </select>
            <p v-if="formErrors.empresa" class="text-red-500 text-[10px] mt-1">{{ formErrors.empresa[0] }}</p>
          </div>

          <div v-if="!selectedGroupId || store.groups.find(g => g.id === selectedGroupId)?.name === 'trabajador'">
            <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-2">Permisos de Visualización (Sitios)</label>
            <div class="space-y-3 max-h-48 overflow-y-auto custom-scrollbar p-3 bg-mako-100/50 dark:bg-mako-800/20 border border-mako-200 dark:border-white/5 rounded-xl">
              <div v-if="store.predios.length > 0">
                <p class="text-[10px] uppercase font-bold text-mako-400 mb-2">Zonas:</p>
                <div class="space-y-2">
                  <label v-for="p in store.predios" :key="p.id" class="flex items-center gap-3 text-sm cursor-pointer group hover:bg-mako-200/50 dark:hover:bg-mako-700/50 p-2 rounded-lg transition-colors">
                    <input type="checkbox" v-model="selectedPermissions" :value="p.id" class="w-4 h-4 text-primary bg-mako-100 border-mako-300 rounded focus:ring-primary focus:ring-2 dark:bg-mako-800 dark:border-mako-600 accent-primary" />
                    <span class="text-mako-700 dark:text-mako-300 group-hover:text-mako-900 dark:group-hover:text-white transition-colors">{{ p.name }}</span>
                  </label>
                </div>
              </div>

              <div v-if="store.cerros.length > 0" :class="{'mt-4': store.predios.length > 0}">
                <p class="text-[10px] uppercase font-bold text-mako-400 mb-2">Cerros Telecom</p>
                <div class="space-y-2">
                  <label v-for="c in store.cerros" :key="c.id" class="flex items-center gap-3 text-sm cursor-pointer group hover:bg-mako-200/50 dark:hover:bg-mako-700/50 p-2 rounded-lg transition-colors">
                    <input type="checkbox" v-model="selectedPermissions" :value="c.id" class="w-4 h-4 text-primary bg-mako-100 border-mako-300 rounded focus:ring-primary focus:ring-2 dark:bg-mako-800 dark:border-mako-600 accent-primary" />
                    <span class="text-mako-700 dark:text-mako-300 group-hover:text-mako-900 dark:group-hover:text-white transition-colors">{{ c.name }}</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div class="pt-4 border-t border-mako-200 dark:border-mako-700/50 flex gap-3 justify-end">
            <button type="button" @click="isAddModalOpen = false" :disabled="isSubmitting" class="px-5 py-3.5 border border-mako-300 dark:border-mako-700 text-sm font-semibold rounded-xl hover:bg-mako-100 dark:hover:bg-white/5 transition-all w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed">
              Cancelar
            </button>
            <button type="submit" :disabled="isSubmitting" class="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-primary text-white font-bold hover:shadow-[0_0_15px_rgba(0,209,94,0.4)] transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              <svg v-if="isSubmitting" class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              {{ isSubmitting ? 'Registrando...' : 'Registrar Usuario' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal para Editar Datos de Trabajador/Usuario -->
    <div v-if="editingUser" class="fixed inset-0 bg-mako-950/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div class="bg-white/95 dark:bg-mako-900/95 border border-mako-200 dark:border-white/10 rounded-[2rem] shadow-2xl w-full max-w-lg p-6 lg:p-8 relative">
        <button @click="editingUser = null" class="absolute top-6 right-6 p-2 rounded-full hover:bg-mako-100 dark:hover:bg-white/10 text-mako-400 transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
        
        <h3 class="text-xl font-bold mb-6 flex items-center gap-3 text-mako-900 dark:text-white">
          <div class="p-2 bg-blue-500/10 rounded-xl">
            <svg class="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
          </div>
          Editar Perfil de Usuario
        </h3>
        
        <div class="space-y-5">
          <div>
            <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">Nombre Completo *</label>
            <input v-model="editingUser.name" type="text" class="w-full px-4 py-3.5 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none focus:border-primary text-sm text-mako-900 dark:text-white transition-all" />
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">RUT *</label>
              <input v-model="editingUser.rut" type="text" class="w-full px-4 py-3.5 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none focus:border-primary text-sm text-mako-900 dark:text-white transition-all" />
            </div>
            <div>
              <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">Email / Usuario *</label>
              <input v-model="editingUser.username" type="text" class="w-full px-4 py-3.5 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none focus:border-primary text-sm text-mako-900 dark:text-white transition-all" />
            </div>
          </div>

          <div v-if="authStore.currentUser?.group_names.includes('admin_netzona')">
            <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">Rol / Tipo de Usuario *</label>
            <select v-model="editingUser.selectedGroupId" class="w-full px-4 py-3.5 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none focus:border-primary text-sm text-mako-900 dark:text-white transition-all appearance-none cursor-pointer">
              <option v-for="g in store.groups" :key="g.id" :value="g.id">
                {{ g.name === 'admin_netzona' ? 'Admin Netzona' : g.name === 'cliente_empresa' ? 'Cliente Empresa' : 'Trabajador' }}
              </option>
            </select>
          </div>

          <div v-if="authStore.currentUser?.group_names.includes('admin_netzona')">
            <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">Empresa Cliente *</label>
            <select v-model="editingUser.empresa" class="w-full px-4 py-3.5 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none focus:border-primary text-sm text-mako-900 dark:text-white transition-all appearance-none cursor-pointer">
              <option v-for="c in store.clients" :key="c.id" :value="c.id">
                {{ c.name }}
              </option>
            </select>
          </div>

          <div class="pt-4 border-t border-mako-200 dark:border-mako-700/50 flex gap-3 justify-end mt-2">
            <button @click="editingUser = null" :disabled="isSavingDetails" class="px-5 py-3.5 border border-mako-300 dark:border-mako-700 text-sm font-semibold rounded-xl hover:bg-mako-100 dark:hover:bg-white/5 transition-all w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed">
              Cancelar
            </button>
            <button @click="saveWorkerDetails" :disabled="isSavingDetails" class="px-6 py-3.5 bg-primary text-white font-bold text-sm rounded-xl hover:shadow-[0_0_15px_rgba(0,209,94,0.4)] transition-all w-full sm:w-auto disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              <svg v-if="isSavingDetails" class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              {{ isSavingDetails ? 'Guardando...' : 'Guardar Cambios' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal para Editar Accesos -->
    <div v-if="editingWorkerId" class="fixed inset-0 bg-mako-950/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div class="bg-white/95 dark:bg-mako-900/95 border border-mako-200 dark:border-white/10 rounded-[2rem] shadow-2xl w-full max-w-lg p-6 lg:p-8 relative">
        <button @click="cancelEdit" class="absolute top-6 right-6 p-2 rounded-full hover:bg-mako-100 dark:hover:bg-white/10 text-mako-400 transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
        
        <h3 class="text-xl font-bold mb-2 flex items-center gap-3 text-mako-900 dark:text-white">
          <div class="p-2 bg-primary/10 rounded-xl">
            <svg class="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
          </div>
          Gestión de Accesos
        </h3>
        <p class="text-sm text-mako-500 mb-6 ml-11">
          Configurando accesos para <strong class="text-mako-900 dark:text-white">{{ store.workers.find((w) => w.id === editingWorkerId)?.name }}</strong>
        </p>

        <div class="space-y-4 max-h-64 overflow-y-auto custom-scrollbar pr-2">
          <div v-if="store.predios.length > 0" class="bg-mako-50 dark:bg-mako-800/30 p-4 rounded-xl border border-mako-100 dark:border-mako-700/50">
            <p class="text-xs uppercase font-bold text-mako-400 mb-3">ZONAS:</p>
            <div class="space-y-2">
              <label v-for="p in store.predios" :key="p.id" class="flex items-center gap-3 text-sm cursor-pointer group hover:bg-mako-200/50 dark:hover:bg-mako-700/50 p-2 rounded-lg transition-colors">
                <input type="checkbox" v-model="editingPermissions" :value="p.id" class="w-4 h-4 text-primary bg-mako-100 border-mako-300 rounded focus:ring-primary focus:ring-2 dark:bg-mako-800 dark:border-mako-600 accent-primary" />
                <span class="text-mako-700 dark:text-mako-300 group-hover:text-mako-900 dark:group-hover:text-white">{{ p.name }}</span>
              </label>
            </div>
          </div>

          <div v-if="store.cerros.length > 0" class="bg-mako-50 dark:bg-mako-800/30 p-4 rounded-xl border border-mako-100 dark:border-mako-700/50">
            <p class="text-xs uppercase font-bold text-mako-400 mb-3">Cerros Telecom</p>
            <div class="space-y-2">
              <label v-for="c in store.cerros" :key="c.id" class="flex items-center gap-3 text-sm cursor-pointer group hover:bg-mako-200/50 dark:hover:bg-mako-700/50 p-2 rounded-lg transition-colors">
                <input type="checkbox" v-model="editingPermissions" :value="c.id" class="w-4 h-4 text-primary bg-mako-100 border-mako-300 rounded focus:ring-primary focus:ring-2 dark:bg-mako-800 dark:border-mako-600 accent-primary" />
                <span class="text-mako-700 dark:text-mako-300 group-hover:text-mako-900 dark:group-hover:text-white">{{ c.name }}</span>
              </label>
            </div>
          </div>
        </div>

        <div class="pt-4 border-t border-mako-200 dark:border-mako-700/50 flex gap-3 justify-end mt-4">
          <button @click="cancelEdit" :disabled="isSavingPermissions" class="px-5 py-3.5 border border-mako-300 dark:border-mako-700 text-sm font-semibold rounded-xl hover:bg-mako-100 dark:hover:bg-white/5 transition-all w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed">
            Cancelar
          </button>
          <button @click="savePermissions" :disabled="isSavingPermissions" class="px-6 py-3.5 bg-primary text-white font-bold text-sm rounded-xl hover:shadow-[0_0_15px_rgba(0,209,94,0.4)] transition-all w-full sm:w-auto disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            <svg v-if="isSavingPermissions" class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            {{ isSavingPermissions ? 'Guardando...' : 'Guardar Accesos' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
