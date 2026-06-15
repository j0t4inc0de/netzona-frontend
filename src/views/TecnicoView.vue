<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { api } from '../services/api'
import { toast } from 'vue-sonner'

// Estado Global
const isLoading = ref(true)
const activeTab = ref('nodos') // 'nodos', 'estructura', 'mqtt'
const activeEstructuraSubTab = ref('clientes') // 'clientes', 'sitios', 'zonas'

// Listas de Datos desde Backend
const empresas = ref([])
const sitios = ref([])
const zonas = ref([])
const tiposDispositivo = ref([])
const equipos = ref([])

// MQTT Diagnostic States
const mqttPayloads = ref([])
const isMqttLoading = ref(false)

const fetchMqttPayloads = async () => {
  isMqttLoading.value = true
  try {
    const res = await api('/telemetria/payloads-mqtt/')
    if (res.ok) {
      const data = await res.json()
      mqttPayloads.value = data.results || data
    }
  } catch (e) {
    console.error(e)
  } finally {
    isMqttLoading.value = false
  }
}

// Modales
const isAddNodeModalOpen = ref(false)
const isAddClientModalOpen = ref(false)
const isAddSitioModalOpen = ref(false)
const isAddZonaModalOpen = ref(false)

// Edición y Eliminación de Estructura (Inline)
const editingClientId = ref(null)
const editingClientName = ref('')
const editingClientRut = ref('')
const editingClientCode = ref('')

const editingSitioId = ref(null)
const editingSitioName = ref('')

const editingZonaId = ref(null)
const editingZonaName = ref('')

const handleDeleteClient = async (id) => {
  if (!confirm('¿Está seguro de eliminar esta empresa cliente? Se desactivará del sistema.')) return
  try {
    const res = await api(`/empresas/clientes/${id}/`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Cliente eliminado correctamente.')
      await fetchEmpresas()
    } else {
      toast.error('Error al eliminar cliente.')
    }
  } catch {
    toast.error('Error de conexión.')
  }
}

const startEditClient = (empresa) => {
  editingClientId.value = empresa.id
  editingClientName.value = empresa.nombre
  editingClientRut.value = empresa.rut
  editingClientCode.value = empresa.codigo
}

const handleUpdateClient = async () => {
  try {
    const res = await api(`/empresas/clientes/${editingClientId.value}/`, {
      method: 'PUT',
      body: JSON.stringify({
        nombre: editingClientName.value,
        rut: editingClientRut.value,
        codigo: editingClientCode.value,
        activo: true
      })
    })
    if (res.ok) {
      toast.success('Cliente actualizado con éxito.')
      editingClientId.value = null
      await fetchEmpresas()
    } else {
      toast.error('Error al actualizar cliente.')
    }
  } catch {
    toast.error('Error de conexión.')
  }
}

const handleDeleteSitio = async (id) => {
  if (!confirm('¿Está seguro de eliminar este sitio?')) return
  try {
    const res = await api(`/empresas/sitios/${id}/`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Sitio eliminado correctamente.')
      if (selectedEmpresaForSitios.value) {
        await fetchSitios(selectedEmpresaForSitios.value)
      }
    } else {
      toast.error('Error al eliminar sitio.')
    }
  } catch {
    toast.error('Error de conexión.')
  }
}

const startEditSitio = (sitio) => {
  editingSitioId.value = sitio.id
  editingSitioName.value = sitio.nombre
}

const handleUpdateSitio = async (empresaId) => {
  try {
    const res = await api(`/empresas/sitios/${editingSitioId.value}/`, {
      method: 'PUT',
      body: JSON.stringify({
        nombre: editingSitioName.value,
        empresa: empresaId
      })
    })
    if (res.ok) {
      toast.success('Sitio actualizado con éxito.')
      editingSitioId.value = null
      if (selectedEmpresaForSitios.value) {
        await fetchSitios(selectedEmpresaForSitios.value)
      }
    } else {
      toast.error('Error al actualizar sitio.')
    }
  } catch {
    toast.error('Error de conexión.')
  }
}

const handleDeleteZona = async (id) => {
  if (!confirm('¿Está seguro de eliminar esta zona?')) return
  try {
    const res = await api(`/empresas/zonas/${id}/`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Zona eliminada correctamente.')
      if (selectedSitioForZonas.value) {
        await fetchZonas(selectedSitioForZonas.value)
      }
    } else {
      toast.error('Error al eliminar zona.')
    }
  } catch {
    toast.error('Error de conexión.')
  }
}

const startEditZona = (zona) => {
  editingZonaId.value = zona.id
  editingZonaName.value = zona.nombre
}

const handleUpdateZona = async (sitioId) => {
  try {
    const res = await api(`/empresas/zonas/${editingZonaId.value}/`, {
      method: 'PUT',
      body: JSON.stringify({
        nombre: editingZonaName.value,
        sitio: sitioId
      })
    })
    if (res.ok) {
      toast.success('Zona actualizada con éxito.')
      editingZonaId.value = null
      if (selectedSitioForZonas.value) {
        await fetchZonas(selectedSitioForZonas.value)
      }
    } else {
      toast.error('Error al actualizar zona.')
    }
  } catch {
    toast.error('Error de conexión.')
  }
}

// Filtros para Tablas de Estructura
const selectedEmpresaForSitios = ref('')
const selectedEmpresaForZonas = ref('')
const selectedSitioForZonas = ref('')

watch(selectedEmpresaForSitios, (newVal) => {
  if(newVal) fetchSitios(newVal)
})

watch(selectedEmpresaForZonas, (newVal) => {
  selectedSitioForZonas.value = ''
  if(newVal) fetchSitios(newVal, true) // fetch for dropdowns
})

