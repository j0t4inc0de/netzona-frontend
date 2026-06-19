<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { api } from '../services/api'
import { toast } from 'vue-sonner'
import { useTelemetricsStore } from '../stores/telemetrics'

// Estado Global
const isLoading = ref(true)
const telemetricsStore = useTelemetricsStore()
 // 'nodos', 'estructura', 'mqtt'
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
const isAddClientModalOpen = ref(false)
const isAddSitioModalOpen = ref(false)
const isAddZonaModalOpen = ref(false)

const clientFormErrors = ref({})
const sitioFormErrors = ref({})
const zonaFormErrors = ref({})

watch(isAddClientModalOpen, (newVal) => {
  if (newVal) clientFormErrors.value = {}
})
watch(isAddSitioModalOpen, (newVal) => {
  if (newVal) sitioFormErrors.value = {}
})
watch(isAddZonaModalOpen, (newVal) => {
  if (newVal) zonaFormErrors.value = {}
})

const handleBackendError = async (res, defaultMsg) => {
  try {
    const data = await res.json().catch(() => ({}))
    if (data.detail) {
      toast.error(data.detail)
      return data
    }
    if (data.non_field_errors) {
      toast.error(data.non_field_errors.join('\n'))
      return data
    }
    if (typeof data === 'object' && !Array.isArray(data)) {
      const messages = []
      for (const [key, value] of Object.entries(data)) {
        if (Array.isArray(value)) {
          messages.push(`${key}: ${value.join(', ')}`)
        } else {
          messages.push(`${key}: ${value}`)
        }
      }
      if (messages.length > 0) {
        toast.error(messages.join('\n'))
      } else {
        toast.error(defaultMsg)
      }
      return data
    }
    toast.error(defaultMsg)
    return {}
  } catch {
    toast.error(defaultMsg)
    return {}
  }
}

// Edición y Eliminación de Estructura (Inline)
const editingClientId = ref(null)
const editingClientName = ref('')
const editingClientRut = ref('')
const editingClientCode = ref('')

const editingSitioId = ref(null)
const editingSitioName = ref('')
const editingSitioCode = ref('')

const editingZonaId = ref(null)
const editingZonaName = ref('')
const editingZonaCode = ref('')

