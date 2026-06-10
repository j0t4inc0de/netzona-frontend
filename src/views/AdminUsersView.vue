<script setup>
import { ref } from 'vue'
import { useTelemetricsStore } from '../stores/telemetrics'
import { toast } from 'vue-sonner'

const store = useTelemetricsStore()

// Formulario de Trabajador Nuevo
const workerName = ref('')
const workerUsername = ref('')
const selectedPermissions = ref([])
const successMsg = ref('')

const handleAddWorker = async () => {
  if (!workerName.value.trim() || !workerUsername.value.trim()) {
    toast.error('Por favor complete todos los datos.')
    return
  }

  await store.addWorker(workerName.value.trim(), workerUsername.value.trim(), selectedPermissions.value)

  toast.success(`Trabajador "${workerName.value}" registrado con éxito.`)
  workerName.value = ''
  workerUsername.value = ''
  selectedPermissions.value = []
}

const handleRemoveWorker = async (id) => {
  if (confirm('¿Está seguro de eliminar este trabajador?')) {
    await store.removeWorker(id)
    toast.success('Trabajador eliminado correctamente')
  }
}

// Edición de Permisos de un Trabajador en particular
const editingWorkerId = ref(null)
const editingPermissions = ref([])

const startEditPermissions = (worker) => {
  editingWorkerId.value = worker.id
  editingPermissions.value = [...worker.permissions]
}

const savePermissions = async () => {
  await store.updateWorkerPermissions(editingWorkerId.value, editingPermissions.value)
  toast.success('Accesos actualizados correctamente')
  editingWorkerId.value = null
  editingPermissions.value = []
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
        Rol: Cliente Administrador
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
            Agregar Trabajador
          </h2>

          <form @submit.prevent="handleAddWorker" class="space-y-4">
            <div>
              <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5"
                >Nombre Completo</label
              >
              <input
                v-model="workerName"
                type="text"
                placeholder="Ej. Pedro Díaz"
                class="w-full px-4 py-3 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none focus:border-primary text-sm transition-all"
              />
            </div>

            <div>
              <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5"
                >Nombre de Usuario</label
              >
              <input
                v-model="workerUsername"
                type="text"
                placeholder="Ej. pedro.diaz"
                class="w-full px-4 py-3 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none focus:border-primary text-sm transition-all"
              />
            </div>

            <!-- Asignación de Permisos -->
            <div>
              <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-2"
                >Permisos de Visualización</label
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
              Registrar Trabajador
            </button>
          </form>
        </div>
      </div>

      <!-- Listado de Trabajadores -->
      <div
        class="lg:col-span-2 p-6 bg-white/85 dark:bg-mako-900/60 backdrop-blur-xl border border-white/40 dark:border-white/5 rounded-[2rem] shadow-lg flex flex-col justify-between"
      >
        <div>
          <h2 class="text-xl font-semibold mb-4">Trabajadores Autorizados</h2>

          <!-- Modal o Sección de edición rápida inline -->
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
                  <th class="py-3 px-4">Trabajador</th>
                  <th class="py-3 px-4">Usuario</th>
                  <th class="py-3 px-4">Accesos Autorizados</th>
                  <th class="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="w in store.workers"
                  :key="w.id"
                  class="border-b border-mako-100 dark:border-white/5 hover:bg-mako-100/40 dark:hover:bg-white/5 transition-colors text-sm"
                >
                  <td class="py-3.5 px-4 font-semibold">{{ w.name }}</td>
                  <td class="py-3.5 px-4 font-mono text-xs text-mako-500 dark:text-mako-400">
                    {{ w.username }}
                  </td>
                  <td class="py-3.5 px-4 text-xs">
                    <span class="text-mako-700 dark:text-mako-300 font-medium">
                      {{ getPermissionNames(w.permissions) }}
                    </span>
                  </td>
                  <td class="py-3.5 px-4 text-right space-x-2">
                    <button
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
                <tr v-if="store.workers.length === 0">
                  <td colspan="4" class="text-center py-6 text-mako-400 italic">
                    No hay trabajadores registrados.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