watch(selectedSitioForZonas, (newVal) => {
  if(newVal) fetchZonas(newVal)
})

// Variables para Formularios
const newClientName = ref('')
const newClientCode = ref('')
const newClientRut = ref('')

const newSitioEmpresa = ref('')
const newSitioName = ref('')

const newZonaEmpresa = ref('')
const newZonaSitio = ref('')
const newZonaName = ref('')
const zonasSitios = ref([]) // Sitios para el form de Zonas

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
  } catch (error) {
    console.error(error)
  }
})

// Funciones de Fetching
const fetchEmpresas = async () => {
  try {
    const res = await api('/empresas/clientes/')
    if (res.ok) {
      const data = await res.json()
      empresas.value = data.results || data
    }
  } catch (error) {
    console.error('Error al obtener empresas:', error)
  }
}

const fetchSitios = async (empresaId, isForZonasForm = false) => {
  if (!isForZonasForm) sitios.value = []
  if (!empresaId) return
  try {
    const res = await api(`/empresas/sitios/?empresa=${empresaId}`)
    if (res.ok) {
      const data = await res.json()
      if (!isForZonasForm) {
        sitios.value = data.results || data
      }
    }
  } catch (error) {
    console.error('Error al obtener sitios:', error)
  }
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
  } catch (error) {
    console.error('Error al obtener zonas:', error)
  }
}

const fetchTiposDispositivo = async () => {
  try {
    const res = await api('/dispositivos/tipos/')
    if (res.ok) {
      const data = await res.json()
      tiposDispositivo.value = data.results || data
    }
  } catch (error) {
    console.error('Error al obtener tipos de dispositivo:', error)
  }
}

const fetchEquipos = async () => {
  try {
    const res = await api('/dispositivos/equipos/')
    if (res.ok) {
      const data = await res.json()
      equipos.value = data.results || data
    }
  } catch (error) {
    console.error('Error al obtener equipos:', error)
  }
}

// Handlers de Submit (Creación)
const handleAddClient = async () => {
  if (!newClientName.value.trim() || !newClientCode.value.trim() || !newClientRut.value.trim()) {
    toast.error('Complete todos los campos para la empresa.')
    return
  }
  try {
    const res = await api('/empresas/clientes/', {
      method: 'POST',
      body: JSON.stringify({
        nombre: newClientName.value.trim(),
        rut: newClientRut.value.trim(),
        codigo: newClientCode.value.trim(),
        activo: true
      })
    })
    if (res.ok) {
      toast.success(`Cliente "${newClientName.value}" registrado con éxito.`)
      newClientName.value = ''
      newClientCode.value = ''
      newClientRut.value = ''
      isAddClientModalOpen.value = false
      await fetchEmpresas()
    } else {
      toast.error('Error al registrar cliente.')
    }
  } catch {
    toast.error('Error de conexión.')
  }
}

const handleAddSitio = async () => {
  if (!newSitioEmpresa.value || !newSitioName.value.trim()) {
    toast.error('Complete la empresa y el nombre del sitio.')
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
      isAddSitioModalOpen.value = false
      if (selectedEmpresaForSitios.value === newSitioEmpresa.value) {
        fetchSitios(selectedEmpresaForSitios.value)
      }
    } else {
      toast.error('Error al registrar sitio.')
    }
  } catch {
    toast.error('Error de conexión al registrar sitio.')
  }
}

const handleAddZona = async () => {
  if (!newZonaEmpresa.value || !newZonaSitio.value || !newZonaName.value.trim()) {
    toast.error('Seleccione empresa, sitio y asigne un nombre a la zona.')
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
      isAddZonaModalOpen.value = false
      if (selectedSitioForZonas.value === newZonaSitio.value) {
        fetchZonas(selectedSitioForZonas.value)
      }
    } else {
      toast.error('Error al registrar zona.')
    }
  } catch {
    toast.error('Error de conexión al registrar zona.')
  }
}

// Formulario Nodo
const formSelectedEmpresa = ref('')
const formSelectedSitio = ref('')
const formSelectedZona = ref('')
const formSelectedTipoDispositivo = ref('')
const serial = ref('')
const deviceName = ref('')
const formSitios = ref([])
const formZonas = ref([])

watch(formSelectedEmpresa, async (newVal) => {
  formSelectedSitio.value = ''
  formSelectedZona.value = ''
  formSitios.value = []
  if (!newVal) return
  const res = await api(`/empresas/sitios/?empresa=${newVal}`)
  if (res.ok) {
    const data = await res.json()
    formSitios.value = data.results || data
  }
})

watch(formSelectedSitio, async (newVal) => {
  formSelectedZona.value = ''
  formZonas.value = []
  if (!newVal) return
  const res = await api(`/empresas/zonas/?sitio=${newVal}`)
  if (res.ok) {
    const data = await res.json()
    formZonas.value = data.results || data
  }
})

const handleRegisterNode = async () => {
  if (!formSelectedEmpresa.value || !formSelectedSitio.value || !formSelectedZona.value || !formSelectedTipoDispositivo.value || !serial.value.trim() || !deviceName.value.trim()) {
    toast.error('Por favor complete todos los campos obligatorios.')
    return
  }
  const regex = /^[A-Za-z0-9_-]+$/
  if (!regex.test(serial.value.trim())) {
    toast.error('El Serial solo puede contener letras, números, guiones o guiones bajos.')
    return
  }
  try {
    const payload = {
      empresa: formSelectedEmpresa.value,
      sitio: formSelectedSitio.value,
      zona: formSelectedZona.value,
      tipo_dispositivo: formSelectedTipoDispositivo.value,
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
      isAddNodeModalOpen.value = false
      fetchEquipos()
    } else {
      const errorData = await res.json()
      toast.error('Error al registrar: ' + JSON.stringify(errorData))
    }
  } catch (error) {
    console.error(error)
    toast.error('Error de conexión al registrar dispositivo.')
  }
}