const handleDeleteClient = async (id) => {
  if (!confirm('¿Está seguro de eliminar esta empresa cliente? Se desactivará del sistema.')) return
  try {
    const res = await api(`/empresas/clientes/${id}/`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Cliente eliminado correctamente.')
      await fetchEmpresas()
      await telemetricsStore.fetchDataFromBackend()
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
  const codeRegex = /^[a-z0-9_]+$/
  if (!editingClientCode.value.trim() || !codeRegex.test(editingClientCode.value.trim())) {
    toast.error('Código inválido: usa solo minúsculas, números y guion bajo. Ejemplo: empresa_demo.')
    return
  }
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
      await telemetricsStore.fetchDataFromBackend()
    } else {
      await handleBackendError(res, 'Error al actualizar cliente.')
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
      await telemetricsStore.fetchDataFromBackend()
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
  editingSitioCode.value = sitio.codigo || ''
}

const handleUpdateSitio = async (empresaId) => {
  const codeRegex = /^[a-z0-9_]+$/
  if (!editingSitioCode.value.trim() || !codeRegex.test(editingSitioCode.value.trim())) {
    toast.error('Código inválido: usa solo minúsculas, números y guion bajo. Ejemplo: empresa_demo.')
    return
  }
  try {
    const res = await api(`/empresas/sitios/${editingSitioId.value}/`, {
      method: 'PUT',
      body: JSON.stringify({
        nombre: editingSitioName.value,
        empresa: empresaId,
        codigo: editingSitioCode.value.trim()
      })
    })
    if (res.ok) {
      toast.success('Sitio actualizado con éxito.')
      editingSitioId.value = null
      if (selectedEmpresaForSitios.value) {
        await fetchSitios(selectedEmpresaForSitios.value)
      }
      await telemetricsStore.fetchDataFromBackend()
    } else {
      await handleBackendError(res, 'Error al actualizar sitio.')
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
      await telemetricsStore.fetchDataFromBackend()
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
  editingZonaCode.value = zona.codigo || ''
}

const handleUpdateZona = async (sitioId) => {
  const codeRegex = /^[a-z0-9_]+$/
  if (!editingZonaCode.value.trim() || !codeRegex.test(editingZonaCode.value.trim())) {
    toast.error('Código inválido: usa solo minúsculas, números y guion bajo. Ejemplo: empresa_demo.')
    return
  }
  try {
    const res = await api(`/empresas/zonas/${editingZonaId.value}/`, {
      method: 'PUT',
      body: JSON.stringify({
        nombre: editingZonaName.value,
        sitio: sitioId,
        codigo: editingZonaCode.value.trim()
      })
    })
    if (res.ok) {
      toast.success('Zona actualizada con éxito.')
      editingZonaId.value = null
      if (selectedSitioForZonas.value) {
        await fetchZonas(selectedSitioForZonas.value)
      }
      await telemetricsStore.fetchDataFromBackend()
    } else {
      await handleBackendError(res, 'Error al actualizar zona.')
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
const newSitioCode = ref('')

const newZonaEmpresa = ref('')
const newZonaSitio = ref('')
const newZonaName = ref('')
const newZonaCode = ref('')
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
      sitios.value = data.results || data
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
  clientFormErrors.value = {}
  if (!newClientName.value.trim() || !newClientCode.value.trim() || !newClientRut.value.trim()) {
    toast.error('Complete todos los campos para la empresa.')
    return
  }
  const codeRegex = /^[a-z0-9_]+$/
  if (!codeRegex.test(newClientCode.value.trim())) {
    clientFormErrors.value.codigo = ['Usa solo minúsculas, números y guion bajo. Ejemplo: empresa_demo.']
    toast.error('Formato de código inválido.')
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
      await telemetricsStore.fetchDataFromBackend()
    } else {
      clientFormErrors.value = await handleBackendError(res, 'Error al registrar cliente.')
    }
  } catch {
    toast.error('Error de conexión.')
  }
}

const handleAddSitio = async () => {
  sitioFormErrors.value = {}
  if (!newSitioEmpresa.value || !newSitioName.value.trim() || !newSitioCode.value.trim()) {
    toast.error('Complete la empresa, el nombre y el código del sitio.')
    return
  }
  const codeRegex = /^[a-z0-9_]+$/
  if (!codeRegex.test(newSitioCode.value.trim())) {
    sitioFormErrors.value.codigo = ['Usa solo minúsculas, números y guion bajo. Ejemplo: empresa_demo.']
    toast.error('Formato de código inválido.')
    return
  }
  try {
    const res = await api('/empresas/sitios/', {
      method: 'POST',
      body: JSON.stringify({
        nombre: newSitioName.value.trim(),
        empresa: newSitioEmpresa.value,
        codigo: newSitioCode.value.trim()
      })
    })
    if (res.ok) {
      toast.success(`Sitio "${newSitioName.value}" registrado con éxito.`)
      newSitioName.value = ''
      newSitioCode.value = ''
      isAddSitioModalOpen.value = false
      if (selectedEmpresaForSitios.value === newSitioEmpresa.value) {
        fetchSitios(selectedEmpresaForSitios.value)
      }
      await telemetricsStore.fetchDataFromBackend()
    } else {
      sitioFormErrors.value = await handleBackendError(res, 'Error al registrar sitio.')
    }
  } catch {
    toast.error('Error de conexión al registrar sitio.')
  }
}

const handleAddZona = async () => {
  zonaFormErrors.value = {}
  if (!newZonaEmpresa.value || !newZonaSitio.value || !newZonaName.value.trim() || !newZonaCode.value.trim()) {
    toast.error('Seleccione empresa, sitio y asigne un nombre y código a la zona.')
    return
  }
  const codeRegex = /^[a-z0-9_]+$/
  if (!codeRegex.test(newZonaCode.value.trim())) {
    zonaFormErrors.value.codigo = ['Usa solo minúsculas, números y guion bajo. Ejemplo: empresa_demo.']
    toast.error('Formato de código inválido.')
    return
  }
  try {
    const res = await api('/empresas/zonas/', {
      method: 'POST',
      body: JSON.stringify({
        nombre: newZonaName.value.trim(),
        sitio: newZonaSitio.value,
        codigo: newZonaCode.value.trim()
      })
    })
    if (res.ok) {
      toast.success(`Zona "${newZonaName.value}" registrada con éxito.`)
      newZonaName.value = ''
      newZonaCode.value = ''
      isAddZonaModalOpen.value = false
      if (selectedSitioForZonas.value === newZonaSitio.value) {
        fetchZonas(selectedSitioForZonas.value)
      }
      await telemetricsStore.fetchDataFromBackend()
    } else {
      zonaFormErrors.value = await handleBackendError(res, 'Error al registrar zona.')
    }
  } catch {
    toast.error('Error de conexión al registrar zona.')
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
    
    if (activeEstructuraSubTab.value === 'clientes') return 'Nueva Empresa'
    if (activeEstructuraSubTab.value === 'sitios') return 'Nuevo Sitio'
    if (activeEstructuraSubTab.value === 'zonas') return 'Nueva Zona'
  return null
})

const openActiveModal = () => {
  
    if (activeEstructuraSubTab.value === 'clientes') isAddClientModalOpen.value = true
    if (activeEstructuraSubTab.value === 'sitios') isAddSitioModalOpen.value = true
    if (activeEstructuraSubTab.value === 'zonas') isAddZonaModalOpen.value = true
}

</script>

<template>
  <div class="space-y-6 max-w-7xl mx-auto">
    <!-- Navbar / Header Area -->
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/85 dark:bg-mako-800/60 backdrop-blur-xl border border-white/40 dark:border-white/5 rounded-[2rem] p-6 shadow-sm">
      <div class="flex items-center gap-4">
        <div class="p-3 bg-primary/10 rounded-2xl hidden sm:block">
          <svg class="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"></path></svg>
        </div>
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-mako-900 dark:text-white">Estructura del Sistema</h1>
          <p class="text-sm text-mako-500 dark:text-mako-400 mt-0.5">
            Gestión de empresas, sitios y zonas.
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



    <!-- PESTAÑA: ESTRUCTURA -->
    <div class="space-y-6 animate-fade-in">
      
    <!-- Sub-tabs para Estructura -->
    <div class="flex border-b border-mako-200 dark:border-white/5 gap-4 sm:gap-8 overflow-x-auto whitespace-nowrap scrollbar-hide py-1 px-2 mb-6">
      <button
        @click="activeEstructuraSubTab = 'clientes'"
        class="py-3 px-2 text-sm font-bold border-b-2 transition-all outline-none shrink-0"
        :class="activeEstructuraSubTab === 'clientes' ? 'border-primary text-primary' : 'border-transparent text-mako-400 hover:text-mako-600 dark:hover:text-white'"
      >
        Empresas
      </button>
      <button
        @click="activeEstructuraSubTab = 'sitios'"
        class="py-3 px-2 text-sm font-bold border-b-2 transition-all outline-none shrink-0"
        :class="activeEstructuraSubTab === 'sitios' ? 'border-primary text-primary' : 'border-transparent text-mako-400 hover:text-mako-600 dark:hover:text-white'"
      >
        Sitios / Cerros
      </button>
      <button
        @click="activeEstructuraSubTab = 'zonas'"
        class="py-3 px-2 text-sm font-bold border-b-2 transition-all outline-none shrink-0"
        :class="activeEstructuraSubTab === 'zonas' ? 'border-primary text-primary' : 'border-transparent text-mako-400 hover:text-mako-600 dark:hover:text-white'"
      >
        Zonas
      </button>
    </div>

      <!-- Sub-pestaña Empresas -->
      <div v-if="activeEstructuraSubTab === 'clientes'" class="bg-white/85 dark:bg-mako-800/60 backdrop-blur-xl border border-white/40 dark:border-white/5 rounded-[2rem] shadow-sm overflow-hidden">
        <div class="p-6 border-b border-mako-100 dark:border-white/5 flex items-center justify-between">
          <h2 class="text-lg font-bold text-mako-900 dark:text-white">Empresas Clientes</h2>
        </div>
        <div class="overflow-x-auto custom-scrollbar">
          <table class="w-full text-left whitespace-nowrap block sm:table">
            <thead class="hidden sm:table-header-group bg-mako-50 dark:bg-mako-800/50 border-b border-mako-100 dark:border-mako-700/50">
              <tr class="text-[11px] uppercase tracking-widest text-mako-500 dark:text-mako-400 font-bold">
                <th class="px-6 py-4">Código</th>
                <th class="px-6 py-4">Nombre Legal</th>
                <th class="px-6 py-4">RUT</th>
                <th class="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody class="flex flex-col sm:table-row-group divide-y divide-mako-100 dark:divide-mako-800/60 p-4 sm:p-0">
              <tr v-for="emp in empresas" :key="emp.id" class="block sm:table-row hover:bg-mako-50/50 dark:hover:bg-white/5 transition-colors group bg-white dark:bg-mako-800/40 sm:bg-transparent rounded-2xl sm:rounded-none border border-mako-100 dark:border-mako-700/50 sm:border-0 overflow-hidden mb-4 sm:mb-0">
                <td class="block sm:table-cell px-4 py-4 sm:px-6">
                  <div class="text-[10px] font-bold text-mako-400 uppercase sm:hidden mb-1">Código</div>
                  <div class="font-mono font-bold text-primary">{{ emp.codigo }}</div>
                </td>
                <td class="flex flex-col sm:table-cell justify-center sm:justify-start px-4 py-3 sm:px-6 sm:py-4 border-t border-mako-50 dark:border-mako-700/30 sm:border-0 gap-1 sm:gap-0">
                  <span class="text-[10px] font-bold text-mako-400 uppercase sm:hidden">Nombre Legal</span>
                  <input v-if="editingClientId === emp.id" v-model="editingClientName" class="px-3 py-1.5 bg-white dark:bg-mako-800 border dark:border-mako-700 rounded-lg text-sm w-full outline-none focus:border-primary" />
                  <span v-else class="text-sm font-semibold">{{ emp.nombre }}</span>
                </td>
                <td class="flex flex-col sm:table-cell justify-center sm:justify-start px-4 py-3 sm:px-6 sm:py-4 border-t border-mako-50 dark:border-mako-700/30 sm:border-0 gap-1 sm:gap-0">
                  <span class="text-[10px] font-bold text-mako-400 uppercase sm:hidden">RUT</span>
                  <input v-if="editingClientId === emp.id" v-model="editingClientRut" class="px-3 py-1.5 bg-white dark:bg-mako-800 border dark:border-mako-700 rounded-lg text-sm w-full outline-none focus:border-primary" />
                  <span v-else class="text-sm text-mako-500">{{ emp.rut }}</span>
                </td>
                <td class="flex sm:table-cell justify-between sm:justify-end items-center px-4 py-3 sm:px-6 sm:py-4 border-t border-mako-50 dark:border-mako-700/30 sm:border-0">
                  <span class="text-[10px] font-bold text-mako-400 uppercase sm:hidden">Acciones</span>
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
      <div v-if="activeEstructuraSubTab === 'sitios'" class="bg-white/85 dark:bg-mako-800/60 backdrop-blur-xl border border-white/40 dark:border-white/5 rounded-[2rem] shadow-sm overflow-hidden">
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
                <td class="px-6 py-4 font-mono font-bold text-mako-500">
                  <input v-if="editingSitioId === sit.id" v-model="editingSitioCode" class="px-3 py-1.5 bg-white dark:bg-mako-800 border dark:border-mako-700 rounded-lg text-sm w-full outline-none focus:border-primary font-mono font-bold" />
                  <span v-else>{{ sit.codigo || 'N/A' }}</span>
                </td>
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
      <div v-if="activeEstructuraSubTab === 'zonas'" class="bg-white/85 dark:bg-mako-800/60 backdrop-blur-xl border border-white/40 dark:border-white/5 rounded-[2rem] shadow-sm overflow-hidden">
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
                <td class="px-6 py-4 font-mono font-bold text-mako-500">
                  <input v-if="editingZonaId === zon.id" v-model="editingZonaCode" class="px-3 py-1.5 bg-white dark:bg-mako-800 border dark:border-mako-700 rounded-lg text-sm w-full outline-none focus:border-primary font-mono font-bold" />
                  <span v-else>{{ zon.codigo || 'N/A' }}</span>
                </td>
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

    <!-- MODALES -->

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
            <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">Nombre de la Empresa</label>
            <input v-model="newClientName" type="text" placeholder="Ej. Netzona Spa" class="w-full px-4 py-3.5 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none focus:border-primary text-sm font-semibold transition-all" :class="{'border-red-500': clientFormErrors.nombre}" />
            <p v-if="clientFormErrors.nombre" class="text-red-500 text-[10px] mt-1">{{ clientFormErrors.nombre[0] }}</p>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">RUT / ID</label>
              <input v-model="newClientRut" type="text" placeholder="Ej. 76.543.210-K" class="w-full px-4 py-3.5 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none focus:border-primary text-sm font-semibold transition-all" :class="{'border-red-500': clientFormErrors.rut}" />
              <p v-if="clientFormErrors.rut" class="text-red-500 text-[10px] mt-1">{{ clientFormErrors.rut[0] }}</p>
            </div>
            <div>
              <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">Código Único</label>
              <input v-model="newClientCode" type="text" placeholder="Ej. VIN-SP" class="w-full px-4 py-3.5 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none focus:border-primary text-sm font-mono font-bold transition-all" :class="{'border-red-500': clientFormErrors.codigo}" />
              <p v-if="clientFormErrors.codigo" class="text-red-500 text-[10px] mt-1">{{ clientFormErrors.codigo[0] }}</p>
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
            <select v-model="newSitioEmpresa" class="w-full px-4 py-3.5 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none focus:border-primary text-sm font-semibold transition-all" :class="{'border-red-500': sitioFormErrors.empresa}">
              <option value="" disabled>Seleccione...</option>
              <option v-for="empresa in empresas" :key="empresa.id" :value="empresa.id">{{ empresa.nombre }}</option>
            </select>
            <p v-if="sitioFormErrors.empresa" class="text-red-500 text-[10px] mt-1">{{ sitioFormErrors.empresa[0] }}</p>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">Nombre del Sitio</label>
              <input v-model="newSitioName" type="text" placeholder="Ej. Fundo El Carmen" class="w-full px-4 py-3.5 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none focus:border-primary text-sm font-semibold transition-all" :class="{'border-red-500': sitioFormErrors.nombre}" />
              <p v-if="sitioFormErrors.nombre" class="text-red-500 text-[10px] mt-1">{{ sitioFormErrors.nombre[0] }}</p>
            </div>
            <div>
              <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">Código Único</label>
              <input v-model="newSitioCode" type="text" placeholder="Ej. st_01" class="w-full px-4 py-3.5 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none focus:border-primary text-sm font-mono font-bold text-primary transition-all" :class="{'border-red-500': sitioFormErrors.codigo}" />
              <p v-if="sitioFormErrors.codigo" class="text-red-500 text-[10px] mt-1">{{ sitioFormErrors.codigo[0] }}</p>
            </div>
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
              <select v-model="newZonaSitio" :disabled="!newZonaEmpresa" class="w-full px-4 py-3.5 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none focus:border-primary text-sm font-semibold disabled:opacity-50 transition-all" :class="{'border-red-500': zonaFormErrors.sitio}">
                <option value="" disabled>Seleccione...</option>
                <option v-for="sit in zonasSitios" :key="sit.id" :value="sit.id">{{ sit.nombre }}</option>
              </select>
              <p v-if="zonaFormErrors.sitio" class="text-red-500 text-[10px] mt-1">{{ zonaFormErrors.sitio[0] }}</p>
            </div>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">Nombre de la Zona</label>
              <input v-model="newZonaName" type="text" placeholder="Ej. Sector Caseta 1" class="w-full px-4 py-3.5 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none focus:border-primary text-sm font-semibold transition-all" :class="{'border-red-500': zonaFormErrors.nombre}" />
              <p v-if="zonaFormErrors.nombre" class="text-red-500 text-[10px] mt-1">{{ zonaFormErrors.nombre[0] }}</p>
            </div>
            <div>
              <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">Código de la Zona</label>
              <input v-model="newZonaCode" type="text" placeholder="Ej. zn_01" class="w-full px-4 py-3.5 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none focus:border-primary text-sm font-mono font-bold text-primary transition-all" :class="{'border-red-500': zonaFormErrors.codigo}" />
              <p v-if="zonaFormErrors.codigo" class="text-red-500 text-[10px] mt-1">{{ zonaFormErrors.codigo[0] }}</p>
            </div>
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
