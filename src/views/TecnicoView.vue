<script setup>
import { ref, onMounted, watch } from 'vue'
import { api } from '../services/api'
import { toast } from 'vue-sonner'

// Estado Global
const isLoading = ref(true)

// Listas de Datos desde Backend
const empresas = ref([])
const sitios = ref([])
const zonas = ref([])
const tiposDispositivo = ref([])
const equipos = ref([])

// Registro de Empresa (Cliente)
const newClientName = ref('')
const newClientCode = ref('')
const newClientRut = ref('')

const fetchEmpresas = async () => {
  try {
    const res = await api('/empresas/clientes/')
    if (res.ok) {
      const data = await res.json()
      empresas.value = data.results || data // dependiendo de paginación DRF
    }
  } catch(e) {}
}

const fetchSitios = async (empresaId) => {
  sitios.value = []
  zonas.value = []
  if (!empresaId) return
  try {
    const res = await api(`/empresas/sitios/?empresa=${empresaId}`)
    if (res.ok) {
      const data = await res.json()
      sitios.value = data.results || data
    }
  } catch(e) {}
}

const fetchZonas = async (sitioId) => {
  zonas.value = []
  if (!sitioId) return
  try {
    const res = await api(`/empresas/zonas/?sitio=${sitioId}`)
    if (res.ok) {
      const data = await res.json()
      zonas.value = data.results || data
    }
  } catch(e) {}
}

const fetchTiposDispositivo = async () => {
  try {
    const res = await api('/dispositivos/tipos/')
    if (res.ok) {
      const data = await res.json()
      tiposDispositivo.value = data.results || data
    }
  } catch(e) {}
}

const fetchEquipos = async () => {
  try {
    const res = await api('/dispositivos/equipos/')
    if (res.ok) {
      const data = await res.json()
      equipos.value = data.results || data
    }
  } catch(e) {}
}

const handleAddClient = async () => {
  if (!newClientName.value.trim() || !newClientCode.value.trim() || !newClientRut.value.trim()) {
    toast.error('Complete todos los campos del cliente.')
    return
  }
  
  try {
    const res = await api('/empresas/clientes/', {
      method: 'POST',
      body: JSON.stringify({
        nombre: newClientName.value.trim(),
        codigo: newClientCode.value.trim(),
        rut: newClientRut.value.trim()
      })
    })
    
    if (res.ok) {
      toast.success(`Cliente "${newClientName.value}" registrado con éxito.`)
      newClientName.value = ''
      newClientCode.value = ''
      newClientRut.value = ''
      fetchEmpresas()
    } else {
      toast.error('Error al registrar cliente. Verifique el código o permisos.')
    }
  } catch(e) {
    toast.error('Error de conexión al registrar cliente.')
  }
}

// Registro de Sitio
const newSitioName = ref('')
const newSitioEmpresa = ref('')

const handleAddSitio = async () => {
  if (!newSitioName.value.trim() || !newSitioEmpresa.value) {
    toast.error('Complete todos los campos del sitio.')
    return
  }
  
  try {
    const res = await api('/empresas/sitios/', {
      method: 'POST',
      body: JSON.stringify({
        nombre: newSitioName.value.trim(),
        empresa: newSitioEmpresa.value
      })
    })
    
    if (res.ok) {
      toast.success(`Sitio "${newSitioName.value}" registrado con éxito.`)
      newSitioName.value = ''
      if (selectedEmpresa.value === newSitioEmpresa.value) {
        fetchSitios(selectedEmpresa.value)
      }
    } else {
      toast.error('Error al registrar sitio.')
    }
  } catch(e) {
    toast.error('Error de conexión al registrar sitio.')
  }
}

// Registro de Zona
const newZonaName = ref('')
const newZonaEmpresa = ref('')
const newZonaSitio = ref('')
const zonasSitios = ref([])

watch(newZonaEmpresa, async (newVal) => {
  newZonaSitio.value = ''
  zonasSitios.value = []
  if (!newVal) return
  try {
    const res = await api(`/empresas/sitios/?empresa=${newVal}`)
    if (res.ok) {
      const data = await res.json()
      zonasSitios.value = data.results || data
    }
  } catch(e) {}
})

const handleAddZona = async () => {
  if (!newZonaName.value.trim() || !newZonaSitio.value) {
    toast.error('Complete todos los campos de la zona.')
    return
  }
  
  try {
    const res = await api('/empresas/zonas/', {
      method: 'POST',
      body: JSON.stringify({
        nombre: newZonaName.value.trim(),
        sitio: newZonaSitio.value
      })
    })
    
    if (res.ok) {
      toast.success(`Zona "${newZonaName.value}" registrada con éxito.`)
      newZonaName.value = ''
      if (selectedSitio.value === newZonaSitio.value) {
        fetchZonas(selectedSitio.value)
      }
    } else {
      toast.error('Error al registrar zona.')
    }
  } catch(e) {
    toast.error('Error de conexión al registrar zona.')
  }
}

