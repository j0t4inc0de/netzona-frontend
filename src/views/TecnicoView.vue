<script setup>
import { ref } from 'vue'
import { useTelemetricsStore } from '../stores/telemetrics'
import { toast } from 'vue-sonner'

const store = useTelemetricsStore()

// Registro de Cliente
const newClientName = ref('')
const clientSuccessMsg = ref('')

const handleAddClient = async () => {
  if (!newClientName.value.trim()) return
  await store.addClient(newClientName.value.trim())
  toast.success(`Cliente "${newClientName.value}" registrado con éxito.`)
  newClientName.value = ''
}

// Registro de Nodo
const selectedClient = ref('')
const serial = ref('')
const model = ref('')
const nodeType = ref('agricola')
const nodeSuccessMsg = ref('')

const handleRegisterNode = async () => {
  if (!selectedClient.value || !serial.value.trim() || !model.value.trim()) {
    toast.error('Por favor complete todos los campos.')
    return
  }
  
  await store.registerNode(
    serial.value.trim(),
    model.value.trim(),
    nodeType.value,
    selectedClient.value
  )
  
  toast.success(`Nodo ${serial.value} asociado al cliente con éxito.`)
  serial.value = ''
  model.value = ''
}
</script>

<template>
  <div class="space-y-8 max-w-6xl mx-auto">
    <!-- Encabezado de Vista -->
    <div class="flex justify-between items-center">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">Panel Técnico Netzona</h1>
        <p class="text-sm text-mako-500 dark:text-mako-400 mt-1">Aprovisionamiento de nodos, sensores y gestión de clientes.</p>
      </div>
      <div class="px-4 py-2 bg-primary/10 border border-primary/20 rounded-full text-xs font-bold text-primary">
        Rol: Técnico
      </div>
    </div>

    <!-- Bloque de Formularios -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <!-- Tarjeta 1: Aprovisionar Nodo -->
      <div class="p-6 bg-white/85 dark:bg-mako-900/60 backdrop-blur-xl border border-white/40 dark:border-white/5 rounded-[2rem] shadow-lg">
        <h2 class="text-xl font-semibold mb-4 flex items-center gap-2">
          <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Registrar e Instalar Nodo
        </h2>

        <form @submit.prevent="handleRegisterNode" class="space-y-4">
          <div>
            <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">Cliente Destino</label>
            <select
              v-model="selectedClient"
              class="w-full px-4 py-3 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none focus:border-primary text-sm transition-all"
            >
              <option value="" disabled>Seleccione un cliente...</option>
              <option v-for="client in store.clients" :key="client.id" :value="client.id">
                {{ client.name }}
              </option>
            </select>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">Número de Serie</label>
              <input
                v-model="serial"
                type="text"
                placeholder="Ej. SN-AG-999"
                class="w-full px-4 py-3 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none focus:border-primary text-sm transition-all"
              />
            </div>
            <div>
              <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">Modelo de Equipo</label>
              <input
                v-model="model"
                type="text"
                placeholder="Ej. AgroSoil-V2"
                class="w-full px-4 py-3 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none focus:border-primary text-sm transition-all"
              />
            </div>
          </div>

          <div>
            <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">Tipo de Frecuencia/Nodo</label>
            <div class="flex gap-4">
              <label class="flex items-center gap-2 cursor-pointer text-sm">
                <input type="radio" v-model="nodeType" value="agricola" class="accent-primary" />
                Agrícola (Wifi / NB-IoT)
              </label>
              <label class="flex items-center gap-2 cursor-pointer text-sm">
                <input type="radio" v-model="nodeType" value="telecom" class="accent-primary" />
                Radiocomunicaciones (VHF / LoRa)
              </label>
            </div>
          </div>

          <button
            type="submit"
            class="w-full py-3.5 rounded-xl bg-primary text-mako-950 font-bold hover:shadow-[0_0_15px_rgba(0,209,94,0.3)] transition-all duration-300"
          >
            Aprovisionar Nodo a Cliente
          </button>
        </form>
      </div>

      <!-- Tarjeta 2: Registrar Nuevo Cliente -->
      <div class="p-6 bg-white/85 dark:bg-mako-900/60 backdrop-blur-xl border border-white/40 dark:border-white/5 rounded-[2rem] shadow-lg flex flex-col justify-between">
        <div>
          <h2 class="text-xl font-semibold mb-4 flex items-center gap-2">
            <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            Dar de Alta Cliente
          </h2>

          <form @submit.prevent="handleAddClient" class="space-y-4">
            <div>
              <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">Nombre de la Empresa</label>
              <input
                v-model="newClientName"
                type="text"
                placeholder="Ej. Viñedos San Pedro"
                class="w-full px-4 py-3 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none focus:border-primary text-sm transition-all"
              />
            </div>

            <button
              type="submit"
              class="w-full py-3.5 rounded-xl bg-primary text-mako-950 font-bold hover:shadow-[0_0_15px_rgba(0,209,94,0.3)] transition-all duration-300"
            >
              Registrar Cliente
            </button>
          </form>
        </div>

        <!-- Mini Info Informativo -->
        <div class="mt-6 p-4 rounded-2xl bg-mako-100/50 dark:bg-mako-800/20 border border-mako-200 dark:border-white/5 text-xs text-mako-500 dark:text-mako-400">
          <p class="font-bold text-mako-700 dark:text-mako-300 mb-1">💡 Procedimiento de Instalación:</p>
          Una vez instalado físicamente el nodo Lora o Nb-IoT en terreno, el técnico Netzona registra el número de serie único del hardware y lo vincula a la cuenta del cliente para que aparezca disponible en sus tableros.
        </div>
      </div>
    </div>

    <!-- Tabla de Nodos Globales del Sistema -->
    <div class="p-6 bg-white/85 dark:bg-mako-900/60 backdrop-blur-xl border border-white/40 dark:border-white/5 rounded-[2rem] shadow-lg">
      <h2 class="text-xl font-semibold mb-4">Nodos Activos Registrados en el Servidor</h2>

      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="border-b border-mako-200 dark:border-white/5 text-xs uppercase tracking-wider text-mako-400">
              <th class="py-3 px-4">Número Serial</th>
              <th class="py-3 px-4">Modelo</th>
              <th class="py-3 px-4">Tipo</th>
              <th class="py-3 px-4">Cliente Asignado</th>
              <th class="py-3 px-4">Estado Red</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="node in store.globalNodes"
              :key="node.id"
              class="border-b border-mako-100 dark:border-white/5 hover:bg-mako-100/40 dark:hover:bg-white/5 transition-colors text-sm"
            >
              <td class="py-3.5 px-4 font-mono font-semibold">{{ node.serial }}</td>
              <td class="py-3.5 px-4">{{ node.model }}</td>
              <td class="py-3.5 px-4">
                <span
                  class="px-2.5 py-1 rounded-full text-xs font-semibold"
                  :class="node.type === 'agricola' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-blue-500/10 text-blue-500 border border-blue-500/20'"
                >
                  {{ node.type === 'agricola' ? 'Agrícola' : 'Telecom' }}
                </span>
              </td>
              <td class="py-3.5 px-4 font-medium">
                {{ store.clients.find(c => c.id === node.clientId)?.name || 'Sin Asignar' }}
              </td>
              <td class="py-3.5 px-4">
                <span class="inline-flex items-center gap-1.5 text-xs text-green-500 font-semibold">
                  <span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                  Conectado
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