onMounted(async () => {
  await Promise.all([
    fetchEmpresas(),
    fetchTiposDispositivo(),
    fetchEquipos(),
    fetchMqttPayloads()
  ])
  isLoading.value = false
})

const getPrimaryActionLabel = computed(() => {
  if (activeTab.value === 'nodos') return 'Nuevo Dispositivo'
  if (activeTab.value === 'estructura') {
    if (activeEstructuraSubTab.value === 'clientes') return 'Nueva Empresa'
    if (activeEstructuraSubTab.value === 'sitios') return 'Nuevo Sitio'
    if (activeEstructuraSubTab.value === 'zonas') return 'Nueva Zona'
  }
  return null
})

const openActiveModal = () => {
  if (activeTab.value === 'nodos') isAddNodeModalOpen.value = true
  else if (activeTab.value === 'estructura') {
    if (activeEstructuraSubTab.value === 'clientes') isAddClientModalOpen.value = true
    if (activeEstructuraSubTab.value === 'sitios') isAddSitioModalOpen.value = true
    if (activeEstructuraSubTab.value === 'zonas') isAddZonaModalOpen.value = true
  }
}

</script>

<template>
  <div class="space-y-6 max-w-7xl mx-auto">
    <!-- Navbar / Header Area -->
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/85 dark:bg-mako-900/60 backdrop-blur-xl border border-white/40 dark:border-white/5 rounded-[2rem] p-6 shadow-sm">
      <div class="flex items-center gap-4">
        <div class="p-3 bg-primary/10 rounded-2xl hidden sm:block">
          <svg class="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"></path></svg>
        </div>
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-mako-900 dark:text-white">Gestión de Dispositivos</h1>
          <p class="text-sm text-mako-500 dark:text-mako-400 mt-0.5">
            Aprovisionamiento, diagnóstico y estructura jerárquica.
          </p>
        </div>
      </div>
      
      <div class="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
        <div class="px-5 py-2.5 bg-mako-100 dark:bg-mako-800 rounded-xl text-xs font-semibold text-mako-600 dark:text-mako-300 w-full sm:w-auto text-center border border-mako-200 dark:border-mako-700">
          Rol: <span class="text-primary font-bold">Admin Netzona</span>
        </div>
        <button
          v-if="getPrimaryActionLabel"
          @click="openActiveModal"
          class="rounded-xl relative w-full sm:w-52 h-12 cursor-pointer flex items-center border border-primary bg-primary group overflow-hidden transition-all hover:shadow-[0_0_20px_rgba(0,209,94,0.4)]"
        >
          <span class="text-white font-bold w-full text-center sm:text-left sm:ml-5 transform group-hover:translate-x-40 transition-all duration-300 text-sm">
            {{ getPrimaryActionLabel }}
          </span>
          <span class="absolute right-0 h-full w-12 rounded-xl bg-primary flex items-center justify-center transform group-hover:translate-x-0 group-hover:w-full transition-all duration-300">
            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24"><line x1="12" x2="12" y1="5" y2="19"></line><line x1="5" x2="19" y1="12" y2="12"></line></svg>
          </span>
        </button>
      </div>
    </div>

    <!-- Navegación de Pestañas Principales -->
    <div class="flex border-b border-mako-200 dark:border-white/5 gap-4 sm:gap-8 overflow-x-auto whitespace-nowrap scrollbar-hide py-1 px-2">
      <button
        @click="activeTab = 'nodos'"
        class="py-3 px-2 text-sm font-bold border-b-2 transition-all outline-none shrink-0"
        :class="activeTab === 'nodos' ? 'border-primary text-primary' : 'border-transparent text-mako-400 hover:text-mako-600 dark:hover:text-white'"
      >
        Equipos Aprovisionados
      </button>
      <button
        @click="activeTab = 'estructura'"
        class="py-3 px-2 text-sm font-bold border-b-2 transition-all outline-none shrink-0"
        :class="activeTab === 'estructura' ? 'border-primary text-primary' : 'border-transparent text-mako-400 hover:text-mako-600 dark:hover:text-white'"
      >
        Estructura del Sistema
      </button>
      <button
        @click="activeTab = 'mqtt'"
        class="py-3 px-2 text-sm font-bold border-b-2 transition-all outline-none shrink-0"
        :class="activeTab === 'mqtt' ? 'border-primary text-primary' : 'border-transparent text-mako-400 hover:text-mako-600 dark:hover:text-white'"
      >
        Diagnóstico MQTT
      </button>
    </div>

    <!-- PESTAÑA: EQUIPOS APROVISIONADOS -->
    <div v-if="activeTab === 'nodos'" class="bg-white/85 dark:bg-mako-900/60 backdrop-blur-xl border border-white/40 dark:border-white/5 rounded-[2rem] shadow-sm overflow-hidden animate-fade-in">
      <div class="flex justify-between items-center p-6 border-b border-mako-100 dark:border-white/5">
        <h2 class="text-lg font-bold text-mako-900 dark:text-white">Inventario de Nodos</h2>
        <button @click="fetchEquipos" class="p-2 text-mako-500 hover:text-primary transition-colors bg-mako-100/50 dark:bg-mako-800 rounded-xl" title="Actualizar">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
        </button>
      </div>

      <div v-if="equipos.length === 0 && !isLoading" class="p-16 text-center">
        <svg class="w-16 h-16 text-mako-300 dark:text-mako-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"></path></svg>
        <h3 class="text-lg font-semibold text-mako-600 dark:text-mako-300">No hay equipos registrados</h3>
      </div>

      <div v-else class="overflow-x-auto custom-scrollbar">
        <table class="w-full text-left whitespace-nowrap block sm:table">
          <thead class="hidden sm:table-header-group bg-mako-50 dark:bg-mako-800/50 border-b border-mako-100 dark:border-mako-700/50">
            <tr class="text-[11px] uppercase tracking-widest text-mako-500 dark:text-mako-400 font-bold">
              <th class="px-6 py-4">Equipo / Serial</th>
              <th class="px-6 py-4">Ubicación (Tópico MQTT)</th>
              <th class="px-6 py-4">Tipo</th>
              <th class="px-6 py-4 text-right">Estado</th>
            </tr>
          </thead>
          <tbody class="flex flex-col sm:table-row-group divide-y divide-mako-100 dark:divide-mako-800/60 p-4 sm:p-0">
            <tr v-for="node in equipos" :key="node.id" class="block sm:table-row hover:bg-mako-50/50 dark:hover:bg-white/5 transition-colors group bg-white dark:bg-mako-800/40 sm:bg-transparent rounded-2xl sm:rounded-none border border-mako-100 dark:border-mako-700/50 sm:border-0 overflow-hidden mb-4 sm:mb-0">
              <td class="block sm:table-cell px-4 py-4 sm:px-6">
                <div class="font-mono font-bold text-primary">{{ node.serial }}</div>
                <div class="text-xs text-mako-500 font-medium mt-0.5">{{ node.nombre }}</div>
              </td>
              <td class="flex sm:table-cell justify-between items-center px-4 py-3 sm:px-6 sm:py-4 border-t border-mako-50 dark:border-mako-700/30 sm:border-0">
                <span class="text-[10px] font-bold text-mako-400 uppercase sm:hidden">Tópico</span>
                <div class="text-xs max-w-[200px] sm:max-w-xs truncate text-mako-600 dark:text-mako-300 font-mono bg-mako-100/50 dark:bg-mako-800/50 px-3 py-1.5 rounded-lg border border-mako-200 dark:border-mako-700" :title="node.mqtt_topic">{{ node.mqtt_topic || 'Pendiente' }}</div>
              </td>
              <td class="flex sm:table-cell justify-between items-center px-4 py-3 sm:px-6 sm:py-4 border-t border-mako-50 dark:border-mako-700/30 sm:border-0">
                <span class="text-[10px] font-bold text-mako-400 uppercase sm:hidden">Tipo</span>
                <span class="px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-mako-200 dark:bg-mako-700 text-mako-700 dark:text-mako-200">
                  {{ tiposDispositivo.find(t => t.id === node.tipo_dispositivo)?.nombre || 'Sensor' }}
                </span>
              </td>
              <td class="flex sm:table-cell justify-between sm:justify-end items-center px-4 py-3 sm:px-6 sm:py-4 border-t border-mako-50 dark:border-mako-700/30 sm:border-0">
                <span class="text-[10px] font-bold text-mako-400 uppercase sm:hidden">Estado</span>
                <span v-if="node.activo" class="inline-flex items-center gap-1.5 text-xs text-green-500 font-semibold bg-green-500/10 px-3 py-1 rounded-full">
                  <span class="w-1.5 h-1.5 rounded-full bg-green-500"></span> Activo
                </span>
                <span v-else class="inline-flex items-center gap-1.5 text-xs text-red-500 font-semibold bg-red-500/10 px-3 py-1 rounded-full">
                  <span class="w-1.5 h-1.5 rounded-full bg-red-500"></span> Inactivo
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- PESTAÑA: ESTRUCTURA -->
    <div v-if="activeTab === 'estructura'" class="space-y-6 animate-fade-in">
      
      <!-- Sub-tabs para Estructura -->
      <div class="flex bg-white/60 dark:bg-mako-900/40 backdrop-blur-md p-1 rounded-xl w-max border border-mako-200 dark:border-white/5">
        <button @click="activeEstructuraSubTab = 'clientes'" class="px-5 py-2 rounded-lg text-xs font-bold transition-all" :class="activeEstructuraSubTab === 'clientes' ? 'bg-white dark:bg-mako-800 text-mako-900 dark:text-white shadow-sm' : 'text-mako-500 hover:text-mako-700 dark:hover:text-mako-300'">Empresas</button>
        <button @click="activeEstructuraSubTab = 'sitios'" class="px-5 py-2 rounded-lg text-xs font-bold transition-all" :class="activeEstructuraSubTab === 'sitios' ? 'bg-white dark:bg-mako-800 text-mako-900 dark:text-white shadow-sm' : 'text-mako-500 hover:text-mako-700 dark:hover:text-mako-300'">Sitios / Cerros</button>
        <button @click="activeEstructuraSubTab = 'zonas'" class="px-5 py-2 rounded-lg text-xs font-bold transition-all" :class="activeEstructuraSubTab === 'zonas' ? 'bg-white dark:bg-mako-800 text-mako-900 dark:text-white shadow-sm' : 'text-mako-500 hover:text-mako-700 dark:hover:text-mako-300'">Zonas</button>
      </div>

      <!-- Sub-pestaña Empresas -->
      <div v-if="activeEstructuraSubTab === 'clientes'" class="bg-white/85 dark:bg-mako-900/60 backdrop-blur-xl border border-white/40 dark:border-white/5 rounded-[2rem] shadow-sm overflow-hidden">
        <div class="p-6 border-b border-mako-100 dark:border-white/5 flex items-center justify-between">
          <h2 class="text-lg font-bold text-mako-900 dark:text-white">Empresas Clientes</h2>
        </div>
        <div class="overflow-x-auto custom-scrollbar">
          <table class="w-full text-left whitespace-nowrap">
            <thead class="bg-mako-50 dark:bg-mako-800/50 border-b border-mako-100 dark:border-mako-700/50">
              <tr class="text-[11px] uppercase tracking-widest text-mako-500 dark:text-mako-400 font-bold">
                <th class="px-6 py-4">Código</th>
                <th class="px-6 py-4">Nombre Legal</th>
                <th class="px-6 py-4">RUT</th>
                <th class="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-mako-100 dark:divide-mako-800/60">
              <tr v-for="emp in empresas" :key="emp.id" class="hover:bg-mako-50/50 dark:hover:bg-white/5 transition-colors">
                <td class="px-6 py-4 font-mono font-bold text-primary">{{ emp.codigo }}</td>
                <td class="px-6 py-4">
                  <input v-if="editingClientId === emp.id" v-model="editingClientName" class="px-3 py-1.5 bg-white dark:bg-mako-800 border dark:border-mako-700 rounded-lg text-sm w-full outline-none focus:border-primary" />
                  <span v-else class="text-sm font-semibold">{{ emp.nombre }}</span>
                </td>
                <td class="px-6 py-4">
                  <input v-if="editingClientId === emp.id" v-model="editingClientRut" class="px-3 py-1.5 bg-white dark:bg-mako-800 border dark:border-mako-700 rounded-lg text-sm w-full outline-none focus:border-primary" />
                  <span v-else class="text-sm text-mako-500">{{ emp.rut }}</span>
                </td>
                <td class="px-6 py-4 text-right">
                  <div class="flex gap-2 justify-end">
                    <template v-if="editingClientId === emp.id">
                      <button @click="handleUpdateClient" class="p-2 text-green-500 hover:bg-green-500/10 rounded-lg transition-colors"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg></button>
                      <button @click="editingClientId = null" class="p-2 text-mako-400 hover:bg-mako-100 dark:hover:bg-mako-800 rounded-lg transition-colors"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
                    </template>
                    <template v-else>
                      <button @click="startEditClient(emp)" class="p-2 text-mako-400 hover:text-blue-500 hover:bg-blue-500/10 rounded-xl transition-colors" title="Editar"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg></button>
                      <button @click="handleDeleteClient(emp.id)" class="p-2 text-mako-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-colors" title="Eliminar"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
                    </template>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Sub-pestaña Sitios -->
      <div v-if="activeEstructuraSubTab === 'sitios'" class="bg-white/85 dark:bg-mako-900/60 backdrop-blur-xl border border-white/40 dark:border-white/5 rounded-[2rem] shadow-sm overflow-hidden">
        <div class="p-6 border-b border-mako-100 dark:border-white/5 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <h2 class="text-lg font-bold text-mako-900 dark:text-white">Sitios por Empresa</h2>
          <select v-model="selectedEmpresaForSitios" class="px-4 py-2 rounded-xl bg-mako-100 dark:bg-mako-800 border border-mako-200 dark:border-mako-700 outline-none focus:border-primary text-sm font-semibold">
            <option value="" disabled>Seleccione Empresa...</option>
            <option v-for="emp in empresas" :key="emp.id" :value="emp.id">{{ emp.nombre }}</option>
          </select>
        </div>
        <div v-if="!selectedEmpresaForSitios" class="p-12 text-center text-sm text-mako-400">Seleccione una empresa para ver sus sitios.</div>
        <div v-else-if="sitios.length === 0" class="p-12 text-center text-sm text-mako-400">No hay sitios registrados para esta empresa.</div>
        <div v-else class="overflow-x-auto custom-scrollbar">
          <table class="w-full text-left whitespace-nowrap">
            <thead class="bg-mako-50 dark:bg-mako-800/50 border-b border-mako-100 dark:border-mako-700/50">
              <tr class="text-[11px] uppercase tracking-widest text-mako-500 dark:text-mako-400 font-bold">
                <th class="px-6 py-4">Código</th>
                <th class="px-6 py-4">Nombre del Sitio</th>
                <th class="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-mako-100 dark:divide-mako-800/60">
              <tr v-for="sit in sitios" :key="sit.id" class="hover:bg-mako-50/50 dark:hover:bg-white/5 transition-colors">
                <td class="px-6 py-4 font-mono font-bold text-mako-500">{{ sit.codigo || 'N/A' }}</td>
                <td class="px-6 py-4">
                  <input v-if="editingSitioId === sit.id" v-model="editingSitioName" class="px-3 py-1.5 bg-white dark:bg-mako-800 border dark:border-mako-700 rounded-lg text-sm w-full outline-none focus:border-primary" />
                  <span v-else class="text-sm font-semibold">{{ sit.nombre }}</span>
                </td>
                <td class="px-6 py-4 text-right">
                  <div class="flex gap-2 justify-end">
                    <template v-if="editingSitioId === sit.id">
                      <button @click="handleUpdateSitio(sit.empresa)" class="p-2 text-green-500 hover:bg-green-500/10 rounded-lg transition-colors"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg></button>
                      <button @click="editingSitioId = null" class="p-2 text-mako-400 hover:bg-mako-100 dark:hover:bg-mako-800 rounded-lg transition-colors"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
                    </template>
                    <template v-else>
                      <button @click="startEditSitio(sit)" class="p-2 text-mako-400 hover:text-blue-500 hover:bg-blue-500/10 rounded-xl transition-colors"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg></button>
                      <button @click="handleDeleteSitio(sit.id)" class="p-2 text-mako-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-colors"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
                    </template>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Sub-pestaña Zonas -->
      <div v-if="activeEstructuraSubTab === 'zonas'" class="bg-white/85 dark:bg-mako-900/60 backdrop-blur-xl border border-white/40 dark:border-white/5 rounded-[2rem] shadow-sm overflow-hidden">
        <div class="p-6 border-b border-mako-100 dark:border-white/5 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <h2 class="text-lg font-bold text-mako-900 dark:text-white">Zonas por Sitio</h2>
          <div class="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <select v-model="selectedEmpresaForZonas" class="px-4 py-2 rounded-xl bg-mako-100 dark:bg-mako-800 border border-mako-200 dark:border-mako-700 outline-none focus:border-primary text-sm font-semibold">
              <option value="" disabled>1. Empresa...</option>
              <option v-for="emp in empresas" :key="emp.id" :value="emp.id">{{ emp.nombre }}</option>
            </select>
            <select v-model="selectedSitioForZonas" :disabled="!selectedEmpresaForZonas" class="px-4 py-2 rounded-xl bg-mako-100 dark:bg-mako-800 border border-mako-200 dark:border-mako-700 outline-none focus:border-primary text-sm font-semibold disabled:opacity-50">
              <option value="" disabled>2. Sitio...</option>
              <option v-for="sit in sitios" :key="sit.id" :value="sit.id">{{ sit.nombre }}</option>
            </select>
          </div>
        </div>
        <div v-if="!selectedSitioForZonas" class="p-12 text-center text-sm text-mako-400">Seleccione Empresa y Sitio para cargar sus zonas.</div>
        <div v-else-if="zonas.length === 0" class="p-12 text-center text-sm text-mako-400">No hay zonas registradas.</div>
        <div v-else class="overflow-x-auto custom-scrollbar">
          <table class="w-full text-left whitespace-nowrap">
            <thead class="bg-mako-50 dark:bg-mako-800/50 border-b border-mako-100 dark:border-mako-700/50">
              <tr class="text-[11px] uppercase tracking-widest text-mako-500 dark:text-mako-400 font-bold">
                <th class="px-6 py-4">Código</th>
                <th class="px-6 py-4">Nombre de la Zona</th>
                <th class="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-mako-100 dark:divide-mako-800/60">
              <tr v-for="zon in zonas" :key="zon.id" class="hover:bg-mako-50/50 dark:hover:bg-white/5 transition-colors">
                <td class="px-6 py-4 font-mono font-bold text-mako-500">{{ zon.codigo || 'N/A' }}</td>
                <td class="px-6 py-4">
                  <input v-if="editingZonaId === zon.id" v-model="editingZonaName" class="px-3 py-1.5 bg-white dark:bg-mako-800 border dark:border-mako-700 rounded-lg text-sm w-full outline-none focus:border-primary" />
                  <span v-else class="text-sm font-semibold">{{ zon.nombre }}</span>
                </td>
                <td class="px-6 py-4 text-right">
                  <div class="flex gap-2 justify-end">
                    <template v-if="editingZonaId === zon.id">
                      <button @click="handleUpdateZona(zon.sitio)" class="p-2 text-green-500 hover:bg-green-500/10 rounded-lg transition-colors"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg></button>
                      <button @click="editingZonaId = null" class="p-2 text-mako-400 hover:bg-mako-100 dark:hover:bg-mako-800 rounded-lg transition-colors"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
                    </template>
                    <template v-else>
                      <button @click="startEditZona(zon)" class="p-2 text-mako-400 hover:text-blue-500 hover:bg-blue-500/10 rounded-xl transition-colors"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg></button>
                      <button @click="handleDeleteZona(zon.id)" class="p-2 text-mako-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-colors"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
                    </template>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- PESTAÑA: DIAGNÓSTICO MQTT -->
    <div v-if="activeTab === 'mqtt'" class="bg-white/85 dark:bg-mako-900/60 backdrop-blur-xl border border-white/40 dark:border-white/5 rounded-[2rem] shadow-sm overflow-hidden animate-fade-in">
      <div class="p-6 border-b border-mako-100 dark:border-white/5 flex justify-between items-center">
        <div>
          <h2 class="text-lg font-bold flex items-center gap-2 text-mako-900 dark:text-white">
            <span class="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.8)]"></span>
            Tráfico de Telemetría Reciente
          </h2>
        </div>
        <button @click="fetchMqttPayloads" class="p-2.5 text-mako-500 hover:text-blue-500 hover:bg-blue-500/10 rounded-xl transition-colors" title="Actualizar">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
        </button>
      </div>

      <div v-if="isMqttLoading" class="p-16 flex justify-center">
        <span class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></span>
      </div>
      <div v-else class="overflow-x-auto custom-scrollbar">
        <table class="w-full text-left whitespace-nowrap">
          <thead class="bg-mako-50 dark:bg-mako-800/50 border-b border-mako-100 dark:border-mako-700/50">
            <tr class="text-[11px] uppercase tracking-widest text-mako-500 dark:text-mako-400 font-bold">
              <th class="px-6 py-4">Dispositivo</th>
              <th class="px-6 py-4">Tópico</th>
              <th class="px-6 py-4">Fecha/Hora</th>
              <th class="px-6 py-4">Validación</th>
              <th class="px-6 py-4">Detalle</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-mako-100 dark:divide-mako-800/60">
            <tr v-if="mqttPayloads.length === 0">
              <td colspan="5" class="py-12 text-center text-sm text-mako-400">Sin tráfico MQTT.</td>
            </tr>
            <tr v-for="log in mqttPayloads" :key="log.id" class="hover:bg-mako-50/50 dark:hover:bg-white/5 transition-colors">
              <td class="px-6 py-4 font-mono font-bold text-primary text-sm">{{ log.dispositivo_serial || 'Desconocido' }}</td>
              <td class="px-6 py-4 text-xs font-mono text-mako-500 bg-mako-50/50 dark:bg-transparent">{{ log.topic }}</td>
              <td class="px-6 py-4 text-xs text-mako-600 dark:text-mako-300">{{ new Date(log.recibido_en || log.created_at).toLocaleString('es-CL') }}</td>
              <td class="px-6 py-4">
                <span v-if="log.valido" class="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-green-500/10 text-green-500 border border-green-500/20">Válido</span>
                <span v-else class="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-500/10 text-red-500 border border-red-500/20">Error</span>
              </td>
              <td class="px-6 py-4 text-xs text-mako-500 max-w-xs truncate" :title="log.error_validacion || log.payload">
                {{ log.error_validacion || log.payload }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>


    <!-- MODALES -->

    <!-- Modal Nuevo Nodo -->
    <div v-if="isAddNodeModalOpen" class="fixed inset-0 bg-mako-950/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div class="bg-white/95 dark:bg-mako-900/95 border border-mako-200 dark:border-white/10 rounded-[2rem] shadow-2xl w-full max-w-2xl p-6 lg:p-8 relative max-h-[90vh] overflow-y-auto custom-scrollbar animate-fade-in">
        <button @click="isAddNodeModalOpen = false" class="absolute top-6 right-6 p-2 rounded-full hover:bg-mako-100 dark:hover:bg-white/10 text-mako-400 transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
        <h3 class="text-xl font-bold mb-6 flex items-center gap-3 text-mako-900 dark:text-white">
          <div class="p-2 bg-primary/10 rounded-xl">
            <svg class="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          Registrar e Instalar Dispositivo
        </h3>
        <form @submit.prevent="handleRegisterNode" class="space-y-5">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">1. Empresa</label>
              <select v-model="formSelectedEmpresa" class="w-full px-4 py-3.5 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none focus:border-primary text-sm font-semibold">
                <option value="" disabled>Seleccione...</option>
                <option v-for="empresa in empresas" :key="empresa.id" :value="empresa.id">{{ empresa.nombre }}</option>
              </select>
            </div>
            <div>
              <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">2. Sitio</label>
              <select v-model="formSelectedSitio" :disabled="!formSelectedEmpresa" class="w-full px-4 py-3.5 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none focus:border-primary text-sm font-semibold disabled:opacity-50">
                <option value="" disabled>Seleccione...</option>
                <option v-for="sitio in formSitios" :key="sitio.id" :value="sitio.id">{{ sitio.nombre }}</option>
              </select>
            </div>
            <div>
              <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">3. Zona</label>
              <select v-model="formSelectedZona" :disabled="!formSelectedSitio" class="w-full px-4 py-3.5 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none focus:border-primary text-sm font-semibold disabled:opacity-50">
                <option value="" disabled>Seleccione...</option>
                <option v-for="zona in formZonas" :key="zona.id" :value="zona.id">{{ zona.nombre }}</option>
              </select>
            </div>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">Número de Serie</label>
              <input v-model="serial" type="text" placeholder="Ej. SN_AG_999" class="w-full px-4 py-3.5 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none focus:border-primary text-sm font-mono font-semibold" />
            </div>
            <div>
              <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">Nombre del Nodo</label>
              <input v-model="deviceName" type="text" placeholder="Ej. Estación Clima Norte" class="w-full px-4 py-3.5 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none focus:border-primary text-sm font-semibold" />
            </div>
          </div>
          <div>
            <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">Tipo de Dispositivo</label>
            <select v-model="formSelectedTipoDispositivo" class="w-full px-4 py-3.5 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none focus:border-primary text-sm font-semibold">
              <option value="" disabled>Seleccione el modelo o tipo...</option>
              <option v-for="tipo in tiposDispositivo" :key="tipo.id" :value="tipo.id">{{ tipo.nombre }} ({{ tipo.modelo }})</option>
            </select>
          </div>
          <div class="pt-4 border-t border-mako-200 dark:border-mako-700/50 flex gap-3 justify-end">
            <button type="button" @click="isAddNodeModalOpen = false" class="px-5 py-3 border border-mako-300 dark:border-mako-700 text-sm font-semibold rounded-xl hover:bg-mako-100 dark:hover:bg-white/5 transition-all">Cancelar</button>
            <button type="submit" class="px-6 py-3 rounded-xl bg-primary text-white font-bold hover:shadow-[0_0_15px_rgba(0,209,94,0.4)] transition-all">Registrar Dispositivo</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal Nueva Empresa -->
    <div v-if="isAddClientModalOpen" class="fixed inset-0 bg-mako-950/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div class="bg-white/95 dark:bg-mako-900/95 border border-mako-200 dark:border-white/10 rounded-[2rem] shadow-2xl w-full max-w-lg p-6 lg:p-8 relative max-h-[90vh] overflow-y-auto custom-scrollbar animate-fade-in">
        <button @click="isAddClientModalOpen = false" class="absolute top-6 right-6 p-2 rounded-full hover:bg-mako-100 dark:hover:bg-white/10 text-mako-400 transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
        <h3 class="text-xl font-bold mb-6 flex items-center gap-3 text-mako-900 dark:text-white">
          <div class="p-2 bg-primary/10 rounded-xl">
            <svg class="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
          </div>
          Dar de Alta Empresa
        </h3>
        <form @submit.prevent="handleAddClient" class="space-y-5">
          <div>
            <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">Nombre Legal</label>
            <input v-model="newClientName" type="text" placeholder="Ej. Viñedos San Pedro S.A." class="w-full px-4 py-3.5 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none focus:border-primary text-sm font-semibold" />
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">RUT / ID</label>
              <input v-model="newClientRut" type="text" placeholder="Ej. 76.543.210-K" class="w-full px-4 py-3.5 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none focus:border-primary text-sm font-semibold" />
            </div>
            <div>
              <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">Código Único</label>
              <input v-model="newClientCode" type="text" placeholder="Ej. VIN-SP" class="w-full px-4 py-3.5 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none focus:border-primary text-sm font-mono font-bold" />
            </div>
          </div>
          <div class="pt-4 border-t border-mako-200 dark:border-mako-700/50 flex gap-3 justify-end">
            <button type="button" @click="isAddClientModalOpen = false" class="px-5 py-3 border border-mako-300 dark:border-mako-700 text-sm font-semibold rounded-xl hover:bg-mako-100 dark:hover:bg-white/5 transition-all">Cancelar</button>
            <button type="submit" class="px-6 py-3 rounded-xl bg-primary text-white font-bold hover:shadow-[0_0_15px_rgba(0,209,94,0.4)] transition-all">Crear Empresa</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal Nuevo Sitio -->
    <div v-if="isAddSitioModalOpen" class="fixed inset-0 bg-mako-950/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div class="bg-white/95 dark:bg-mako-900/95 border border-mako-200 dark:border-white/10 rounded-[2rem] shadow-2xl w-full max-w-lg p-6 lg:p-8 relative max-h-[90vh] overflow-y-auto custom-scrollbar animate-fade-in">
        <button @click="isAddSitioModalOpen = false" class="absolute top-6 right-6 p-2 rounded-full hover:bg-mako-100 dark:hover:bg-white/10 text-mako-400 transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
        <h3 class="text-xl font-bold mb-6 flex items-center gap-3 text-mako-900 dark:text-white">
          <div class="p-2 bg-primary/10 rounded-xl">
            <svg class="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /></svg>
          </div>
          Crear Nuevo Sitio
        </h3>
        <form @submit.prevent="handleAddSitio" class="space-y-5">
          <div>
            <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">Empresa Cliente</label>
            <select v-model="newSitioEmpresa" class="w-full px-4 py-3.5 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none focus:border-primary text-sm font-semibold">
              <option value="" disabled>Seleccione...</option>
              <option v-for="empresa in empresas" :key="empresa.id" :value="empresa.id">{{ empresa.nombre }}</option>
            </select>
          </div>
          <div>
            <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">Nombre del Sitio</label>
            <input v-model="newSitioName" type="text" placeholder="Ej. Fundo El Carmen" class="w-full px-4 py-3.5 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none focus:border-primary text-sm font-semibold" />
          </div>
          <div class="pt-4 border-t border-mako-200 dark:border-mako-700/50 flex gap-3 justify-end">
            <button type="button" @click="isAddSitioModalOpen = false" class="px-5 py-3 border border-mako-300 dark:border-mako-700 text-sm font-semibold rounded-xl hover:bg-mako-100 dark:hover:bg-white/5 transition-all">Cancelar</button>
            <button type="submit" class="px-6 py-3 rounded-xl bg-primary text-white font-bold hover:shadow-[0_0_15px_rgba(0,209,94,0.4)] transition-all">Registrar Sitio</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal Nueva Zona -->
    <div v-if="isAddZonaModalOpen" class="fixed inset-0 bg-mako-950/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div class="bg-white/95 dark:bg-mako-900/95 border border-mako-200 dark:border-white/10 rounded-[2rem] shadow-2xl w-full max-w-lg p-6 lg:p-8 relative max-h-[90vh] overflow-y-auto custom-scrollbar animate-fade-in">
        <button @click="isAddZonaModalOpen = false" class="absolute top-6 right-6 p-2 rounded-full hover:bg-mako-100 dark:hover:bg-white/10 text-mako-400 transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
        <h3 class="text-xl font-bold mb-6 flex items-center gap-3 text-mako-900 dark:text-white">
          <div class="p-2 bg-primary/10 rounded-xl">
            <svg class="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" /></svg>
          </div>
          Crear Nueva Zona
        </h3>
        <form @submit.prevent="handleAddZona" class="space-y-5">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">Empresa</label>
              <select v-model="newZonaEmpresa" class="w-full px-4 py-3.5 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none focus:border-primary text-sm font-semibold">
                <option value="" disabled>Seleccione...</option>
                <option v-for="empresa in empresas" :key="empresa.id" :value="empresa.id">{{ empresa.nombre }}</option>
              </select>
            </div>
            <div>
              <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">Sitio</label>
              <select v-model="newZonaSitio" :disabled="!newZonaEmpresa" class="w-full px-4 py-3.5 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none focus:border-primary text-sm font-semibold disabled:opacity-50">
                <option value="" disabled>Seleccione...</option>
                <option v-for="sitio in zonasSitios" :key="sitio.id" :value="sitio.id">{{ sitio.nombre }}</option>
              </select>
            </div>
          </div>
          <div>
            <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">Nombre de la Zona</label>
            <input v-model="newZonaName" type="text" placeholder="Ej. Sector Caseta 1" class="w-full px-4 py-3.5 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none focus:border-primary text-sm font-semibold" />
          </div>
          <div class="pt-4 border-t border-mako-200 dark:border-mako-700/50 flex gap-3 justify-end">
            <button type="button" @click="isAddZonaModalOpen = false" class="px-5 py-3 border border-mako-300 dark:border-mako-700 text-sm font-semibold rounded-xl hover:bg-mako-100 dark:hover:bg-white/5 transition-all">Cancelar</button>
            <button type="submit" class="px-6 py-3 rounded-xl bg-primary text-white font-bold hover:shadow-[0_0_15px_rgba(0,209,94,0.4)] transition-all">Registrar Zona</button>
          </div>
        </form>
      </div>
    </div>

  </div>
</template>