// Registro de Dispositivo (Nodo)
const selectedEmpresa = ref('')
const selectedSitio = ref('')
const selectedZona = ref('')
const selectedTipoDispositivo = ref('')
const serial = ref('')
const deviceName = ref('')

watch(selectedEmpresa, (newVal) => {
  selectedSitio.value = ''
  selectedZona.value = ''
  fetchSitios(newVal)
})

watch(selectedSitio, (newVal) => {
  selectedZona.value = ''
  fetchZonas(newVal)
})

const handleRegisterNode = async () => {
  if (!selectedEmpresa.value || !selectedSitio.value || !selectedZona.value || !selectedTipoDispositivo.value || !serial.value.trim() || !deviceName.value.trim()) {
    toast.error('Por favor complete todos los campos obligatorios, incluyendo la zona.')
    return
  }
  
  // Validar Regex SN (A-Za-z0-9_-)
  const regex = /^[A-Za-z0-9_-]+$/
  if (!regex.test(serial.value.trim())) {
    toast.error('El Serial solo puede contener letras, números, guiones o guiones bajos.')
    return
  }
  
  try {
    const payload = {
      empresa: selectedEmpresa.value,
      sitio: selectedSitio.value,
      zona: selectedZona.value,
      tipo_dispositivo: selectedTipoDispositivo.value,
      serial: serial.value.trim(),
      nombre: deviceName.value.trim()
    }
    
    const res = await api('/dispositivos/equipos/', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
    
    if (res.ok) {
      toast.success(`Nodo ${serial.value} provisionado con éxito.`)
      serial.value = ''
      deviceName.value = ''
      fetchEquipos()
    } else {
      const errorData = await res.json()
      toast.error('Error al registrar: ' + JSON.stringify(errorData))
    }
  } catch(e) {
    toast.error('Error de conexión al registrar dispositivo.')
  }
}

onMounted(async () => {
  await Promise.all([
    fetchEmpresas(),
    fetchTiposDispositivo(),
    fetchEquipos()
  ])
  isLoading.value = false
})
</script>

<template>
  <div class="space-y-8 max-w-6xl mx-auto">
    <!-- Encabezado de Vista -->
    <div class="flex justify-between items-center">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">Gestor de Dispositivos (Técnico)</h1>
        <p class="text-sm text-mako-500 dark:text-mako-400 mt-1">Aprovisionamiento de nodos, asignación a zonas y clientes.</p>
      </div>
      <div class="px-4 py-2 bg-primary/10 border border-primary/20 rounded-full text-xs font-bold text-primary">
        Rol: Técnico
      </div>
    </div>

    <!-- Bloque de Formularios -->
    <div class="grid grid-cols-1 xl:grid-cols-2 gap-8">
      
      <!-- Tarjeta 1: Aprovisionar Nodo -->
      <div class="p-6 bg-white/85 dark:bg-mako-900/60 backdrop-blur-xl border border-white/40 dark:border-white/5 rounded-[2rem] shadow-lg">
        <h2 class="text-xl font-semibold mb-4 flex items-center gap-2">
          <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Registrar e Instalar Dispositivo
        </h2>

        <form @submit.prevent="handleRegisterNode" class="space-y-4">
          <!-- Cascada: Empresa -> Sitio -> Zona -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">1. Empresa</label>
              <select v-model="selectedEmpresa" class="w-full px-4 py-3 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none focus:border-primary text-sm">
                <option value="" disabled>Seleccione...</option>
                <option v-for="empresa in empresas" :key="empresa.id" :value="empresa.id">{{ empresa.nombre }}</option>
              </select>
            </div>
            <div>
              <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">2. Sitio</label>
              <select v-model="selectedSitio" :disabled="!selectedEmpresa" class="w-full px-4 py-3 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none focus:border-primary text-sm disabled:opacity-50">
                <option value="" disabled>Seleccione...</option>
                <option v-for="sitio in sitios" :key="sitio.id" :value="sitio.id">{{ sitio.nombre }}</option>
              </select>
            </div>
            <div>
              <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">3. Zona</label>
              <select v-model="selectedZona" :disabled="!selectedSitio" class="w-full px-4 py-3 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none focus:border-primary text-sm disabled:opacity-50">
                <option value="" disabled>Seleccione...</option>
                <option v-for="zona in zonas" :key="zona.id" :value="zona.id">{{ zona.nombre }}</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">Número de Serie</label>
              <input v-model="serial" type="text" placeholder="Ej. SN_AG_999" class="w-full px-4 py-3 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none focus:border-primary text-sm font-mono" />
              <p class="text-[10px] text-mako-400 mt-1">Letras, números y guiones permitidos.</p>
            </div>
            <div>
              <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">Nombre del Nodo</label>
              <input v-model="deviceName" type="text" placeholder="Ej. Estación Clima Norte" class="w-full px-4 py-3 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none focus:border-primary text-sm" />
            </div>
          </div>

          <div>
            <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">Tipo de Dispositivo</label>
            <select v-model="selectedTipoDispositivo" class="w-full px-4 py-3 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none focus:border-primary text-sm">
              <option value="" disabled>Seleccione el modelo o tipo...</option>
              <option v-for="tipo in tiposDispositivo" :key="tipo.id" :value="tipo.id">{{ tipo.nombre }} ({{ tipo.modelo }})</option>
            </select>
          </div>

          <button type="submit" class="w-full py-3.5 rounded-xl bg-primary text-mako-950 font-bold hover:shadow-[0_0_15px_rgba(0,209,94,0.3)] transition-all duration-300 mt-4">
            Registrar e Instalar Dispositivo
          </button>
        </form>
      </div>

      <!-- Tarjeta 2: Registrar Nuevo Cliente (Empresa) -->
      <div class="p-6 bg-white/85 dark:bg-mako-900/60 backdrop-blur-xl border border-white/40 dark:border-white/5 rounded-[2rem] shadow-lg flex flex-col justify-between">
        <div>
          <h2 class="text-xl font-semibold mb-4 flex items-center gap-2">
            <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            Dar de Alta Cliente (Empresa)
          </h2>

          <form @submit.prevent="handleAddClient" class="space-y-4">
            <div>
              <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">Nombre Legal</label>
              <input v-model="newClientName" type="text" placeholder="Ej. Viñedos San Pedro S.A." class="w-full px-4 py-3 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none focus:border-primary text-sm" />
            </div>
            
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">RUT / Identificador</label>
                <input v-model="newClientRut" type="text" placeholder="Ej. 76.543.210-K" class="w-full px-4 py-3 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none focus:border-primary text-sm" />
              </div>
              <div>
                <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">Código Único</label>
                <input v-model="newClientCode" type="text" placeholder="Ej. VIN-SP" class="w-full px-4 py-3 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none focus:border-primary text-sm font-mono" />
              </div>
            </div>

            <button type="submit" class="w-full py-3.5 rounded-xl bg-primary text-mako-950 font-bold hover:shadow-[0_0_15px_rgba(0,209,94,0.3)] transition-all duration-300">
              Registrar Cliente
            </button>
          </form>
        </div>

        <div class="mt-6 p-4 rounded-2xl bg-mako-100/50 dark:bg-mako-800/20 border border-mako-200 dark:border-white/5 text-xs text-mako-500 dark:text-mako-400">
          <p class="font-bold text-mako-700 dark:text-mako-300 mb-1">💡 Flujo de Creación MQTT:</p>
          Al aprovisionar un nodo de forma completa, el backend genera automáticamente el tópico MQTT en base a los códigos de la Empresa, Sitio y Zona elegidas.
        </div>
      </div>
      
      <!-- Tarjeta 3: Registrar Nuevo Sitio -->
      <div class="p-6 bg-white/85 dark:bg-mako-900/60 backdrop-blur-xl border border-white/40 dark:border-white/5 rounded-[2rem] shadow-lg flex flex-col justify-between">
        <div>
          <h2 class="text-xl font-semibold mb-4 flex items-center gap-2">
            <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Crear Sitio (Predio o Cerro)
          </h2>

          <form @submit.prevent="handleAddSitio" class="space-y-4">
            <div>
              <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">Empresa Cliente</label>
              <select v-model="newSitioEmpresa" class="w-full px-4 py-3 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none focus:border-primary text-sm">
                <option value="" disabled>Seleccione...</option>
                <option v-for="empresa in empresas" :key="empresa.id" :value="empresa.id">{{ empresa.nombre }}</option>
              </select>
            </div>
            
            <div>
              <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">Nombre del Sitio</label>
              <input v-model="newSitioName" type="text" placeholder="Ej. Fundo El Carmen / Cerro Caracol" class="w-full px-4 py-3 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none focus:border-primary text-sm" />
            </div>

            <button type="submit" class="w-full py-3.5 rounded-xl bg-primary text-mako-950 font-bold hover:shadow-[0_0_15px_rgba(0,209,94,0.3)] transition-all duration-300">
              Registrar Sitio
            </button>
          </form>
        </div>
      </div>

      <!-- Tarjeta 4: Registrar Nueva Zona -->
      <div class="p-6 bg-white/85 dark:bg-mako-900/60 backdrop-blur-xl border border-white/40 dark:border-white/5 rounded-[2rem] shadow-lg flex flex-col justify-between">
        <div>
          <h2 class="text-xl font-semibold mb-4 flex items-center gap-2">
            <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
            </svg>
            Crear Zona (Sector o Caseta)
          </h2>

          <form @submit.prevent="handleAddZona" class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">Empresa</label>
                <select v-model="newZonaEmpresa" class="w-full px-4 py-3 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none focus:border-primary text-sm">
                  <option value="" disabled>Seleccione...</option>
                  <option v-for="empresa in empresas" :key="empresa.id" :value="empresa.id">{{ empresa.nombre }}</option>
                </select>
              </div>
              <div>
                <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">Sitio</label>
                <select v-model="newZonaSitio" :disabled="!newZonaEmpresa" class="w-full px-4 py-3 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none focus:border-primary text-sm disabled:opacity-50">
                  <option value="" disabled>Seleccione...</option>
                  <option v-for="sitio in zonasSitios" :key="sitio.id" :value="sitio.id">{{ sitio.nombre }}</option>
                </select>
              </div>
            </div>
            
            <div>
              <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">Nombre de la Zona</label>
              <input v-model="newZonaName" type="text" placeholder="Ej. Sector Norte / Caseta 1" class="w-full px-4 py-3 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none focus:border-primary text-sm" />
            </div>

            <button type="submit" class="w-full py-3.5 rounded-xl bg-primary text-mako-950 font-bold hover:shadow-[0_0_15px_rgba(0,209,94,0.3)] transition-all duration-300">
              Registrar Zona
            </button>
          </form>
        </div>
      </div>

    <!-- Tabla de Nodos Globales del Sistema -->
    <div class="p-6 bg-white/85 dark:bg-mako-900/60 backdrop-blur-xl border border-white/40 dark:border-white/5 rounded-[2rem] shadow-lg">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-semibold">Equipos Activos Registrados</h2>
        <button @click="fetchEquipos" class="px-3 py-1.5 text-xs font-bold bg-mako-200 dark:bg-mako-800 hover:bg-mako-300 dark:hover:bg-mako-700 rounded-lg transition-colors flex items-center gap-2">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          Actualizar
        </button>
      </div>

      <AppLoader v-if="isLoading" />

      <div v-else class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="border-b border-mako-200 dark:border-white/5 text-xs uppercase tracking-wider text-mako-400">
              <th class="py-3 px-4">Serial / Equipo</th>
              <th class="py-3 px-4">Ubicación (Tópico MQTT)</th>
              <th class="py-3 px-4">Tipo</th>
              <th class="py-3 px-4">Estado Red</th>
              <th class="py-3 px-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="equipos.length === 0">
              <td colspan="5" class="py-8 text-center text-mako-400 italic">No hay equipos registrados en el backend.</td>
            </tr>
            <tr v-for="node in equipos" :key="node.id" class="border-b border-mako-100 dark:border-white/5 hover:bg-mako-100/40 dark:hover:bg-white/5 transition-colors text-sm">
              <td class="py-3.5 px-4">
                <div class="font-mono font-bold text-primary">{{ node.serial }}</div>
                <div class="text-xs text-mako-500 mt-0.5">{{ node.nombre }}</div>
              </td>
              <td class="py-3.5 px-4 font-medium">
                <div class="text-xs max-w-xs truncate text-mako-500 font-mono" :title="node.mqtt_topic">
                  {{ node.mqtt_topic || 'Pendiente' }}
                </div>
              </td>
              <td class="py-3.5 px-4">
                <span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-mako-200 dark:bg-mako-800">
                  {{ tiposDispositivo.find(t => t.id === node.tipo_dispositivo)?.nombre || 'Sensor' }}
                </span>
              </td>
              <td class="py-3.5 px-4">
                <span v-if="node.activo" class="inline-flex items-center gap-1.5 text-xs text-green-500 font-semibold">
                  <span class="w-1.5 h-1.5 rounded-full bg-green-500"></span> Activo
                </span>
                <span v-else class="inline-flex items-center gap-1.5 text-xs text-red-500 font-semibold">
                  <span class="w-1.5 h-1.5 rounded-full bg-red-500"></span> Inactivo
                </span>
              </td>
              <td class="py-3.5 px-4 text-right">
                <button class="text-xs font-bold text-blue-500 hover:text-blue-400 transition-colors">Ver Sensores</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    </div>
  </div>
</template>
