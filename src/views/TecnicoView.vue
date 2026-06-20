<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { api } from '../services/api'
import { toast } from 'vue-sonner'
import { useTelemetricsStore } from '../stores/telemetrics'

// Estado Global
const isLoading = ref(true)
const telemetricsStore = useTelemetricsStore()
const activeTab = ref('equipos') // 'equipos', 'tipos-dispositivo', 'tipos-sensor', 'alta-rapida', 'mqtt'

// Listas de Datos desde Backend
const empresas = ref([])
const tiposSensor = ref([])
const tiposDispositivo = ref([])
const equipos = ref([])
const mqttPayloads = ref([])
const isMqttLoading = ref(false)

// Estado de Selección (Detalles)
const selectedEquipo = ref(null)
const selectedEquipoTab = ref('detalle') // 'detalle', 'sensores-activos'
const selectedEquipoSensors = ref([]) // sensores reales del dispositivo físico

const selectedTipoDispositivo = ref(null)
const selectedTipoDispositivoTab = ref('detalle') // 'detalle', 'sensores-permitidos', 'dashboards'
const selectedTipoDispositivoSensors = ref([]) // sensores permitidos para el tipo de dispositivo
const selectedCompanyForDashboard = ref('') // empresa seleccionada para ver/configurar dashboard
const selectedTipoDispositivoDashboard = ref(null) // template de dashboard de la empresa + tipo
const selectedTipoDispositivoDashboardWidgets = ref([]) // widgets de la plantilla

// Estado del Wizard (Alta Rápida)
const wizardStep = ref(1) // 1 a 9
const wizardState = ref({
  empresaId: '',
  sitioId: '',
  zonaId: '',
  tipoDispositivoId: '',
  serial: '',
  nombre: '',
  mqttUsername: '',
  createdEquipo: null,
  createdDashboardTemplate: null
})

// Variables para Formularios Rápidos (Modales/Listas)
const clientFormErrors = ref({})
const sitioFormErrors = ref({})
const zonaFormErrors = ref({})
const tipoDispositivoFormErrors = ref({})
const tipoSensorFormErrors = ref({})
const equipoFormErrors = ref({})

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

// 1. Empresa
const isAddClientModalOpen = ref(false)
const newClientName = ref('')
const newClientCode = ref('')
const newClientRut = ref('')

// 2. Sitio
const isAddSitioModalOpen = ref(false)
const newSitioEmpresa = ref('')
const newSitioName = ref('')
const newSitioCode = ref('')

// 3. Zona
const isAddZonaModalOpen = ref(false)
const newZonaEmpresa = ref('')
const newZonaSitio = ref('')
const newZonaName = ref('')
const newZonaCode = ref('')
const newZonaSitiosList = ref([])

// 4. Tipo de Dispositivo
const isAddTipoDispositivoModalOpen = ref(false)
const newTipoDispositivoCodigo = ref('')
const newTipoDispositivoNombre = ref('')
const newTipoDispositivoModelo = ref('')
const newTipoDispositivoDescripcion = ref('')

// 5. Tipo de Sensor
const isAddTipoSensorModalOpen = ref(false)
const editingSensorId = ref(null)
const newSensorCodigo = ref('')
const newSensorNombreVisible = ref('')
const newSensorUnidad = ref('')
const newSensorTipoDato = ref('float')
const newSensorCategoria = ref('')
const newSensorDescripcion = ref('')
const newSensorPermiteValorActual = ref(true)
const newSensorPermiteHistorico = ref(true)
const newSensorPermiteAgregacionPromedio = ref(true)
const newSensorTipoWidgetSugerido = ref('metric_card')

// 6. Nuevo Dispositivo Físico (Equipo)
const isAddEquipoModalOpen = ref(false)
const newEquipoEmpresa = ref('')
const newEquipoSitio = ref('')
const newEquipoZona = ref('')
const newEquipoTipoDispositivo = ref('')
const newEquipoSerial = ref('')
const newEquipoNombre = ref('')
const newEquipoMqttUsername = ref('')
const newEquipoSitiosList = ref([])
const newEquipoZonasList = ref([])

// 7. Asociar Sensor Permitido a Tipo de Dispositivo
const newPermittedSensorId = ref('')
const newPermittedSensorRequerido = ref(false)
const newPermittedSensorOrden = ref(0)
const newPermittedSensorMin = ref(null)
const newPermittedSensorMax = ref(null)

// 8. Crear Widget Simple
const newWidgetSensorId = ref('')
const newWidgetVisualizacion = ref('valor_actual')
const newWidgetTitulo = ref('')

// 9. Activar Sensor Real en Equipo Físico
const newRealSensorId = ref('')
const newRealSensorNombreVisible = ref('')

watch(isAddClientModalOpen, (newVal) => {
  if (newVal) clientFormErrors.value = {}
})
watch(isAddSitioModalOpen, (newVal) => {
  if (newVal) sitioFormErrors.value = {}
})
watch(isAddZonaModalOpen, (newVal) => {
  if (newVal) zonaFormErrors.value = {}
})
watch(isAddTipoDispositivoModalOpen, (newVal) => {
  if (newVal) tipoDispositivoFormErrors.value = {}
})
watch(isAddTipoSensorModalOpen, (newVal) => {
  if (newVal) tipoSensorFormErrors.value = {}
})
watch(isAddEquipoModalOpen, (newVal) => {
  if (newVal) equipoFormErrors.value = {}
})
watch(wizardStep, () => {
  equipoFormErrors.value = {}
})

// ==========================================
// WATCHERS DE FILTROS Y DEPENDENCIAS
// ==========================================

// Para el formulario de Zonas (modal)
watch(newZonaEmpresa, async (newVal) => {
  newZonaSitio.value = ''
  newZonaSitiosList.value = []
  if (!newVal) return
  try {
    const res = await api(`/empresas/sitios/?empresa=${newVal}`)
    if (res.ok) {
      const data = await res.json()
      newZonaSitiosList.value = data.results || data
    }
  } catch (error) {
    console.error(error)
  }
})

// Para el formulario de Dispositivo Físico (modal)
watch(newEquipoEmpresa, async (newVal) => {
  newEquipoSitio.value = ''
  newEquipoZona.value = ''
  newEquipoSitiosList.value = []
  newEquipoZonasList.value = []
  if (!newVal) return
  try {
    const res = await api(`/empresas/sitios/?empresa=${newVal}`)
    if (res.ok) {
      const data = await res.json()
      newEquipoSitiosList.value = data.results || data
    }
  } catch (error) {
    console.error(error)
  }
})

watch(newEquipoSitio, async (newVal) => {
  newEquipoZona.value = ''
  newEquipoZonasList.value = []
  if (!newVal) return
  try {
    const res = await api(`/empresas/zonas/?sitio=${newVal}`)
    if (res.ok) {
      const data = await res.json()
      newEquipoZonasList.value = data.results || data
    }
  } catch (error) {
    console.error(error)
  }
})

// Watcher para el Dashboard por Empresa en Tipo de Dispositivo
watch([selectedTipoDispositivo, selectedCompanyForDashboard], async ([tipoDisp, empresa]) => {
  if (tipoDisp && empresa) {
    await fetchTipoDispositivoDashboard(tipoDisp.id, empresa)
  } else {
    selectedTipoDispositivoDashboard.value = null
    selectedTipoDispositivoDashboardWidgets.value = []
  }
})

// Watcher de auto-completar permisos de sensor según el tipo de dato al crearlo
watch(newSensorTipoDato, (newVal) => {
  if (newVal === 'integer' || newVal === 'float') {
    newSensorPermiteValorActual.value = true
    newSensorPermiteHistorico.value = true
    newSensorPermiteAgregacionPromedio.value = true
  } else {
    newSensorPermiteValorActual.value = true
    newSensorPermiteHistorico.value = false
    newSensorPermiteAgregacionPromedio.value = false
  }
})

// ==========================================
// OPERACIONES DE OBTENCIÓN DE DATOS (FETCH)
// ==========================================

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

const fetchTiposSensor = async () => {
  try {
    const res = await api('/dispositivos/tipos-sensor/')
    if (res.ok) {
      const data = await res.json()
      tiposSensor.value = data.results || data
    }
  } catch (error) {
    console.error('Error al obtener tipos de sensor:', error)
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

// Sensores reales de un dispositivo físico
const fetchEquipoSensors = async (equipoId) => {
  try {
    const res = await api(`/dispositivos/sensores/?dispositivo=${equipoId}`)
    if (res.ok) {
      const data = await res.json()
      selectedEquipoSensors.value = data.results || data
    }
  } catch (e) {
    console.error('Error al obtener sensores del dispositivo:', e)
  }
}

// Sensores permitidos para un tipo de dispositivo
const fetchTipoDispositivoSensors = async (tipoDispositivoId) => {
  try {
    const res = await api(`/dispositivos/tipos-dispositivo-sensor/?tipo_dispositivo=${tipoDispositivoId}`)
    if (res.ok) {
      const data = await res.json()
      selectedTipoDispositivoSensors.value = data.results || data
    }
  } catch (e) {
    console.error('Error al obtener sensores permitidos:', e)
  }
}

// Dashboard de empresa + tipo
const fetchTipoDispositivoDashboard = async (tipoDispositivoId, empresaId) => {
  selectedTipoDispositivoDashboard.value = null
  selectedTipoDispositivoDashboardWidgets.value = []
  if (!tipoDispositivoId || !empresaId) return
  try {
    const res = await api(`/dashboards/templates/?empresa=${empresaId}&tipo_dispositivo=${tipoDispositivoId}`)
    if (res.ok) {
      const data = await res.json()
      const results = data.results || data
      if (results.length > 0) {
        selectedTipoDispositivoDashboard.value = results[0]
        await fetchDashboardWidgets(results[0].id)
      }
    }
  } catch (e) {
    console.error('Error al obtener dashboard template:', e)
  }
}

const fetchDashboardWidgets = async (templateId) => {
  try {
    const res = await api(`/dashboards/widgets/?dashboard_template=${templateId}`)
    if (res.ok) {
      const data = await res.json()
      selectedTipoDispositivoDashboardWidgets.value = data.results || data
    }
  } catch (e) {
    console.error('Error al obtener widgets de dashboard:', e)
  }
}

// Cargar todo al inicio
onMounted(async () => {
  await Promise.all([
    fetchEmpresas(),
    fetchTiposSensor(),
    fetchTiposDispositivo(),
    fetchEquipos(),
    fetchMqttPayloads()
  ])
  isLoading.value = false
})

// ==========================================
// SELECCIÓN Y APERTURA DE DETALLES
// ==========================================

const selectEquipo = async (equipo) => {
  selectedEquipo.value = equipo
  selectedEquipoTab.value = 'detalle'
  await fetchEquipoSensors(equipo.id)
}

const selectTipoDispositivo = async (tipoDisp) => {
  selectedTipoDispositivo.value = tipoDisp
  selectedTipoDispositivoTab.value = 'detalle'
  selectedCompanyForDashboard.value = ''
  selectedTipoDispositivoDashboard.value = null
  selectedTipoDispositivoDashboardWidgets.value = []
  await fetchTipoDispositivoSensors(tipoDisp.id)
}

// ==========================================
// ACCIONES DE FORMULARIOS: CREACIÓN / EDICIÓN
// ==========================================

// 1. Crear Empresa
const handleAddClient = async () => {
  clientFormErrors.value = {}
  if (!newClientName.value.trim() || !newClientCode.value.trim() || !newClientRut.value.trim()) {
    toast.error('Complete todos los campos para la empresa.')
    return
  }
  const codeRegex = /^[a-z0-9_]+$/
  if (!codeRegex.test(newClientCode.value.trim())) {
    clientFormErrors.value = { codigo: ['El código debe usar snake_case (solo minúsculas, números y guión bajo).'] }
    toast.error('El código debe usar snake_case (solo minúsculas, números y guión bajo).')
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
      const data = await res.json()
      toast.success(`Empresa "${newClientName.value}" registrada con éxito.`)
      // Si estamos en el wizard, asignamos
      if (activeTab.value === 'alta-rapida') {
        wizardState.value.empresaId = data.id
      }
      newClientName.value = ''
      newClientCode.value = ''
      newClientRut.value = ''
      isAddClientModalOpen.value = false
      await fetchEmpresas()
      await telemetricsStore.fetchDataFromBackend()
    } else {
      clientFormErrors.value = await handleBackendError(res, 'Error al registrar empresa.')
    }
  } catch {
    toast.error('Error de conexión.')
  }
}

// 2. Crear Sitio
const handleAddSitio = async () => {
  sitioFormErrors.value = {}
  const empresaId = activeTab.value === 'alta-rapida' ? wizardState.value.empresaId : newSitioEmpresa.value
  if (!empresaId || !newSitioName.value.trim() || !newSitioCode.value.trim()) {
    toast.error('Complete la empresa, el nombre y el código del sitio.')
    return
  }
  const codeRegex = /^[a-z0-9_]+$/
  if (!codeRegex.test(newSitioCode.value.trim())) {
    sitioFormErrors.value = { codigo: ['El código debe usar snake_case (solo minúsculas, números y guión bajo).'] }
    toast.error('El código debe usar snake_case (solo minúsculas, números y guión bajo).')
    return
  }
  try {
    const res = await api('/empresas/sitios/', {
      method: 'POST',
      body: JSON.stringify({
        nombre: newSitioName.value.trim(),
        empresa: empresaId,
        codigo: newSitioCode.value.trim()
      })
    })
    if (res.ok) {
      const data = await res.json()
      toast.success(`Sitio "${newSitioName.value}" registrado con éxito.`)
      if (activeTab.value === 'alta-rapida') {
        wizardState.value.sitioId = data.id
      }
      newSitioName.value = ''
      newSitioCode.value = ''
      isAddSitioModalOpen.value = false
      await telemetricsStore.fetchDataFromBackend()
    } else {
      sitioFormErrors.value = await handleBackendError(res, 'Error al registrar sitio.')
    }
  } catch {
    toast.error('Error de conexión al registrar sitio.')
  }
}

// 3. Crear Zona
const handleAddZona = async () => {
  zonaFormErrors.value = {}
  const sitioId = activeTab.value === 'alta-rapida' ? wizardState.value.sitioId : newZonaSitio.value
  if (!sitioId || !newZonaName.value.trim() || !newZonaCode.value.trim()) {
    toast.error('Seleccione sitio y asigne un nombre y código a la zona.')
    return
  }
  const codeRegex = /^[a-z0-9_]+$/
  if (!codeRegex.test(newZonaCode.value.trim())) {
    zonaFormErrors.value = { codigo: ['El código debe usar snake_case (solo minúsculas, números y guión bajo).'] }
    toast.error('El código debe usar snake_case (solo minúsculas, números y guión bajo).')
    return
  }
  try {
    const res = await api('/empresas/zonas/', {
      method: 'POST',
      body: JSON.stringify({
        nombre: newZonaName.value.trim(),
        sitio: sitioId,
        codigo: newZonaCode.value.trim()
      })
    })
    if (res.ok) {
      const data = await res.json()
      toast.success(`Zona "${newZonaName.value}" registrada con éxito.`)
      if (activeTab.value === 'alta-rapida') {
        wizardState.value.zonaId = data.id
      }
      newZonaName.value = ''
      newZonaCode.value = ''
      isAddZonaModalOpen.value = false
      await telemetricsStore.fetchDataFromBackend()
    } else {
      zonaFormErrors.value = await handleBackendError(res, 'Error al registrar zona.')
    }
  } catch {
    toast.error('Error de conexión al registrar zona.')
  }
}

// 4. Crear Tipo de Dispositivo
const handleAddTipoDispositivo = async () => {
  tipoDispositivoFormErrors.value = {}
  if (!newTipoDispositivoCodigo.value.trim() || !newTipoDispositivoNombre.value.trim()) {
    toast.error('Complete código y nombre del tipo de dispositivo.')
    return
  }
  const codeRegex = /^[a-z0-9_]+$/
  if (!codeRegex.test(newTipoDispositivoCodigo.value.trim())) {
    tipoDispositivoFormErrors.value = { codigo: ['El código debe usar snake_case (solo minúsculas, números y guión bajo).'] }
    toast.error('El código debe usar snake_case (solo minúsculas, números y guión bajo).')
    return
  }
  try {
    const res = await api('/dispositivos/tipos/', {
      method: 'POST',
      body: JSON.stringify({
        codigo: newTipoDispositivoCodigo.value.trim(),
        nombre: newTipoDispositivoNombre.value.trim(),
        descripcion: newTipoDispositivoDescripcion.value.trim(),
        activo: true
      })
    })
    if (res.ok) {
      const data = await res.json()
      toast.success(`Tipo de Dispositivo "${newTipoDispositivoNombre.value}" creado con éxito.`)
      if (activeTab.value === 'alta-rapida') {
        wizardState.value.tipoDispositivoId = data.id
      }
      newTipoDispositivoCodigo.value = ''
      newTipoDispositivoNombre.value = ''
      newTipoDispositivoModelo.value = ''
      newTipoDispositivoDescripcion.value = ''
      isAddTipoDispositivoModalOpen.value = false
      await fetchTiposDispositivo()
    } else {
      tipoDispositivoFormErrors.value = await handleBackendError(res, 'Error al crear tipo de dispositivo.')
    }
  } catch {
    toast.error('Error de conexión.')
  }
}

// 5. Crear / Editar Tipo de Sensor
const handleSaveTipoSensor = async () => {
  tipoSensorFormErrors.value = {}
  if (!newSensorCodigo.value.trim() || !newSensorNombreVisible.value.trim()) {
    toast.error('Código y Nombre Visible son obligatorios.')
    return
  }
  const codeRegex = /^[a-z0-9_]+$/
  if (!codeRegex.test(newSensorCodigo.value.trim())) {
    tipoSensorFormErrors.value = { codigo: ['El código debe usar snake_case (solo minúsculas, números y guión bajo).'] }
    toast.error('El código debe usar snake_case (solo minúsculas, números y guión bajo).')
    return
  }
  try {
    const payload = {
      codigo: newSensorCodigo.value.trim(),
      nombre_visible: newSensorNombreVisible.value.trim(),
      unidad: newSensorUnidad.value.trim(),
      tipo_dato: newSensorTipoDato.value,
      categoria: newSensorCategoria.value.trim(),
      descripcion: newSensorDescripcion.value.trim(),
      permite_valor_actual: newSensorPermiteValorActual.value,
      permite_historico: newSensorPermiteHistorico.value,
      permite_agregacion_promedio: newSensorPermiteAgregacionPromedio.value,
      tipo_widget_sugerido: newSensorTipoWidgetSugerido.value,
      activo: true
    }

    let res
    if (editingSensorId.value) {
      res = await api(`/dispositivos/tipos-sensor/${editingSensorId.value}/`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      })
    } else {
      res = await api('/dispositivos/tipos-sensor/', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    }

    if (res.ok) {
      toast.success(editingSensorId.value ? 'Sensor actualizado con éxito.' : 'Sensor creado con éxito.')
      newSensorCodigo.value = ''
      newSensorNombreVisible.value = ''
      newSensorUnidad.value = ''
      newSensorTipoDato.value = 'float'
      newSensorCategoria.value = ''
      newSensorDescripcion.value = ''
      newSensorPermiteValorActual.value = true
      newSensorPermiteHistorico.value = true
      newSensorPermiteAgregacionPromedio.value = true
      newSensorTipoWidgetSugerido.value = 'metric_card'
      editingSensorId.value = null
      isAddTipoSensorModalOpen.value = false
      await fetchTiposSensor()
    } else {
      tipoSensorFormErrors.value = await handleBackendError(res, 'Error al guardar sensor.')
    }
  } catch {
    toast.error('Error de conexión.')
  }
}

const startEditTipoSensor = (sensor) => {
  editingSensorId.value = sensor.id
  newSensorCodigo.value = sensor.codigo
  newSensorNombreVisible.value = sensor.nombre_visible
  newSensorUnidad.value = sensor.unidad || ''
  newSensorTipoDato.value = sensor.tipo_dato
  newSensorCategoria.value = sensor.categoria || ''
  newSensorDescripcion.value = sensor.descripcion || ''
  newSensorPermiteValorActual.value = sensor.permite_valor_actual
  newSensorPermiteHistorico.value = sensor.permite_historico
  newSensorPermiteAgregacionPromedio.value = sensor.permite_agregacion_promedio
  newSensorTipoWidgetSugerido.value = sensor.tipo_widget_sugerido || 'metric_card'
  isAddTipoSensorModalOpen.value = true
}

const handleDeleteTipoSensor = async (id) => {
  if (!confirm('¿Está seguro de eliminar este tipo de sensor?')) return
  try {
    const res = await api(`/dispositivos/tipos-sensor/${id}/`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Tipo de sensor eliminado correctamente.')
      await fetchTiposSensor()
    } else {
      toast.error('Error al eliminar tipo de sensor.')
    }
  } catch {
    toast.error('Error de conexión.')
  }
}

// 6. Registrar e Instalar Dispositivo Físico (Equipo)
const handleRegisterNode = async () => {
  equipoFormErrors.value = {}
  const empresaId = activeTab.value === 'alta-rapida' ? wizardState.value.empresaId : newEquipoEmpresa.value
  const sitioId = activeTab.value === 'alta-rapida' ? wizardState.value.sitioId : newEquipoSitio.value
  const zonaId = activeTab.value === 'alta-rapida' ? wizardState.value.zonaId : newEquipoZona.value
  const tipoDispId = activeTab.value === 'alta-rapida' ? wizardState.value.tipoDispositivoId : newEquipoTipoDispositivo.value
  const serial = activeTab.value === 'alta-rapida' ? wizardState.value.serial : newEquipoSerial.value
  const name = activeTab.value === 'alta-rapida' ? wizardState.value.nombre : newEquipoNombre.value
  const mqttUser = activeTab.value === 'alta-rapida' ? wizardState.value.mqttUsername : newEquipoMqttUsername.value

  if (!empresaId || !sitioId || !zonaId || !tipoDispId || !serial.trim() || !name.trim()) {
    toast.error('Complete todos los campos obligatorios.')
    return
  }
  const regex = /^[A-Za-z0-9_-]+$/
  if (!regex.test(serial.trim())) {
    equipoFormErrors.value = { serial: ['El serial debe usar solo letras, números, guion bajo y guion medio.'] }
    toast.error('El Serial solo puede contener letras, números, guiones o guiones bajos.')
    return
  }
  try {
    const payload = {
      empresa: empresaId,
      sitio: sitioId,
      zona: zonaId,
      tipo_dispositivo: tipoDispId,
      serial: serial.trim(),
      nombre: name.trim(),
      mqtt_username: mqttUser.trim() || undefined
    }
    const res = await api('/dispositivos/equipos/', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
    if (res.ok) {
      const data = await res.json()
      toast.success(`Dispositivo ${serial} registrado con éxito.`)
      
      if (activeTab.value === 'alta-rapida') {
        wizardState.value.createdEquipo = data
        // Avanzar al paso del Dashboard
        // Al crear un dispositivo físico, el backend asegura el dashboard.
        // Vamos a intentar obtener ese dashboard
        try {
          const dashRes = await api(`/dashboards/templates/?empresa=${empresaId}&tipo_dispositivo=${tipoDispId}`)
          if (dashRes.ok) {
            const dashData = await dashRes.json()
            const results = dashData.results || dashData
            if (results.length > 0) {
              wizardState.value.createdDashboardTemplate = results[0]
            }
          }
        } catch (e) {
          console.error(e)
        }
        wizardStep.value = 7
      } else {
        newEquipoSerial.value = ''
        newEquipoNombre.value = ''
        newEquipoMqttUsername.value = ''
        isAddEquipoModalOpen.value = false
        await fetchEquipos()
      }
    } else {
      equipoFormErrors.value = await handleBackendError(res, 'Error al registrar dispositivo.')
    }
  } catch (error) {
    console.error(error)
    toast.error('Error de conexión al registrar dispositivo.')
  }
}

const handleDeleteEquipo = async (id) => {
  if (!confirm('¿Está seguro de eliminar este dispositivo físico?')) return
  try {
    const res = await api(`/dispositivos/equipos/${id}/`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Dispositivo eliminado con éxito.')
      if (selectedEquipo.value && selectedEquipo.value.id === id) {
        selectedEquipo.value = null
      }
      await fetchEquipos()
    } else {
      toast.error('Error al eliminar dispositivo.')
    }
  } catch {
    toast.error('Error de conexión.')
  }
}

// 7. Sensores Permitidos por Tipo de Dispositivo (Asociación)
const handleAddPermittedSensor = async () => {
  if (!selectedTipoDispositivo.value || !newPermittedSensorId.value) {
    toast.error('Seleccione un sensor global para asociar.')
    return
  }
  try {
    const res = await api('/dispositivos/tipos-dispositivo-sensor/', {
      method: 'POST',
      body: JSON.stringify({
        tipo_dispositivo: selectedTipoDispositivo.value.id,
        tipo_sensor: newPermittedSensorId.value,
        requerido: newPermittedSensorRequerido.value,
        orden: newPermittedSensorOrden.value,
        valor_min: newPermittedSensorMin.value !== null ? newPermittedSensorMin.value : undefined,
        valor_max: newPermittedSensorMax.value !== null ? newPermittedSensorMax.value : undefined,
        activo: true
      })
    })
    if (res.ok) {
      toast.success('Sensor asociado con éxito al tipo de dispositivo.')
      newPermittedSensorId.value = ''
      newPermittedSensorRequerido.value = false
      newPermittedSensorOrden.value = 0
      newPermittedSensorMin.value = null
      newPermittedSensorMax.value = null
      await fetchTipoDispositivoSensors(selectedTipoDispositivo.value.id)
    } else {
      const err = await res.json()
      toast.error('Error al asociar: ' + JSON.stringify(err))
    }
  } catch {
    toast.error('Error de conexión.')
  }
}

const handleRemovePermittedSensor = async (id) => {
  if (!confirm('¿Está seguro de desasociar este sensor de este tipo de dispositivo?')) return
  try {
    const res = await api(`/dispositivos/tipos-dispositivo-sensor/${id}/`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Asociación eliminada.')
      await fetchTipoDispositivoSensors(selectedTipoDispositivo.value.id)
    } else {
      toast.error('Error al eliminar asociación.')
    }
  } catch {
    toast.error('Error de conexión.')
  }
}

// 8. Crear Plantilla de Dashboard Manualmente
const handleCreateDashboardTemplate = async () => {
  if (!selectedTipoDispositivo.value || !selectedCompanyForDashboard.value) return
  await createDashboardTemplate(selectedTipoDispositivo.value.id, selectedCompanyForDashboard.value)
}

const createDashboardTemplate = async (tipoDispositivoId, empresaId) => {
  const emp = empresas.value.find(e => e.id === empresaId)
  const tipo = tiposDispositivo.value.find(t => t.id === tipoDispositivoId)
  try {
    const res = await api('/dashboards/templates/', {
      method: 'POST',
      body: JSON.stringify({
        empresa: empresaId,
        tipo_dispositivo: tipoDispositivoId,
        nombre: `Dashboard ${emp?.nombre || ''} - ${tipo?.nombre || ''}`,
        descripcion: `Plantilla de dashboard para ${emp?.nombre || ''}`,
        activo: true
      })
    })
    if (res.ok) {
      toast.success('Dashboard creado para esta empresa y tipo.')
      await fetchTipoDispositivoDashboard(tipoDispositivoId, empresaId)
    } else {
      toast.error('Error al crear el dashboard template.')
    }
  } catch {
    toast.error('Error de conexión.')
  }
}

// 9. Crear Widget Simple
const handleAddSimpleWidget = async () => {
  const templateId = activeTab.value === 'alta-rapida' 
    ? wizardState.value.createdDashboardTemplate?.id 
    : selectedTipoDispositivoDashboard.value?.id

  if (!templateId || !newWidgetSensorId.value) {
    toast.error('Seleccione un sensor.')
    return
  }

  try {
    const payload = {
      dashboard_template: templateId,
      tipo_sensor: newWidgetSensorId.value,
      visualizacion: newWidgetVisualizacion.value,
      titulo: newWidgetTitulo.value.trim() || undefined
    }

    const res = await api('/dashboards/widgets/simple/', {
      method: 'POST',
      body: JSON.stringify(payload)
    })

    if (res.ok) {
      toast.success('Widget simple agregado con éxito.')
      newWidgetSensorId.value = ''
      newWidgetVisualizacion.value = 'valor_actual'
      newWidgetTitulo.value = ''
      
      try {
        const telemetricsStore = useTelemetricsStore()
        telemetricsStore.fetchDataFromBackend()
      } catch (e) {
        console.error('Failed to reload telemetrics store:', e)
      }
      
      if (activeTab.value === 'alta-rapida') {
        // Recargar widgets en wizard
        await fetchWizardDashboardWidgets()
      } else {
        await fetchDashboardWidgets(templateId)
      }
    } else {
      const err = await res.json()
      toast.error('Error al crear widget: ' + JSON.stringify(err))
    }
  } catch {
    toast.error('Error de conexión.')
  }
}

const handleDeleteWidget = async (widgetId) => {
  if (!confirm('¿Desea eliminar este widget?')) return
  try {
    const res = await api(`/dashboards/widgets/${widgetId}/`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Widget eliminado.')
      
      try {
        const telemetricsStore = useTelemetricsStore()
        telemetricsStore.fetchDataFromBackend()
      } catch (e) {
        console.error('Failed to reload telemetrics store:', e)
      }

      const templateId = activeTab.value === 'alta-rapida' 
        ? wizardState.value.createdDashboardTemplate?.id 
        : selectedTipoDispositivoDashboard.value?.id
      await fetchDashboardWidgets(templateId)
    } else {
      toast.error('Error al eliminar widget.')
    }
  } catch {
    toast.error('Error de conexión.')
  }
}

// 10. Activar / Desactivar Sensores Reales de un Dispositivo Físico
const handleToggleRealSensor = async (sensor) => {
  try {
    const res = await api(`/dispositivos/sensores/${sensor.id}/`, {
      method: 'PUT',
      body: JSON.stringify({
        dispositivo: sensor.dispositivo,
        tipo_sensor: sensor.tipo_sensor,
        nombre_visible: sensor.nombre_visible,
        activo: !sensor.activo
      })
    })
    if (res.ok) {
      toast.success(sensor.activo ? 'Sensor desactivado.' : 'Sensor activado.')
      const equipoId = activeTab.value === 'alta-rapida' ? wizardState.value.createdEquipo?.id : selectedEquipo.value?.id
      await fetchEquipoSensors(equipoId)
    } else {
      toast.error('Error al modificar sensor.')
    }
  } catch {
    toast.error('Error de conexión.')
  }
}

const handleAddRealSensor = async () => {
  const equipoId = activeTab.value === 'alta-rapida' ? wizardState.value.createdEquipo?.id : selectedEquipo.value?.id
  if (!equipoId || !newRealSensorId.value) {
    toast.error('Seleccione un sensor.')
    return
  }
  try {
    const res = await api('/dispositivos/sensores/', {
      method: 'POST',
      body: JSON.stringify({
        dispositivo: equipoId,
        tipo_sensor: newRealSensorId.value,
        nombre_visible: newRealSensorNombreVisible.value.trim() || undefined,
        activo: true
      })
    })
    if (res.ok) {
      toast.success('Sensor activado en este dispositivo.')
      newRealSensorId.value = ''
      newRealSensorNombreVisible.value = ''
      await fetchEquipoSensors(equipoId)
    } else {
      const err = await res.json()
      toast.error('Error al activar sensor: ' + JSON.stringify(err))
    }
  } catch {
    toast.error('Error de conexión.')
  }
}

// ==========================================
// AUXILIARES Y COMPUTEDS
// ==========================================

// Filtrar sensores globales disponibles para agregar como reales en un dispositivo
const availableSensorsForEquipo = computed(() => {
  if (!selectedEquipo.value) return []
  // Los sensores permitidos por el tipo de dispositivo
  const permitted = tiposDispositivo.value.find(t => t.id === selectedEquipo.value.tipo_dispositivo)
  if (!permitted) return []
  
  // Obtenemos los sensores asociados a ese tipo
  // Para simplificar, buscamos en el catálogo global los que correspondan al tipo
  return tiposSensor.value.filter(s => {
    // Si ya existe en selectedEquipoSensors, no mostrarlo
    return !selectedEquipoSensors.value.some(es => es.tipo_sensor === s.id)
  })
})

// ==========================================
// MÉTODOS DE SOPORTE DEL WIZARD (ALTA RÁPIDA)
// ==========================================

const wizardEmpresas = computed(() => empresas.value)
const wizardSitios = ref([])
const wizardZonas = ref([])

watch(() => wizardState.value.empresaId, async (newVal) => {
  wizardState.value.sitioId = ''
  wizardState.value.zonaId = ''
  wizardSitios.value = []
  wizardZonas.value = []
  if (!newVal) return
  try {
    const res = await api(`/empresas/sitios/?empresa=${newVal}`)
    if (res.ok) {
      const data = await res.json()
      wizardSitios.value = data.results || data
    }
  } catch (e) {
    console.error(e)
  }
})

watch(() => wizardState.value.sitioId, async (newVal) => {
  wizardState.value.zonaId = ''
  wizardZonas.value = []
  if (!newVal) return
  try {
    const res = await api(`/empresas/zonas/?sitio=${newVal}`)
    if (res.ok) {
      const data = await res.json()
      wizardZonas.value = data.results || data
    }
  } catch (e) {
    console.error(e)
  }
})

const wizardPermittedSensors = ref([])
watch(() => wizardState.value.tipoDispositivoId, async (newVal) => {
  wizardPermittedSensors.value = []
  if (!newVal) return
  try {
    const res = await api(`/dispositivos/tipos-dispositivo-sensor/?tipo_dispositivo=${newVal}`)
    if (res.ok) {
      const data = await res.json()
      wizardPermittedSensors.value = data.results || data
    }
  } catch (e) {
    console.error(e)
  }
})

// Asociar sensor en el paso 5 del wizard
const handleWizardAddPermittedSensor = async () => {
  if (!wizardState.value.tipoDispositivoId || !newPermittedSensorId.value) return
  try {
    const res = await api('/dispositivos/tipos-dispositivo-sensor/', {
      method: 'POST',
      body: JSON.stringify({
        tipo_dispositivo: wizardState.value.tipoDispositivoId,
        tipo_sensor: newPermittedSensorId.value,
        requerido: newPermittedSensorRequerido.value,
        orden: newPermittedSensorOrden.value,
        activo: true
      })
    })
    if (res.ok) {
      toast.success('Sensor asociado con éxito.')
      newPermittedSensorId.value = ''
      // Recargar
      const refreshRes = await api(`/dispositivos/tipos-dispositivo-sensor/?tipo_dispositivo=${wizardState.value.tipoDispositivoId}`)
      if (refreshRes.ok) {
        const data = await refreshRes.json()
        wizardPermittedSensors.value = data.results || data
      }
    }
  } catch {
    toast.error('Error de conexión.')
  }
}

// Widgets del dashboard creado en el wizard
const wizardWidgets = ref([])
const fetchWizardDashboardWidgets = async () => {
  if (!wizardState.value.createdDashboardTemplate) return
  try {
    const res = await api(`/dashboards/widgets/?dashboard_template=${wizardState.value.createdDashboardTemplate.id}`)
    if (res.ok) {
      const data = await res.json()
      wizardWidgets.value = data.results || data
    }
  } catch (e) {
    console.error(e)
  }
}

watch(() => wizardState.value.createdDashboardTemplate, async (newVal) => {
  if (newVal) {
    await fetchWizardDashboardWidgets()
  }
})

// Sensores reales creados/activados en el wizard paso 8
const wizardEquipoSensors = ref([])
const fetchWizardEquipoSensors = async () => {
  if (!wizardState.value.createdEquipo) return
  try {
    const res = await api(`/dispositivos/sensores/?dispositivo=${wizardState.value.createdEquipo.id}`)
    if (res.ok) {
      const data = await res.json()
      wizardEquipoSensors.value = data.results || data
    }
  } catch (e) {
    console.error(e)
  }
}

// Para activar sensor real en wizard paso 8
const handleWizardToggleRealSensor = async (sensorCode, isActivated) => {
  if (!wizardState.value.createdEquipo) return
  const sensorType = tiposSensor.value.find(s => s.codigo === sensorCode)
  if (!sensorType) return

  // Buscar si ya está creado
  const existing = wizardEquipoSensors.value.find(es => es.tipo_sensor_codigo === sensorCode)
  try {
    if (existing) {
      const res = await api(`/dispositivos/sensores/${existing.id}/`, {
        method: 'PUT',
        body: JSON.stringify({
          dispositivo: wizardState.value.createdEquipo.id,
          tipo_sensor: existing.tipo_sensor,
          nombre_visible: existing.nombre_visible,
          activo: isActivated
        })
      })
      if (res.ok) {
        toast.success(isActivated ? 'Sensor activado.' : 'Sensor desactivado.')
      }
    } else if (isActivated) {
      const res = await api('/dispositivos/sensores/', {
        method: 'POST',
        body: JSON.stringify({
          dispositivo: wizardState.value.createdEquipo.id,
          tipo_sensor: sensorType.id,
          activo: true
        })
      })
      if (res.ok) {
        toast.success('Sensor activado.')
      }
    }
    await fetchWizardEquipoSensors()
  } catch {
    toast.error('Error de conexión.')
  }
}

const handleStartWizard = () => {
  wizardStep.value = 1
  wizardState.value = {
    empresaId: '',
    sitioId: '',
    zonaId: '',
    tipoDispositivoId: '',
    serial: '',
    nombre: '',
    mqttUsername: '',
    createdEquipo: null,
    createdDashboardTemplate: null
  }
}

const copyToClipboard = (text) => {
  navigator.clipboard.writeText(text)
  toast.success('Copiado al portapapeles!')
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
          <h1 class="text-2xl font-bold tracking-tight text-mako-900 dark:text-white">Panel Técnico</h1>
          <p class="text-sm text-mako-500 dark:text-mako-400 mt-0.5">
            Aprovisionamiento modular, catálogo de sensores y configuración de dashboards.
          </p>
        </div>
      </div>
      
      <div class="flex items-center gap-3">
        <button
          v-if="activeTab === 'equipos'"
          @click="isAddEquipoModalOpen = true"
          class="rounded-xl relative w-full sm:w-52 h-12 cursor-pointer flex items-center border border-primary bg-primary group overflow-hidden transition-all hover:shadow-[0_0_20px_rgba(0,209,94,0.4)]"
        >
          <span class="text-white font-semibold w-full text-center sm:text-left sm:ml-5 transform group-hover:translate-x-40 transition-all duration-300 text-sm">
            Nuevo Dispositivo
          </span>
          <span class="absolute right-0 h-full w-12 rounded-xl bg-primary flex items-center justify-center transform group-hover:translate-x-0 group-hover:w-full transition-all duration-300">
            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24"><line x1="12" x2="12" y1="5" y2="19"></line><line x1="5" x2="19" y1="12" y2="12"></line></svg>
          </span>
        </button>
        <button
          v-if="activeTab === 'tipos-dispositivo'"
          @click="isAddTipoDispositivoModalOpen = true"
          class="rounded-xl relative w-full sm:w-52 h-12 cursor-pointer flex items-center border border-primary bg-primary group overflow-hidden transition-all hover:shadow-[0_0_20px_rgba(0,209,94,0.4)]"
        >
          <span class="text-white font-semibold w-full text-center sm:text-left sm:ml-5 transform group-hover:translate-x-40 transition-all duration-300 text-sm">
            Crear Modelo
          </span>
          <span class="absolute right-0 h-full w-12 rounded-xl bg-primary flex items-center justify-center transform group-hover:translate-x-0 group-hover:w-full transition-all duration-300">
            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24"><line x1="12" x2="12" y1="5" y2="19"></line><line x1="5" x2="19" y1="12" y2="12"></line></svg>
          </span>
        </button>
        <button
          v-if="activeTab === 'tipos-sensor'"
          @click="isAddTipoSensorModalOpen = true; editingSensorId = null"
          class="rounded-xl relative w-full sm:w-52 h-12 cursor-pointer flex items-center border border-primary bg-primary group overflow-hidden transition-all hover:shadow-[0_0_20px_rgba(0,209,94,0.4)]"
        >
          <span class="text-white font-semibold w-full text-center sm:text-left sm:ml-5 transform group-hover:translate-x-40 transition-all duration-300 text-sm">
            Nuevo Tipo Sensor
          </span>
          <span class="absolute right-0 h-full w-12 rounded-xl bg-primary flex items-center justify-center transform group-hover:translate-x-0 group-hover:w-full transition-all duration-300">
            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24"><line x1="12" x2="12" y1="5" y2="19"></line><line x1="5" x2="19" y1="12" y2="12"></line></svg>
          </span>
        </button>
      </div>
    </div>

    <!-- Navegación de Pestañas Principales -->
    <div class="flex border-b border-mako-200 dark:border-white/5 gap-2 sm:gap-6 overflow-x-auto whitespace-nowrap scrollbar-hide py-1 px-2">
      <button
        @click="activeTab = 'equipos'"
        class="py-3 px-2 text-sm font-bold border-b-2 transition-all outline-none shrink-0"
        :class="activeTab === 'equipos' ? 'border-primary text-primary' : 'border-transparent text-mako-400 hover:text-mako-600 dark:hover:text-white'"
      >
        Dispositivos Físicos
      </button>
      <button
        @click="activeTab = 'tipos-dispositivo'"
        class="py-3 px-2 text-sm font-bold border-b-2 transition-all outline-none shrink-0"
        :class="activeTab === 'tipos-dispositivo' ? 'border-primary text-primary' : 'border-transparent text-mako-400 hover:text-mako-600 dark:hover:text-white'"
      >
        Modelos (Tipo Dispositivo)
      </button>
      <button
        @click="activeTab = 'tipos-sensor'"
        class="py-3 px-2 text-sm font-bold border-b-2 transition-all outline-none shrink-0"
        :class="activeTab === 'tipos-sensor' ? 'border-primary text-primary' : 'border-transparent text-mako-400 hover:text-mako-600 dark:hover:text-white'"
      >
        Catálogo Sensores
      </button>
      <button
        @click="activeTab = 'alta-rapida'"
        class="py-3 px-2 text-sm font-bold border-b-2 transition-all outline-none shrink-0 flex items-center gap-1.5"
        :class="activeTab === 'alta-rapida' ? 'border-primary text-primary' : 'border-transparent text-mako-400 hover:text-mako-600 dark:hover:text-white'"
      >
        Creación Rápida
      </button>
      <button
        @click="activeTab = 'mqtt'"
        class="py-3 px-2 text-sm font-bold border-b-2 transition-all outline-none shrink-0"
        :class="activeTab === 'mqtt' ? 'border-primary text-primary' : 'border-transparent text-mako-400 hover:text-mako-600 dark:hover:text-white'"
      >
        Diagnóstico MQTT
      </button>
    </div>

    <!-- ==========================================
         TAB: DISPOSITIVOS FÍSICOS (EQUIPOS)
         ========================================== -->
    <div v-if="activeTab === 'equipos'" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Tabla de Equipos -->
      <div class="lg:col-span-2 bg-white/85 dark:bg-mako-800/60 backdrop-blur-xl border border-white/40 dark:border-white/5 rounded-[2rem] shadow-sm overflow-hidden flex flex-col">
        <div class="flex justify-between items-center p-6 border-b border-mako-100 dark:border-white/5">
          <h2 class="text-lg font-bold text-mako-900 dark:text-white">Inventario de Equipos</h2>
          <button @click="fetchEquipos" class="p-2 text-mako-500 hover:text-primary transition-colors bg-mako-100/50 dark:bg-mako-800 rounded-xl" title="Actualizar">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
        </div>

        <div v-if="equipos.length === 0 && !isLoading" class="p-16 text-center">
          <svg class="w-16 h-16 text-mako-300 dark:text-mako-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"></path></svg>
          <h3 class="text-base font-semibold text-mako-600 dark:text-mako-300">No hay equipos registrados</h3>
        </div>

        <div v-else class="overflow-x-auto custom-scrollbar flex-1">
          <table class="w-full text-left whitespace-nowrap">
            <thead class="bg-mako-50 dark:bg-mako-800/50 border-b border-mako-100 dark:border-mako-700/50">
              <tr class="text-[11px] uppercase tracking-widest text-mako-500 dark:text-mako-400 font-bold">
                <th class="px-6 py-4">Serial / Nombre</th>
                <th class="px-6 py-4">Ubicación</th>
                <th class="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-mako-100 dark:divide-mako-800/60">
              <tr 
                v-for="node in equipos" 
                :key="node.id" 
                @click="selectEquipo(node)"
                class="hover:bg-mako-50/50 dark:hover:bg-white/5 cursor-pointer transition-colors"
                :class="selectedEquipo && selectedEquipo.id === node.id ? 'bg-primary/5 dark:bg-primary/5' : ''"
              >
                <td class="px-6 py-4">
                  <div class="font-mono font-bold text-primary">{{ node.serial }}</div>
                  <div class="text-xs text-mako-500 font-medium mt-0.5">{{ node.nombre }}</div>
                </td>
                <td class="px-6 py-4 text-xs">
                  <div class="font-semibold text-mako-700 dark:text-mako-200">{{ node.empresa_codigo || 'N/A' }}</div>
                  <div class="text-[10px] text-mako-400 font-mono mt-0.5">{{ node.sitio_codigo }} / {{ node.zona_codigo || 'Global' }}</div>
                </td>
                <td class="px-6 py-4 text-right" @click.stop>
                  <button @click="handleDeleteEquipo(node.id)" class="p-2 text-mako-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-colors" title="Eliminar"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Panel de Detalles del Equipo Seleccionado -->
      <div class="bg-white/85 dark:bg-mako-800/60 backdrop-blur-xl border border-white/40 dark:border-white/5 rounded-[2rem] shadow-sm overflow-hidden p-6 flex flex-col gap-5">
        <div v-if="!selectedEquipo" class="h-full flex flex-col justify-center items-center text-center p-8">
          <svg class="w-16 h-16 text-mako-300 dark:text-mako-600 mb-4 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <h3 class="text-base font-semibold text-mako-700 dark:text-mako-200">Seleccione un Dispositivo</h3>
          <p class="text-xs text-mako-400 mt-1 max-w-xs">Haga clic en la tabla para ver detalles, tópico MQTT y administrar sensores activos.</p>
        </div>

        <div v-else class="space-y-5 flex-1 flex flex-col">
          <div class="flex items-center justify-between">
            <div>
              <span class="text-[10px] font-bold text-primary uppercase font-mono tracking-widest bg-primary/10 px-2 py-0.5 rounded-full">Dispositivo Seleccionado</span>
              <h2 class="text-xl font-bold mt-1 text-mako-900 dark:text-white truncate max-w-[200px]">{{ selectedEquipo.nombre }}</h2>
            </div>
            <button @click="selectedEquipo = null" class="p-2 text-mako-400 hover:text-mako-700 dark:hover:text-white rounded-lg"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
          </div>

          <!-- Pestañas Internas del Equipo -->
          <div class="flex border-b border-mako-200 dark:border-white/5 gap-4">
            <button 
              @click="selectedEquipoTab = 'detalle'" 
              class="pb-2.5 text-xs font-bold border-b-2 transition-all outline-none"
              :class="selectedEquipoTab === 'detalle' ? 'border-primary text-primary' : 'border-transparent text-mako-400 hover:text-white'"
            >
              Info & MQTT
            </button>
            <button 
              @click="selectedEquipoTab = 'sensores-activos'" 
              class="pb-2.5 text-xs font-bold border-b-2 transition-all outline-none"
              :class="selectedEquipoTab === 'sensores-activos' ? 'border-primary text-primary' : 'border-transparent text-mako-400 hover:text-white'"
            >
              Sensores Activos ({{ selectedEquipoSensors.length }})
            </button>
          </div>

          <!-- SUB-TAB: INFO & MQTT -->
          <div v-if="selectedEquipoTab === 'detalle'" class="space-y-4 flex-1">
            <div class="space-y-2">
              <span class="text-[10px] font-bold text-mako-400 uppercase tracking-widest block">Código Identificador (Serial)</span>
              <div class="bg-mako-100/50 dark:bg-mako-800/40 border border-mako-200 dark:border-mako-700 px-4 py-3 rounded-2xl flex items-center justify-between">
                <span class="font-mono text-sm font-bold text-mako-700 dark:text-mako-200">{{ selectedEquipo.serial }}</span>
                <button @click="copyToClipboard(selectedEquipo.serial)" class="text-xs font-semibold text-primary hover:underline">Copiar</button>
              </div>
            </div>

            <div class="space-y-2">
              <span class="text-[10px] font-bold text-mako-400 uppercase tracking-widest block">Tópico MQTT Telemetría</span>
              <div class="bg-mako-100/50 dark:bg-mako-800/40 border border-mako-200 dark:border-mako-700 px-4 py-3 rounded-2xl flex flex-col gap-1">
                <span class="font-mono text-xs font-bold text-mako-700 dark:text-mako-200 break-all select-all">{{ selectedEquipo.mqtt_topic }}</span>
                <button @click="copyToClipboard(selectedEquipo.mqtt_topic)" class="text-[10px] font-bold text-primary hover:underline text-left mt-1 self-start">Copiar Tópico</button>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div class="bg-mako-100/20 dark:bg-mako-900/10 p-3 rounded-2xl border border-mako-200/50 dark:border-mako-800/50">
                <span class="text-[10px] font-bold text-mako-400 uppercase">MQTT User</span>
                <div class="text-xs font-mono font-bold mt-1 text-mako-700 dark:text-mako-200 truncate">{{ selectedEquipo.mqtt_username || 'Ninguno' }}</div>
              </div>
              <div class="bg-mako-100/20 dark:bg-mako-900/10 p-3 rounded-2xl border border-mako-200/50 dark:border-mako-800/50">
                <span class="text-[10px] font-bold text-mako-400 uppercase">MQTT Password</span>
                <div class="text-xs font-mono font-bold mt-1 text-mako-700 dark:text-mako-200 truncate">••••••••</div>
              </div>
            </div>

            <div class="border-t border-mako-100 dark:border-mako-700/50 pt-4 space-y-2.5">
              <div class="flex justify-between items-center text-xs">
                <span class="text-mako-400">Tipo:</span>
                <span class="font-semibold text-mako-700 dark:text-mako-200">{{ tiposDispositivo.find(t => t.id === selectedEquipo.tipo_dispositivo)?.nombre || 'N/A' }}</span>
              </div>
              <div class="flex justify-between items-center text-xs">
                <span class="text-mako-400">Modelo:</span>
                <span class="font-semibold text-mako-700 dark:text-mako-200">{{ selectedEquipo.tipo_dispositivo_codigo }}</span>
              </div>
              <div class="flex justify-between items-center text-xs">
                <span class="text-mako-400">Último Mensaje:</span>
                <span class="font-mono font-semibold text-mako-700 dark:text-mako-200">{{ selectedEquipo.ultimo_mensaje_en ? new Date(selectedEquipo.ultimo_mensaje_en).toLocaleString('es-CL') : 'Sin datos' }}</span>
              </div>
              <div class="flex justify-between items-center text-xs">
                <span class="text-mako-400">Estado:</span>
                <span class="font-bold" :class="selectedEquipo.activo ? 'text-green-500' : 'text-red-500'">{{ selectedEquipo.activo ? 'Activo' : 'Inactivo' }}</span>
              </div>
            </div>
          </div>

          <!-- SUB-TAB: SENSORES ACTIVOS -->
          <div v-if="selectedEquipoTab === 'sensores-activos'" class="space-y-4 flex-1 flex flex-col">
            <!-- Formulario para Activar Nuevo Sensor -->
            <div class="bg-mako-100/30 dark:bg-mako-900/10 p-4 rounded-3xl border border-mako-200 dark:border-mako-800 space-y-3">
              <span class="text-[10px] font-bold text-mako-400 uppercase tracking-widest block">Activar Sensor Permitido</span>
              <div class="flex flex-col sm:flex-row gap-2">
                <select v-model="newRealSensorId" class="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-mako-800 border border-mako-300 dark:border-mako-700 outline-none text-xs font-semibold">
                  <option value="" disabled>Seleccione sensor...</option>
                  <option v-for="sensor in availableSensorsForEquipo" :key="sensor.id" :value="sensor.id">{{ sensor.nombre_visible }} ({{ sensor.codigo }})</option>
                </select>
                <input v-model="newRealSensorNombreVisible" type="text" placeholder="Alias (opcional)" class="px-3 py-2 rounded-xl bg-white dark:bg-mako-800 border border-mako-300 dark:border-mako-700 outline-none text-xs font-semibold" />
                <button @click="handleAddRealSensor" class="px-3 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:opacity-95 transition-all">Activar</button>
              </div>
            </div>

            <!-- Lista de Sensores Activos en el Dispositivo -->
            <div class="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1 max-h-[30vh]">
              <div v-if="selectedEquipoSensors.length === 0" class="text-center p-8 text-xs text-mako-400">No hay sensores activos. Active sensores desde la lista.</div>
              <div 
                v-for="sensor in selectedEquipoSensors" 
                :key="sensor.id" 
                class="flex items-center justify-between p-3 bg-mako-100/50 dark:bg-mako-800/40 border border-mako-200/50 dark:border-mako-700/50 rounded-2xl hover:border-primary/30 transition-all"
              >
                <div>
                  <div class="font-bold text-xs text-mako-700 dark:text-mako-200">{{ sensor.nombre_visible || sensor.tipo_sensor_codigo }}</div>
                  <div class="font-mono text-[9px] text-mako-400 uppercase mt-0.5">{{ sensor.tipo_sensor_codigo }}</div>
                </div>
                <div class="flex items-center gap-3">
                  <button 
                    @click="handleToggleRealSensor(sensor)"
                    class="px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider rounded-md transition-all"
                    :class="sensor.activo ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'"
                  >
                    {{ sensor.activo ? 'Activo' : 'Inactivo' }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ==========================================
         TAB: MODELOS DE DISPOSITIVO (TIPOS)
         ========================================== -->
    <div v-if="activeTab === 'tipos-dispositivo'" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Tabla Modelos -->
      <div class="lg:col-span-2 bg-white/85 dark:bg-mako-800/60 backdrop-blur-xl border border-white/40 dark:border-white/5 rounded-[2rem] shadow-sm overflow-hidden">
        <div class="p-6 border-b border-mako-100 dark:border-white/5 flex justify-between items-center">
          <h2 class="text-lg font-bold text-mako-900 dark:text-white">Modelos de Dispositivo Globales</h2>
          <button @click="fetchTiposDispositivo" class="p-2 text-mako-500 hover:text-primary transition-colors bg-mako-100/50 dark:bg-mako-800 rounded-xl"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg></button>
        </div>
        <div class="overflow-x-auto custom-scrollbar">
          <table class="w-full text-left whitespace-nowrap">
            <thead class="bg-mako-50 dark:bg-mako-800/50 border-b border-mako-100 dark:border-mako-700/50">
              <tr class="text-[11px] uppercase tracking-widest text-mako-500 dark:text-mako-400 font-bold">
                <th class="px-6 py-4">Código / Modelo</th>
                <th class="px-6 py-4">Nombre Comercial</th>
                <th class="px-6 py-4 text-right">Estado</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-mako-100 dark:divide-mako-800/60">
              <tr 
                v-for="tipo in tiposDispositivo" 
                :key="tipo.id"
                @click="selectTipoDispositivo(tipo)"
                class="hover:bg-mako-50/50 dark:hover:bg-white/5 cursor-pointer transition-colors"
                :class="selectedTipoDispositivo && selectedTipoDispositivo.id === tipo.id ? 'bg-primary/5 dark:bg-primary/5' : ''"
              >
                <td class="px-6 py-4">
                  <div class="font-mono font-bold text-primary">{{ tipo.codigo }}</div>
                  <div class="text-[10px] text-mako-400 font-semibold mt-0.5">{{ tipo.modelo || 'S/M' }}</div>
                </td>
                <td class="px-6 py-4 text-xs font-semibold text-mako-700 dark:text-mako-200">{{ tipo.nombre }}</td>
                <td class="px-6 py-4 text-right">
                  <span class="px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider rounded-md" :class="tipo.activo ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'">{{ tipo.activo ? 'Activo' : 'Inactivo' }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Panel de Detalles del Tipo de Dispositivo -->
      <div class="bg-white/85 dark:bg-mako-800/60 backdrop-blur-xl border border-white/40 dark:border-white/5 rounded-[2rem] shadow-sm overflow-hidden p-6 flex flex-col gap-5">
        <div v-if="!selectedTipoDispositivo" class="h-full flex flex-col justify-center items-center text-center p-8">
          <svg class="w-16 h-16 text-mako-300 dark:text-mako-600 mb-4 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 9.172V5L8 4z" /></svg>
          <h3 class="text-base font-semibold text-mako-700 dark:text-mako-200">Seleccione un Modelo</h3>
          <p class="text-xs text-mako-400 mt-1 max-w-xs">Haga clic en la tabla para gestionar sensores permitidos y plantillas de dashboard.</p>
        </div>

        <div v-else class="space-y-5 flex-1 flex flex-col">
          <div class="flex items-center justify-between">
            <div>
              <span class="text-[10px] font-bold text-primary uppercase font-mono tracking-widest bg-primary/10 px-2 py-0.5 rounded-full">Modelo Seleccionado</span>
              <h2 class="text-xl font-bold mt-1 text-mako-900 dark:text-white truncate max-w-[200px]">{{ selectedTipoDispositivo.nombre }}</h2>
            </div>
            <button @click="selectedTipoDispositivo = null" class="p-2 text-mako-400 hover:text-mako-700 dark:hover:text-white rounded-lg"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
          </div>

          <!-- Pestañas Internas del Modelo -->
          <div class="flex border-b border-mako-200 dark:border-white/5 gap-4">
            <button 
              @click="selectedTipoDispositivoTab = 'detalle'" 
              class="pb-2.5 text-xs font-bold border-b-2 transition-all outline-none"
              :class="selectedTipoDispositivoTab === 'detalle' ? 'border-primary text-primary' : 'border-transparent text-mako-400 hover:text-white'"
            >
              Ficha Técnica
            </button>
            <button 
              @click="selectedTipoDispositivoTab = 'sensores-permitidos'" 
              class="pb-2.5 text-xs font-bold border-b-2 transition-all outline-none"
              :class="selectedTipoDispositivoTab === 'sensores-permitidos' ? 'border-primary text-primary' : 'border-transparent text-mako-400 hover:text-white'"
            >
              Sensores Permitidos ({{ selectedTipoDispositivoSensors.length }})
            </button>
            <button 
              @click="selectedTipoDispositivoTab = 'dashboards'" 
              class="pb-2.5 text-xs font-bold border-b-2 transition-all outline-none"
              :class="selectedTipoDispositivoTab === 'dashboards' ? 'border-primary text-primary' : 'border-transparent text-mako-400 hover:text-white'"
            >
              Dashboards Empresa
            </button>
          </div>

          <!-- SUB-TAB: FICHA TÉCNICA -->
          <div v-if="selectedTipoDispositivoTab === 'detalle'" class="space-y-3 flex-1 text-xs">
            <div>
              <span class="text-[10px] text-mako-400 uppercase tracking-wider font-bold">Código Interno</span>
              <div class="font-mono font-bold text-sm bg-mako-100/50 dark:bg-mako-800/40 border border-mako-200 dark:border-mako-700 px-3 py-2 rounded-xl mt-1">{{ selectedTipoDispositivo.codigo }}</div>
            </div>
            <div>
              <span class="text-[10px] text-mako-400 uppercase tracking-wider font-bold">Modelo Comercial</span>
              <div class="font-bold bg-mako-100/50 dark:bg-mako-800/40 border border-mako-200 dark:border-mako-700 px-3 py-2 rounded-xl mt-1 text-mako-700 dark:text-mako-200">{{ selectedTipoDispositivo.modelo || 'No definido' }}</div>
            </div>
            <div>
              <span class="text-[10px] text-mako-400 uppercase tracking-wider font-bold">Descripción del Equipo</span>
              <p class="text-mako-500 mt-1.5 leading-relaxed bg-mako-100/50 dark:bg-mako-800/40 border border-mako-200 dark:border-mako-700 px-3 py-2 rounded-xl">{{ selectedTipoDispositivo.descripcion || 'Sin descripción' }}</p>
            </div>
          </div>

          <!-- SUB-TAB: SENSORES PERMITIDOS -->
          <div v-if="selectedTipoDispositivoTab === 'sensores-permitidos'" class="space-y-4 flex-1 flex flex-col">
            <!-- Formulario Agregar Sensor Permitido -->
            <div class="bg-mako-100/30 dark:bg-mako-900/10 p-3 rounded-2xl border border-mako-200 dark:border-mako-800 space-y-2">
              <span class="text-[10px] font-bold text-mako-400 uppercase tracking-widest block">Asociar Sensor al Catálogo del Tipo</span>
              <div class="flex flex-col gap-2">
                <select v-model="newPermittedSensorId" class="w-full px-3 py-2 rounded-xl bg-white dark:bg-mako-800 border border-mako-300 dark:border-mako-700 outline-none text-xs font-semibold">
                  <option value="" disabled>Seleccione Sensor Global...</option>
                  <option v-for="sensor in tiposSensor" :key="sensor.id" :value="sensor.id">{{ sensor.nombre_visible }} ({{ sensor.codigo }})</option>
                </select>
                <div class="flex items-center justify-between text-xs gap-3">
                  <div class="flex items-center gap-1.5">
                    <input v-model="newPermittedSensorRequerido" type="checkbox" id="req" class="rounded border-mako-300 text-primary focus:ring-primary" />
                    <label for="req" class="text-[10px] uppercase font-bold text-mako-400">Requerido</label>
                  </div>
                  <div class="flex items-center gap-1">
                    <span class="text-[10px] uppercase font-bold text-mako-400">Orden</span>
                    <input v-model="newPermittedSensorOrden" type="number" class="w-12 px-1.5 py-0.5 rounded border border-mako-300 dark:border-mako-700 text-xs text-center dark:bg-mako-800 outline-none focus:border-primary" />
                  </div>
                  <button @click="handleAddPermittedSensor" class="px-3 py-1.5 rounded-lg bg-primary text-white text-[10px] font-bold uppercase tracking-wider hover:opacity-95 transition-all">Asociar</button>
                </div>
              </div>
            </div>

            <!-- Lista de Sensores Permitidos -->
            <div class="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1 max-h-[30vh]">
              <div v-if="selectedTipoDispositivoSensors.length === 0" class="text-center p-8 text-xs text-mako-400">No hay sensores asociados. Vincule sensores arriba.</div>
              <div 
                v-for="rel in selectedTipoDispositivoSensors" 
                :key="rel.id" 
                class="flex items-center justify-between p-2.5 bg-mako-100/50 dark:bg-mako-800/40 border border-mako-200/50 dark:border-mako-700/50 rounded-xl"
              >
                <div>
                  <div class="font-bold text-xs text-mako-700 dark:text-mako-200">{{ rel.tipo_sensor_codigo }}</div>
                  <div class="text-[9px] text-mako-400">Orden: {{ rel.orden }} <span v-if="rel.requerido" class="text-amber-500 font-bold ml-1">Requerido</span></div>
                </div>
                <button @click="handleRemovePermittedSensor(rel.id)" class="p-1 text-mako-400 hover:text-red-500 transition-colors" title="Desasociar"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
              </div>
            </div>
          </div>

          <!-- SUB-TAB: DASHBOARDS EMPRESA -->
          <div v-if="selectedTipoDispositivoTab === 'dashboards'" class="space-y-4 flex-1 flex flex-col">
            <!-- Selector de Empresa -->
            <div class="space-y-1">
              <span class="text-[10px] font-bold text-mako-400 uppercase tracking-widest block">Seleccionar Empresa</span>
              <select v-model="selectedCompanyForDashboard" class="w-full px-3 py-2 rounded-xl bg-mako-100/50 dark:bg-mako-800/40 border border-mako-200 dark:border-mako-700 outline-none text-xs font-semibold">
                <option value="" disabled>Seleccione...</option>
                <option v-for="emp in empresas" :key="emp.id" :value="emp.id">{{ emp.nombre }}</option>
              </select>
            </div>

            <div v-if="selectedCompanyForDashboard && !selectedTipoDispositivoDashboard" class="p-4 text-center space-y-3 bg-mako-100/30 dark:bg-mako-900/10 rounded-2xl border border-dashed border-mako-300 dark:border-mako-700">
              <p class="text-xs text-mako-400">Esta empresa no posee una plantilla de dashboard para este tipo de dispositivo.</p>
              <button @click="handleCreateDashboardTemplate" class="px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl hover:opacity-95">Crear Plantilla de Dashboard</button>
            </div>

            <div v-else-if="selectedCompanyForDashboard && selectedTipoDispositivoDashboard" class="flex-1 flex flex-col gap-4">
              <!-- Formulario Widget Simple -->
              <div class="bg-mako-100/30 dark:bg-mako-900/10 p-3 rounded-2xl border border-mako-200 dark:border-mako-800 space-y-2">
                <span class="text-[10px] font-bold text-mako-400 uppercase tracking-widest block">Agregar Widget Simple</span>
                <div class="flex flex-col gap-2">
                  <select v-model="newWidgetSensorId" class="w-full px-3 py-2 rounded-xl bg-white dark:bg-mako-800 border border-mako-300 dark:border-mako-700 outline-none text-xs font-semibold">
                    <option value="" disabled>Seleccione Sensor Permitido...</option>
                    <option v-for="rel in selectedTipoDispositivoSensors" :key="rel.tipo_sensor" :value="rel.tipo_sensor">{{ rel.tipo_sensor_codigo }}</option>
                  </select>
                  <div class="flex gap-2">
                    <select v-model="newWidgetVisualizacion" class="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-mako-800 border border-mako-300 dark:border-mako-700 outline-none text-xs font-semibold">
                      <option value="valor_actual">Valor Actual</option>
                      <option value="historico">Histórico (Gráfico)</option>
                      <option value="estado">Estado (Badge)</option>
                      <option value="indicador">Indicador (Gauge)</option>
                    </select>
                    <input v-model="newWidgetTitulo" type="text" placeholder="Título opcional" class="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-mako-800 border border-mako-300 dark:border-mako-700 outline-none text-xs font-semibold" />
                  </div>
                  <button @click="handleAddSimpleWidget" class="w-full px-3 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:opacity-95">Agregar Widget</button>
                </div>
              </div>

              <!-- Lista de Widgets Existentes -->
              <div class="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1 max-h-[30vh]">
                <div v-if="selectedTipoDispositivoDashboardWidgets.length === 0" class="text-center p-6 text-xs text-mako-400">Sin widgets configurados. Añada uno arriba.</div>
                <div 
                  v-for="w in selectedTipoDispositivoDashboardWidgets" 
                  :key="w.id"
                  class="flex items-center justify-between p-2.5 bg-mako-100/50 dark:bg-mako-800/40 border border-mako-200/50 dark:border-mako-700/50 rounded-xl"
                >
                  <div>
                    <div class="font-bold text-xs text-mako-700 dark:text-mako-200">{{ w.titulo }}</div>
                    <div class="text-[9px] text-mako-400 uppercase font-mono">{{ w.tipo_widget }} | {{ w.tipo_sensor_codigo }}</div>
                  </div>
                  <button @click="handleDeleteWidget(w.id)" class="p-1 text-mako-400 hover:text-red-500 transition-colors"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ==========================================
         TAB: CATÁLOGO DE SENSORES (GLOBAL)
         ========================================== -->
    <div v-if="activeTab === 'tipos-sensor'" class="bg-white/85 dark:bg-mako-800/60 backdrop-blur-xl border border-white/40 dark:border-white/5 rounded-[2rem] shadow-sm overflow-hidden animate-fade-in">
      <div class="p-6 border-b border-mako-100 dark:border-white/5 flex items-center justify-between">
        <h2 class="text-lg font-bold text-mako-900 dark:text-white">Tipos de Sensor Globales</h2>
        <button @click="fetchTiposSensor" class="p-2 text-mako-500 hover:text-primary transition-colors bg-mako-100/50 dark:bg-mako-800 rounded-xl"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg></button>
      </div>

      <div class="overflow-x-auto custom-scrollbar">
        <table class="w-full text-left whitespace-nowrap">
          <thead class="bg-mako-50 dark:bg-mako-800/50 border-b border-mako-100 dark:border-mako-700/50">
            <tr class="text-[11px] uppercase tracking-widest text-mako-500 dark:text-mako-400 font-bold">
              <th class="px-6 py-4">Código / Tipo Dato</th>
              <th class="px-6 py-4">Nombre Visible</th>
              <th class="px-6 py-4">Unidad</th>
              <th class="px-6 py-4">Capacidades Backend</th>
              <th class="px-6 py-4">Categoría</th>
              <th class="px-6 py-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-mako-100 dark:divide-mako-800/60">
            <tr v-for="sensor in tiposSensor" :key="sensor.id" class="hover:bg-mako-50/50 dark:hover:bg-white/5 transition-colors">
              <td class="px-6 py-4">
                <div class="font-mono font-bold text-primary">{{ sensor.codigo }}</div>
                <div class="text-[9px] text-mako-400 uppercase font-bold mt-0.5">{{ sensor.tipo_dato }}</div>
              </td>
              <td class="px-6 py-4 text-xs font-semibold text-mako-700 dark:text-mako-200">{{ sensor.nombre_visible }}</td>
              <td class="px-6 py-4 text-xs font-mono text-mako-500">{{ sensor.unidad || 'N/A' }}</td>
              <td class="px-6 py-4 text-xs">
                <div class="flex flex-wrap gap-1.5 max-w-xs">
                  <span v-if="sensor.permite_valor_actual" class="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-bold text-[9px] uppercase">Actual</span>
                  <span v-if="sensor.permite_historico" class="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 font-bold text-[9px] uppercase">Histórico</span>
                  <span v-if="sensor.permite_agregacion_promedio" class="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-500 font-bold text-[9px] uppercase">Promedio</span>
                </div>
              </td>
              <td class="px-6 py-4 text-xs text-mako-500">{{ sensor.categoria || 'Global' }}</td>
              <td class="px-6 py-4 text-right">
                <div class="flex gap-2 justify-end">
                  <button @click="startEditTipoSensor(sensor)" class="p-2 text-mako-400 hover:text-blue-500 hover:bg-blue-500/10 rounded-xl transition-colors" title="Editar"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg></button>
                  <button @click="handleDeleteTipoSensor(sensor.id)" class="p-2 text-mako-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-colors" title="Eliminar"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ==========================================
         TAB: ALTA RÁPIDA (ASISTIDO)
         ========================================== -->
    <div v-if="activeTab === 'alta-rapida'" class="bg-white/85 dark:bg-mako-800/60 backdrop-blur-xl border border-white/40 dark:border-white/5 rounded-[2rem] shadow-sm overflow-hidden p-6 lg:p-8 space-y-6">
      
      <!-- Encabezado del Wizard -->
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-mako-100 dark:border-white/5 pb-4 gap-4">
        <div>
          <h2 class="text-xl font-bold text-mako-900 dark:text-white flex items-center gap-2">
            <span class="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white text-xs font-bold">{{ wizardStep }}</span>
            Asistente de Creación Rápida
          </h2>
          <p class="text-xs text-mako-400 mt-1">Registra empresas, sitios, zonas y dispositivos paso a paso, reutilizando información existente.</p>
        </div>
        <button @click="handleStartWizard" class="text-xs px-3.5 py-2 border border-red-500/30 text-red-500 bg-red-500/5 rounded-xl hover:bg-red-500 hover:text-white font-bold transition-all">Reiniciar Creación Rápida</button>
      </div>

      <!-- Barra de Progreso Visual -->
      <div class="relative w-full h-1 bg-mako-200 dark:bg-mako-800 rounded-full overflow-hidden">
        <div class="absolute top-0 left-0 h-full bg-primary transition-all duration-300" :style="`width: ${(wizardStep / 9) * 100}%`"></div>
      </div>

      <!-- PASOS DEL WIZARD -->

      <!-- PASO 1: SELECCIONAR O CREAR EMPRESA -->
      <div v-if="wizardStep === 1" class="space-y-5">
        <h3 class="text-base font-bold text-mako-800 dark:text-mako-100">Paso 1: Empresa Cliente</h3>
        <div class="max-w-md space-y-4">
          <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">Seleccionar Empresa Existente</label>
          <select v-model="wizardState.empresaId" class="w-full px-4 py-3.5 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none text-sm font-semibold">
            <option value="" disabled>Seleccione...</option>
            <option v-for="emp in wizardEmpresas" :key="emp.id" :value="emp.id">{{ emp.nombre }}</option>
          </select>
          
          <div class="pt-4 border-t border-mako-100 dark:border-mako-800/50 flex justify-between items-center">
            <button @click="isAddClientModalOpen = true" class="text-xs font-bold text-primary hover:underline">o Crear Nueva Empresa cliente</button>
            <button :disabled="!wizardState.empresaId" @click="wizardStep = 2" class="px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-bold disabled:opacity-50">Siguiente</button>
          </div>
        </div>
      </div>

      <!-- PASO 2: SELECCIONAR O CREAR SITIO -->
      <div v-if="wizardStep === 2" class="space-y-5">
        <h3 class="text-base font-bold text-mako-800 dark:text-mako-100">Paso 2: Sitio / Campo</h3>
        <div class="max-w-md space-y-4">
          <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">Seleccionar Sitio en la Empresa</label>
          <select v-model="wizardState.sitioId" class="w-full px-4 py-3.5 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none text-sm font-semibold">
            <option value="" disabled>Seleccione...</option>
            <option v-for="sit in wizardSitios" :key="sit.id" :value="sit.id">{{ sit.nombre }}</option>
          </select>

          <div class="pt-4 border-t border-mako-100 dark:border-mako-800/50 flex justify-between items-center">
            <div class="flex gap-4">
              <button @click="wizardStep = 1" class="text-xs font-bold text-mako-400 hover:text-white">Atrás</button>
              <button @click="isAddSitioModalOpen = true" class="text-xs font-bold text-primary hover:underline">o Crear Nuevo Sitio</button>
            </div>
            <button :disabled="!wizardState.sitioId" @click="wizardStep = 3" class="px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-bold disabled:opacity-50">Siguiente</button>
          </div>
        </div>
      </div>

      <!-- PASO 3: SELECCIONAR O CREAR ZONA -->
      <div v-if="wizardStep === 3" class="space-y-5">
        <h3 class="text-base font-bold text-mako-800 dark:text-mako-100">Paso 3: Zona Jerárquica</h3>
        <div class="max-w-md space-y-4">
          <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">Seleccionar Zona en el Sitio</label>
          <select v-model="wizardState.zonaId" class="w-full px-4 py-3.5 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none text-sm font-semibold">
            <option value="" disabled>Seleccione...</option>
            <option v-for="zon in wizardZonas" :key="zon.id" :value="zon.id">{{ zon.nombre }}</option>
          </select>

          <div class="pt-4 border-t border-mako-100 dark:border-mako-800/50 flex justify-between items-center">
            <div class="flex gap-4">
              <button @click="wizardStep = 2" class="text-xs font-bold text-mako-400 hover:text-white">Atrás</button>
              <button @click="isAddZonaModalOpen = true" class="text-xs font-bold text-primary hover:underline">o Crear Nueva Zona</button>
            </div>
            <button :disabled="!wizardState.zonaId" @click="wizardStep = 4" class="px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-bold disabled:opacity-50">Siguiente</button>
          </div>
        </div>
      </div>

      <!-- PASO 4: SELECCIONAR O CREAR MODELO (TIPO DISPOSITIVO) -->
      <div v-if="wizardStep === 4" class="space-y-5">
        <h3 class="text-base font-bold text-mako-800 dark:text-mako-100">Paso 4: Modelo de Dispositivo</h3>
        <div class="max-w-md space-y-4">
          <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">Seleccionar Modelo</label>
          <select v-model="wizardState.tipoDispositivoId" class="w-full px-4 py-3.5 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none text-sm font-semibold">
            <option value="" disabled>Seleccione...</option>
            <option v-for="tipo in tiposDispositivo" :key="tipo.id" :value="tipo.id">{{ tipo.nombre }} ({{ tipo.modelo || 'S/M' }})</option>
          </select>

          <div class="pt-4 border-t border-mako-100 dark:border-mako-800/50 flex justify-between items-center">
            <div class="flex gap-4">
              <button @click="wizardStep = 3" class="text-xs font-bold text-mako-400 hover:text-white">Atrás</button>
              <button @click="isAddTipoDispositivoModalOpen = true" class="text-xs font-bold text-primary hover:underline">o Crear Nuevo Modelo</button>
            </div>
            <button :disabled="!wizardState.tipoDispositivoId" @click="wizardStep = 5" class="px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-bold disabled:opacity-50">Siguiente</button>
          </div>
        </div>
      </div>

      <!-- PASO 5: REVISAR SENSORES PERMITIDOS -->
      <div v-if="wizardStep === 5" class="space-y-5">
        <div class="flex justify-between items-center">
          <h3 class="text-base font-bold text-mako-800 dark:text-mako-100">Paso 5: Sensores Permitidos por el Modelo</h3>
          <button @click="wizardStep = 6" class="px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-bold">Siguiente</button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Formulario rápido asociar sensor -->
          <div class="bg-mako-100/30 dark:bg-mako-900/10 p-4 rounded-3xl border border-mako-200 dark:border-mako-800 space-y-3">
            <span class="text-xs font-bold text-mako-400 uppercase tracking-widest block">Asociar Sensor a este Modelo</span>
            <select v-model="newPermittedSensorId" class="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-mako-800 border border-mako-300 dark:border-mako-700 outline-none text-xs font-semibold">
              <option value="" disabled>Seleccione Sensor Global...</option>
              <option v-for="sensor in tiposSensor" :key="sensor.id" :value="sensor.id">{{ sensor.nombre_visible }}</option>
            </select>
            <div class="flex items-center justify-between text-xs gap-3">
              <div class="flex items-center gap-1">
                <input v-model="newPermittedSensorRequerido" type="checkbox" id="wizard_req" class="rounded border-mako-300 text-primary focus:ring-primary" />
                <label for="wizard_req" class="text-[10px] uppercase font-bold text-mako-400">Requerido</label>
              </div>
              <button @click="handleWizardAddPermittedSensor" class="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold">Asociar</button>
            </div>
          </div>

          <!-- Tabla de Asociados -->
          <div class="border border-mako-200 dark:border-mako-700 rounded-3xl p-4 bg-white/50 dark:bg-transparent overflow-y-auto max-h-[40vh] custom-scrollbar">
            <span class="text-xs font-bold text-mako-400 uppercase tracking-widest block mb-3">Sensores Vinculados</span>
            <div v-if="wizardPermittedSensors.length === 0" class="text-center py-8 text-xs text-mako-400">Este modelo no tiene sensores asociados en catálogo. Vincule uno a la izquierda.</div>
            <div v-else class="space-y-2">
              <div v-for="rel in wizardPermittedSensors" :key="rel.id" class="flex items-center justify-between p-3 bg-mako-100/50 dark:bg-mako-800/40 border border-mako-200/50 dark:border-mako-700/50 rounded-2xl">
                <div>
                  <div class="font-bold text-xs text-mako-700 dark:text-mako-200">{{ rel.tipo_sensor_codigo }}</div>
                  <div class="text-[10px] text-mako-400 font-semibold mt-0.5"><span v-if="rel.requerido" class="text-amber-500">Requerido</span><span v-else>Opcional</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- PASO 6: CREAR DISPOSITIVO FÍSICO -->
      <div v-if="wizardStep === 6" class="space-y-5">
        <h3 class="text-base font-bold text-mako-800 dark:text-mako-100">Paso 6: Registro del Dispositivo Físico</h3>
        <form @submit.prevent="handleRegisterNode" class="max-w-md space-y-4">
          <div>
            <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">Número de Serie (ID Único)</label>
            <input v-model="wizardState.serial" type="text" placeholder="Ej. num_s_0" class="w-full px-4 py-3.5 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none text-sm font-mono font-semibold transition-all" :class="{'border-red-500': equipoFormErrors.serial}" required />
            <p v-if="equipoFormErrors.serial" class="text-red-500 text-[10px] mt-1">{{ equipoFormErrors.serial[0] }}</p>
          </div>
          <div>
            <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">Nombre del Nodo</label>
            <input v-model="wizardState.nombre" type="text" placeholder="Ej. Estación Clima Los Pinos" class="w-full px-4 py-3.5 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none text-sm font-semibold transition-all" :class="{'border-red-500': equipoFormErrors.nombre}" required />
            <p v-if="equipoFormErrors.nombre" class="text-red-500 text-[10px] mt-1">{{ equipoFormErrors.nombre[0] }}</p>
          </div>
          <div>
            <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">MQTT Username (opcional)</label>
            <input v-model="wizardState.mqttUsername" type="text" placeholder="Ej. user_pinos" class="w-full px-4 py-3.5 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none text-sm font-semibold transition-all" :class="{'border-red-500': equipoFormErrors.mqtt_username}" />
            <p v-if="equipoFormErrors.mqtt_username" class="text-red-500 text-[10px] mt-1">{{ equipoFormErrors.mqtt_username[0] }}</p>
          </div>

          <div class="pt-4 border-t border-mako-100 dark:border-mako-800/50 flex justify-between items-center">
            <button type="button" @click="wizardStep = 5" class="text-xs font-bold text-mako-400 hover:text-white">Atrás</button>
            <button type="submit" class="px-6 py-3 rounded-xl bg-primary text-white font-bold hover:shadow-[0_0_15px_rgba(0,209,94,0.4)]">Crear Dispositivo</button>
          </div>
        </form>
      </div>

      <!-- PASO 7: REVISAR DASHBOARD Y WIDGETS -->
      <div v-if="wizardStep === 7" class="space-y-5">
        <div class="flex justify-between items-center">
          <div>
            <h3 class="text-base font-bold text-mako-800 dark:text-mako-100">Paso 7: Configuración del Dashboard</h3>
            <p class="text-xs text-mako-400 mt-0.5">Define cómo se presentarán visualmente los datos recolectados.</p>
          </div>
          <button @click="wizardStep = 8; fetchWizardEquipoSensors()" class="px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-bold">Siguiente</button>
        </div>

        <div v-if="!wizardState.createdDashboardTemplate" class="p-6 text-center space-y-3 bg-mako-100/30 dark:bg-mako-900/10 rounded-2xl border border-dashed border-mako-300 dark:border-mako-700">
          <p class="text-xs text-mako-400">No hay plantilla de dashboard para esta empresa. Cree una plantilla para habilitar los widgets.</p>
          <button @click="createDashboardTemplate(wizardState.tipoDispositivoId, wizardState.empresaId)" class="px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl">Crear Plantilla</button>
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Formulario widget -->
          <div class="bg-mako-100/30 dark:bg-mako-900/10 p-4 rounded-3xl border border-mako-200 dark:border-mako-800 space-y-3">
            <span class="text-xs font-bold text-mako-400 uppercase tracking-widest block">Agregar Widget al Dashboard</span>
            <div class="space-y-3">
              <div>
                <label class="block text-[10px] font-bold text-mako-400 uppercase tracking-wider mb-1">Sensor</label>
                <select v-model="newWidgetSensorId" class="w-full px-3 py-2 rounded-xl bg-white dark:bg-mako-800 border border-mako-300 dark:border-mako-700 outline-none text-xs font-semibold">
                  <option value="" disabled>Seleccione...</option>
                  <option v-for="rel in wizardPermittedSensors" :key="rel.tipo_sensor" :value="rel.tipo_sensor">{{ rel.tipo_sensor_codigo }}</option>
                </select>
              </div>
              <div>
                <label class="block text-[10px] font-bold text-mako-400 uppercase tracking-wider mb-1">Visualización</label>
                <select v-model="newWidgetVisualizacion" class="w-full px-3 py-2 rounded-xl bg-white dark:bg-mako-800 border border-mako-300 dark:border-mako-700 outline-none text-xs font-semibold">
                  <option value="valor_actual">Valor Actual</option>
                  <option value="historico">Histórico (Gráfico)</option>
                  <option value="estado">Estado (Badge)</option>
                  <option value="indicador">Indicador (Gauge)</option>
                </select>
              </div>
              <div>
                <label class="block text-[10px] font-bold text-mako-400 uppercase tracking-wider mb-1">Título del Widget</label>
                <input v-model="newWidgetTitulo" type="text" placeholder="Temperatura Norte (ejemplo)" class="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-mako-800 border border-mako-300 dark:border-mako-700 outline-none text-xs font-semibold" />
              </div>
              <button @click="handleAddSimpleWidget" class="w-full px-3 py-2.5 rounded-xl bg-primary text-white text-xs font-bold">Crear Widget</button>
            </div>
          </div>

          <!-- Listado widgets creados -->
          <div class="border border-mako-200 dark:border-mako-700 rounded-3xl p-4 bg-white/50 dark:bg-transparent overflow-y-auto max-h-[40vh] custom-scrollbar space-y-2">
            <span class="text-xs font-bold text-mako-400 uppercase tracking-widest block mb-2">Widgets Creados</span>
            <div v-if="wizardWidgets.length === 0" class="text-center py-8 text-xs text-mako-400">Ningún widget configurado aún. Se creará por defecto el visualizador al recibir la telemetría.</div>
            <div v-else class="space-y-2">
              <div v-for="w in wizardWidgets" :key="w.id" class="flex items-center justify-between p-3 bg-mako-100/50 dark:bg-mako-800/40 border border-mako-200/50 dark:border-mako-700/50 rounded-2xl">
                <div>
                  <div class="font-bold text-xs text-mako-700 dark:text-mako-200">{{ w.titulo }}</div>
                  <div class="text-[9px] text-mako-400 uppercase font-mono mt-0.5">{{ w.tipo_widget }} ({{ w.tipo_sensor_codigo }})</div>
                </div>
                <button @click="handleDeleteWidget(w.id)" class="p-1 text-mako-400 hover:text-red-500 transition-colors"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- PASO 8: ACTIVAR SENSORES REALES -->
      <div v-if="wizardStep === 8" class="space-y-5">
        <div class="flex justify-between items-center">
          <div>
            <h3 class="text-base font-bold text-mako-800 dark:text-mako-100">Paso 8: Sensores Reales Activos</h3>
            <p class="text-xs text-mako-400 mt-0.5">Indica qué sensores físicos posee este equipo en particular.</p>
          </div>
          <button @click="wizardStep = 9" class="px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-bold">Siguiente (Finalizar)</button>
        </div>

        <div class="max-w-md border border-mako-200 dark:border-mako-700 rounded-3xl p-5 space-y-4">
          <span class="text-xs font-bold text-mako-400 uppercase tracking-widest block">Sensores Disponibles</span>
          <div class="space-y-2">
            <div v-for="rel in wizardPermittedSensors" :key="rel.id" class="flex items-center justify-between p-3.5 bg-mako-100/50 dark:bg-mako-800/40 border border-mako-200/50 dark:border-mako-700/50 rounded-2xl">
              <div>
                <span class="font-bold text-xs text-mako-700 dark:text-mako-200">{{ rel.tipo_sensor_codigo }}</span>
              </div>
              <button 
                @click="handleWizardToggleRealSensor(rel.tipo_sensor_codigo, !wizardEquipoSensors.some(es => es.tipo_sensor_codigo === rel.tipo_sensor_codigo && es.activo))"
                class="px-3 py-1.5 text-xs font-bold rounded-xl transition-all"
                :class="wizardEquipoSensors.some(es => es.tipo_sensor_codigo === rel.tipo_sensor_codigo && es.activo) ? 'bg-primary text-white' : 'bg-mako-200 dark:bg-mako-800 text-mako-600 dark:text-mako-300'"
              >
                {{ wizardEquipoSensors.some(es => es.tipo_sensor_codigo === rel.tipo_sensor_codigo && es.activo) ? 'Activado' : 'Desactivado' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- PASO 9: DETALLES MQTT DE LA INSTALACIÓN Y TÓPICO -->
      <div v-if="wizardStep === 9" class="space-y-6">
        <h3 class="text-base font-bold text-mako-800 dark:text-mako-100">Paso 9: Resumen de Configuración MQTT</h3>
        
        <div class="bg-green-500/10 border border-green-500/20 rounded-3xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div class="space-y-1">
            <h4 class="text-lg font-bold text-green-500">¡Aprovisionamiento Completado Exitosamente!</h4>
            <p class="text-xs text-mako-400">Entrega estos datos al técnico o incorpóralos en la configuración de firmware del dispositivo.</p>
          </div>
          <button @click="handleStartWizard" class="px-5 py-3 bg-primary text-white font-bold rounded-xl hover:shadow-[0_0_15px_rgba(0,209,94,0.4)] text-sm shrink-0">Provisionar Otro</button>
        </div>

        <div v-if="wizardState.createdEquipo" class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- MQTT Parameters -->
          <div class="border border-mako-200 dark:border-mako-700 rounded-[2rem] p-6 space-y-4 bg-mako-100/20 dark:bg-mako-900/10">
            <h4 class="text-sm font-bold uppercase tracking-wider text-mako-400">Credenciales de Conexión</h4>
            <div class="space-y-3">
              <div>
                <span class="text-[10px] text-mako-400 uppercase font-semibold">Tópico Publicación (Topic)</span>
                <div class="bg-white dark:bg-mako-800 border border-mako-200 dark:border-mako-700 px-3 py-2 rounded-xl mt-1 flex items-center justify-between">
                  <span class="font-mono text-xs font-bold text-mako-700 dark:text-mako-200 break-all select-all">{{ wizardState.createdEquipo.mqtt_topic }}</span>
                  <button @click="copyToClipboard(wizardState.createdEquipo.mqtt_topic)" class="text-[10px] font-bold text-primary shrink-0 ml-2">Copiar</button>
                </div>
              </div>
              <div>
                <span class="text-[10px] text-mako-400 uppercase font-semibold">Client ID (Serial)</span>
                <div class="bg-white dark:bg-mako-800 border border-mako-200 dark:border-mako-700 px-3 py-2 rounded-xl mt-1 flex items-center justify-between">
                  <span class="font-mono text-xs font-bold text-mako-700 dark:text-mako-200">{{ wizardState.createdEquipo.serial }}</span>
                  <button @click="copyToClipboard(wizardState.createdEquipo.serial)" class="text-[10px] font-bold text-primary shrink-0 ml-2">Copiar</button>
                </div>
              </div>
              <div>
                <span class="text-[10px] text-mako-400 uppercase font-semibold">MQTT Username</span>
                <div class="bg-white dark:bg-mako-800 border border-mako-200 dark:border-mako-700 px-3 py-2 rounded-xl mt-1 flex items-center justify-between">
                  <span class="font-mono text-xs font-bold text-mako-700 dark:text-mako-200">{{ wizardState.createdEquipo.mqtt_username || 'Ninguno' }}</span>
                  <button @click="copyToClipboard(wizardState.createdEquipo.mqtt_username || '')" class="text-[10px] font-bold text-primary shrink-0 ml-2">Copiar</button>
                </div>
              </div>
            </div>
          </div>

          <!-- Quick Summary Card -->
          <div class="border border-mako-200 dark:border-mako-700 rounded-[2rem] p-6 space-y-4">
            <h4 class="text-sm font-bold uppercase tracking-wider text-mako-400">Resumen Jerárquico</h4>
            <div class="space-y-2.5 text-xs">
              <div class="flex justify-between">
                <span class="text-mako-400">Empresa:</span>
                <span class="font-semibold text-mako-700 dark:text-mako-200">{{ wizardState.createdEquipo.empresa_codigo }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-mako-400">Sitio:</span>
                <span class="font-semibold text-mako-700 dark:text-mako-200">{{ wizardState.createdEquipo.sitio_codigo }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-mako-400">Zona:</span>
                <span class="font-semibold text-mako-700 dark:text-mako-200">{{ wizardState.createdEquipo.zona_codigo || 'Global' }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-mako-400">Modelo:</span>
                <span class="font-semibold text-mako-700 dark:text-mako-200">{{ wizardState.createdEquipo.tipo_dispositivo_codigo }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-mako-400">Sensores Activos:</span>
                <span class="font-bold text-primary">{{ wizardEquipoSensors.filter(es => es.activo).length }} sensores</span>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>

    <!-- ==========================================
         TAB: DIAGNÓSTICO MQTT (TRAFFIC INGESTION)
         ========================================== -->
    <div v-if="activeTab === 'mqtt'" class="bg-white/85 dark:bg-mako-800/60 backdrop-blur-xl border border-white/40 dark:border-white/5 rounded-[2rem] shadow-sm overflow-hidden animate-fade-in">
      <div class="p-6 border-b border-mako-100 dark:border-white/5 flex justify-between items-center">
        <div>
          <h2 class="text-lg font-bold flex items-center gap-2 text-mako-900 dark:text-white">
            <span class="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.8)]"></span>
            Tráfico de Telemetría Reciente (MQTT)
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


    <!-- ==========================================
         MODALES DE REGISTRO
         ========================================== -->

    <!-- Modal Nuevo Dispositivo Físico -->
    <div v-if="isAddEquipoModalOpen" class="fixed inset-0 bg-mako-950/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div class="bg-white/95 dark:bg-mako-900/95 border border-mako-200 dark:border-white/10 rounded-[2rem] shadow-2xl w-full max-w-2xl p-6 relative max-h-[90vh] overflow-y-auto custom-scrollbar animate-fade-in">
        <button @click="isAddEquipoModalOpen = false" class="absolute top-6 right-6 p-2 rounded-full hover:bg-mako-100 dark:hover:bg-white/10 text-mako-400 transition-colors">
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
              <select v-model="newEquipoEmpresa" class="w-full px-4 py-3.5 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none text-sm font-semibold transition-all" :class="{'border-red-500': equipoFormErrors.empresa}">
                <option value="" disabled>Seleccione...</option>
                <option v-for="empresa in empresas" :key="empresa.id" :value="empresa.id">{{ empresa.nombre }}</option>
              </select>
              <p v-if="equipoFormErrors.empresa" class="text-red-500 text-[10px] mt-1">{{ equipoFormErrors.empresa[0] }}</p>
            </div>
            <div>
              <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">2. Sitio</label>
              <select v-model="newEquipoSitio" :disabled="!newEquipoEmpresa" class="w-full px-4 py-3.5 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none text-sm font-semibold disabled:opacity-50 transition-all" :class="{'border-red-500': equipoFormErrors.sitio}">
                <option value="" disabled>Seleccione...</option>
                <option v-for="sitio in newEquipoSitiosList" :key="sitio.id" :value="sitio.id">{{ sitio.nombre }}</option>
              </select>
              <p v-if="equipoFormErrors.sitio" class="text-red-500 text-[10px] mt-1">{{ equipoFormErrors.sitio[0] }}</p>
            </div>
            <div>
              <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">3. Zona</label>
              <select v-model="newEquipoZona" :disabled="!newEquipoSitio" class="w-full px-4 py-3.5 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none text-sm font-semibold disabled:opacity-50 transition-all" :class="{'border-red-500': equipoFormErrors.zona}">
                <option value="" disabled>Seleccione...</option>
                <option v-for="zona in newEquipoZonasList" :key="zona.id" :value="zona.id">{{ zona.nombre }}</option>
              </select>
              <p v-if="equipoFormErrors.zona" class="text-red-500 text-[10px] mt-1">{{ equipoFormErrors.zona[0] }}</p>
            </div>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">Número de Serie</label>
              <input v-model="newEquipoSerial" type="text" placeholder="Ej. num_s_0" class="w-full px-4 py-3.5 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none text-sm font-mono font-semibold transition-all" :class="{'border-red-500': equipoFormErrors.serial}" required />
              <p v-if="equipoFormErrors.serial" class="text-red-500 text-[10px] mt-1">{{ equipoFormErrors.serial[0] }}</p>
            </div>
            <div>
              <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">Nombre del Nodo</label>
              <input v-model="newEquipoNombre" type="text" placeholder="Ej. Estación Clima Norte" class="w-full px-4 py-3.5 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none text-sm font-semibold transition-all" :class="{'border-red-500': equipoFormErrors.nombre}" required />
              <p v-if="equipoFormErrors.nombre" class="text-red-500 text-[10px] mt-1">{{ equipoFormErrors.nombre[0] }}</p>
            </div>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">Modelo (Tipo Dispositivo)</label>
              <select v-model="newEquipoTipoDispositivo" class="w-full px-4 py-3.5 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none text-sm font-semibold transition-all" :class="{'border-red-500': equipoFormErrors.tipo_dispositivo}">
                <option value="" disabled>Seleccione el modelo...</option>
                <option v-for="tipo in tiposDispositivo" :key="tipo.id" :value="tipo.id">{{ tipo.nombre }}</option>
              </select>
              <p v-if="equipoFormErrors.tipo_dispositivo" class="text-red-500 text-[10px] mt-1">{{ equipoFormErrors.tipo_dispositivo[0] }}</p>
            </div>
            <div>
              <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">MQTT Username (opcional)</label>
              <input v-model="newEquipoMqttUsername" type="text" placeholder="Ej. user_norte" class="w-full px-4 py-3.5 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none text-sm font-semibold transition-all" :class="{'border-red-500': equipoFormErrors.mqtt_username}" />
              <p v-if="equipoFormErrors.mqtt_username" class="text-red-500 text-[10px] mt-1">{{ equipoFormErrors.mqtt_username[0] }}</p>
            </div>
          </div>
          <div class="pt-4 border-t border-mako-200 dark:border-mako-700/50 flex gap-3 justify-end">
            <button type="button" @click="isAddEquipoModalOpen = false" class="px-5 py-3 border border-mako-300 dark:border-mako-700 text-sm font-semibold rounded-xl hover:bg-mako-100 dark:hover:bg-white/5 transition-all">Cancelar</button>
            <button type="submit" class="px-6 py-3 rounded-xl bg-primary text-white font-bold hover:shadow-[0_0_15px_rgba(0,209,94,0.4)] transition-all">Registrar Dispositivo</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal Nuevo Modelo (Tipo Dispositivo) -->
    <div v-if="isAddTipoDispositivoModalOpen" class="fixed inset-0 bg-mako-950/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div class="bg-white/95 dark:bg-mako-900/95 border border-mako-200 dark:border-white/10 rounded-[2rem] shadow-2xl w-full max-w-lg p-6 lg:p-8 relative max-h-[90vh] overflow-y-auto custom-scrollbar animate-fade-in">
        <button @click="isAddTipoDispositivoModalOpen = false" class="absolute top-6 right-6 p-2 rounded-full hover:bg-mako-100 dark:hover:bg-white/10 text-mako-400 transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
        <h3 class="text-xl font-bold mb-6 flex items-center gap-3 text-mako-900 dark:text-white">
          <div class="p-2 bg-primary/10 rounded-xl">
            <svg class="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
          </div>
          Crear Modelo de Dispositivo
        </h3>
        <form @submit.prevent="handleAddTipoDispositivo" class="space-y-5">
          <div>
            <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">Código Único (para Tópico MQTT)</label>
            <input v-model="newTipoDispositivoCodigo" type="text" placeholder="Ej. estacion_meteorologica" class="w-full px-4 py-3.5 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none text-sm font-mono font-bold transition-all" :class="{'border-red-500': tipoDispositivoFormErrors.codigo}" required />
            <p v-if="tipoDispositivoFormErrors.codigo" class="text-red-500 text-[10px] mt-1">{{ tipoDispositivoFormErrors.codigo[0] }}</p>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">Nombre Comercial</label>
              <input v-model="newTipoDispositivoNombre" type="text" placeholder="Ej. Estación Meteorológica Base" class="w-full px-4 py-3.5 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none text-sm font-semibold transition-all" :class="{'border-red-500': tipoDispositivoFormErrors.nombre}" required />
              <p v-if="tipoDispositivoFormErrors.nombre" class="text-red-500 text-[10px] mt-1">{{ tipoDispositivoFormErrors.nombre[0] }}</p>
            </div>
            <div>
              <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">Modelo Físico</label>
              <input v-model="newTipoDispositivoModelo" type="text" placeholder="Davis Pro v2 (no guardado en backend)" class="w-full px-4 py-3.5 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none text-sm font-semibold" />
            </div>
          </div>
          <div>
            <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">Descripción</label>
            <textarea v-model="newTipoDispositivoDescripcion" placeholder="Detalles o capacidades del modelo..." class="w-full px-4 py-3.5 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none text-sm font-semibold h-24 resize-none transition-all" :class="{'border-red-500': tipoDispositivoFormErrors.descripcion}"></textarea>
            <p v-if="tipoDispositivoFormErrors.descripcion" class="text-red-500 text-[10px] mt-1">{{ tipoDispositivoFormErrors.descripcion[0] }}</p>
          </div>
          <div class="pt-4 border-t border-mako-200 dark:border-mako-700/50 flex gap-3 justify-end">
            <button type="button" @click="isAddTipoDispositivoModalOpen = false" class="px-5 py-3 border border-mako-300 dark:border-mako-700 text-sm font-semibold rounded-xl hover:bg-mako-100 dark:hover:bg-white/5 transition-all">Cancelar</button>
            <button type="submit" class="px-6 py-3 rounded-xl bg-primary text-white font-bold hover:shadow-[0_0_15px_rgba(0,209,94,0.4)] transition-all">Crear Modelo</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal Nuevo/Editar Tipo de Sensor -->
    <div v-if="isAddTipoSensorModalOpen" class="fixed inset-0 bg-mako-950/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div class="bg-white/95 dark:bg-mako-900/95 border border-mako-200 dark:border-white/10 rounded-[2rem] shadow-2xl w-full max-w-2xl p-6 lg:p-8 relative max-h-[90vh] overflow-y-auto custom-scrollbar animate-fade-in">
        <button @click="isAddTipoSensorModalOpen = false" class="absolute top-6 right-6 p-2 rounded-full hover:bg-mako-100 dark:hover:bg-white/10 text-mako-400 transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
        <h3 class="text-xl font-bold mb-6 flex items-center gap-3 text-mako-900 dark:text-white">
          <div class="p-2 bg-primary/10 rounded-xl">
            <svg class="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>
          </div>
          {{ editingSensorId ? 'Editar Tipo de Sensor Global' : 'Crear Tipo de Sensor Global' }}
        </h3>
        <form @submit.prevent="handleSaveTipoSensor" class="space-y-5 text-sm">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">Código (para Payload MQTT)</label>
              <input v-model="newSensorCodigo" type="text" placeholder="Ej. temperatura_suelo" class="w-full px-4 py-3.5 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none font-mono font-bold transition-all" :class="{'border-red-500': tipoSensorFormErrors.codigo}" :disabled="!!editingSensorId" required />
              <p v-if="tipoSensorFormErrors.codigo" class="text-red-500 text-[10px] mt-1">{{ tipoSensorFormErrors.codigo[0] }}</p>
            </div>
            <div>
              <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">Nombre Visible</label>
              <input v-model="newSensorNombreVisible" type="text" placeholder="Ej. Temperatura de Suelo" class="w-full px-4 py-3.5 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none font-semibold transition-all" :class="{'border-red-500': tipoSensorFormErrors.nombre_visible}" required />
              <p v-if="tipoSensorFormErrors.nombre_visible" class="text-red-500 text-[10px] mt-1">{{ tipoSensorFormErrors.nombre_visible[0] }}</p>
            </div>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">Unidad de Medida</label>
              <input v-model="newSensorUnidad" type="text" placeholder="Ej. °C, %, hPa" class="w-full px-4 py-3.5 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none font-semibold transition-all" :class="{'border-red-500': tipoSensorFormErrors.unidad}" />
              <p v-if="tipoSensorFormErrors.unidad" class="text-red-500 text-[10px] mt-1">{{ tipoSensorFormErrors.unidad[0] }}</p>
            </div>
            <div>
              <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">Tipo de Dato</label>
              <select v-model="newSensorTipoDato" class="w-full px-4 py-3.5 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none font-semibold transition-all" :class="{'border-red-500': tipoSensorFormErrors.tipo_dato}">
                <option value="integer">Entero (Integer)</option>
                <option value="float">Decimal (Float)</option>
                <option value="boolean">Verdadero/Falso (Boolean)</option>
                <option value="string">Texto (String)</option>
              </select>
              <p v-if="tipoSensorFormErrors.tipo_dato" class="text-red-500 text-[10px] mt-1">{{ tipoSensorFormErrors.tipo_dato[0] }}</p>
            </div>
            <div>
              <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">Categoría</label>
              <input v-model="newSensorCategoria" type="text" placeholder="Ej. clima, suelo, bateria" class="w-full px-4 py-3.5 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none font-semibold transition-all" :class="{'border-red-500': tipoSensorFormErrors.categoria}" />
              <p v-if="tipoSensorFormErrors.categoria" class="text-red-500 text-[10px] mt-1">{{ tipoSensorFormErrors.categoria[0] }}</p>
            </div>
          </div>
          <div>
            <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">Descripción</label>
            <textarea v-model="newSensorDescripcion" placeholder="Detalles de medición del sensor..." class="w-full px-4 py-3.5 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none font-semibold h-20 resize-none transition-all" :class="{'border-red-500': tipoSensorFormErrors.descripcion}"></textarea>
            <p v-if="tipoSensorFormErrors.descripcion" class="text-red-500 text-[10px] mt-1">{{ tipoSensorFormErrors.descripcion[0] }}</p>
          </div>

          <!-- Permisos y Widget Sugerido -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 p-4 bg-mako-100/30 dark:bg-mako-800/20 rounded-3xl border border-mako-200 dark:border-mako-700/60">
            <div class="space-y-3">
              <span class="text-xs uppercase font-bold tracking-wider text-mako-400 block mb-1">Capacidades del Sensor</span>
              <div class="flex items-center justify-between">
                <span class="text-xs">Permite Valor Actual</span>
                <input v-model="newSensorPermiteValorActual" type="checkbox" class="rounded border-mako-300 text-primary focus:ring-primary" />
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs">Permite Histórico</span>
                <input v-model="newSensorPermiteHistorico" type="checkbox" class="rounded border-mako-300 text-primary focus:ring-primary" :disabled="newSensorTipoDato !== 'integer' && newSensorTipoDato !== 'float'" />
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs">Permite Promedio</span>
                <input v-model="newSensorPermiteAgregacionPromedio" type="checkbox" class="rounded border-mako-300 text-primary focus:ring-primary" :disabled="newSensorTipoDato !== 'integer' && newSensorTipoDato !== 'float'" />
              </div>
            </div>
            <div>
              <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-1.5">Widget Sugerido</label>
              <select v-model="newSensorTipoWidgetSugerido" class="w-full px-4 py-3 rounded-xl bg-white dark:bg-mako-800 border border-mako-300 dark:border-mako-700 outline-none font-semibold text-xs">
                <option value="metric_card">Tarjeta Métrica Básica</option>
                <option value="line_chart">Gráfico de Líneas</option>
                <option value="battery_card">Batería / Energía</option>
                <option value="signal_card">Conectividad / Red</option>
                <option value="status_card">Badge de Estado</option>
                <option value="gauge">Indicador Gauge</option>
              </select>
              <p class="text-[10px] text-mako-400 mt-2">La selección de widgets compatibles está restringida por el tipo de dato para evitar fallas de renderizado en el Dashboard.</p>
            </div>
          </div>

          <div class="pt-4 border-t border-mako-200 dark:border-mako-700/50 flex gap-3 justify-end">
            <button type="button" @click="isAddTipoSensorModalOpen = false" class="px-5 py-3 border border-mako-300 dark:border-mako-700 text-sm font-semibold rounded-xl hover:bg-mako-100 dark:hover:bg-white/5 transition-all">Cancelar</button>
            <button type="submit" class="px-6 py-3 rounded-xl bg-primary text-white font-bold hover:shadow-[0_0_15px_rgba(0,209,94,0.4)] transition-all">Guardar Sensor</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modales de Estructura Jerárquica Auxiliares para el Wizard -->
    <!-- Modal Nueva Empresa cliente -->
    <div v-if="isAddClientModalOpen" class="fixed inset-0 bg-mako-950/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div class="bg-white/95 dark:bg-mako-900/95 border border-mako-200 dark:border-white/10 rounded-[2rem] shadow-2xl w-full max-w-lg p-6 relative animate-fade-in">
        <button @click="isAddClientModalOpen = false" class="absolute top-6 right-6 p-2 rounded-full hover:bg-mako-100 dark:hover:bg-white/10 text-mako-400 transition-colors"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
        <h3 class="text-xl font-bold mb-6 flex items-center gap-3 text-mako-900 dark:text-white">Dar de Alta Empresa</h3>
        <form @submit.prevent="handleAddClient" class="space-y-4">
          <div>
            <label class="block text-xs font-bold text-mako-400 uppercase">Nombre Legal</label>
            <input v-model="newClientName" type="text" placeholder="Ej. Agrícola Los Pinos" class="w-full px-4 py-3 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none text-sm font-semibold transition-all" :class="{'border-red-500': clientFormErrors.nombre}" required />
            <p v-if="clientFormErrors.nombre" class="text-red-500 text-[10px] mt-1">{{ clientFormErrors.nombre[0] }}</p>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-mako-400 uppercase">RUT</label>
              <input v-model="newClientRut" type="text" placeholder="76.123.456-7" class="w-full px-4 py-3 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none text-sm font-semibold transition-all" :class="{'border-red-500': clientFormErrors.rut}" required />
              <p v-if="clientFormErrors.rut" class="text-red-500 text-[10px] mt-1">{{ clientFormErrors.rut[0] }}</p>
            </div>
            <div>
              <label class="block text-xs font-bold text-mako-400 uppercase">Código Único</label>
              <input v-model="newClientCode" type="text" placeholder="LOS-PINOS" class="w-full px-4 py-3 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none text-sm font-mono font-bold transition-all" :class="{'border-red-500': clientFormErrors.codigo}" required />
              <p v-if="clientFormErrors.codigo" class="text-red-500 text-[10px] mt-1">{{ clientFormErrors.codigo[0] }}</p>
            </div>
          </div>
          <div class="pt-4 flex gap-3 justify-end">
            <button type="button" @click="isAddClientModalOpen = false" class="px-4 py-2 border rounded-xl hover:bg-white/5 transition-all text-xs font-bold">Cancelar</button>
            <button type="submit" class="px-5 py-2.5 bg-primary text-white font-bold rounded-xl text-xs">Crear</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal Nuevo Sitio -->
    <div v-if="isAddSitioModalOpen" class="fixed inset-0 bg-mako-950/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div class="bg-white/95 dark:bg-mako-900/95 border border-mako-200 dark:border-white/10 rounded-[2rem] shadow-2xl w-full max-w-lg p-6 relative animate-fade-in">
        <button @click="isAddSitioModalOpen = false" class="absolute top-6 right-6 p-2 rounded-full hover:bg-mako-100 dark:hover:bg-white/10 text-mako-400 transition-colors"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
        <h3 class="text-xl font-bold mb-6 flex items-center gap-3 text-mako-900 dark:text-white">Registrar Nuevo Sitio</h3>
        <form @submit.prevent="handleAddSitio" class="space-y-4">
          <div v-if="activeTab !== 'alta-rapida'">
            <label class="block text-xs font-bold text-mako-400 uppercase">Empresa</label>
            <select v-model="newSitioEmpresa" class="w-full px-4 py-3 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none text-sm font-semibold transition-all" :class="{'border-red-500': sitioFormErrors.empresa}">
              <option value="" disabled>Seleccione...</option>
              <option v-for="emp in empresas" :key="emp.id" :value="emp.id">{{ emp.nombre }}</option>
            </select>
            <p v-if="sitioFormErrors.empresa" class="text-red-500 text-[10px] mt-1">{{ sitioFormErrors.empresa[0] }}</p>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-mako-400 uppercase">Nombre del Sitio / Fundo</label>
              <input v-model="newSitioName" type="text" placeholder="Ej. Fundo El Roble" class="w-full px-4 py-3 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none text-sm font-semibold transition-all" :class="{'border-red-500': sitioFormErrors.nombre}" required />
              <p v-if="sitioFormErrors.nombre" class="text-red-500 text-[10px] mt-1">{{ sitioFormErrors.nombre[0] }}</p>
            </div>
            <div>
              <label class="block text-xs font-bold text-mako-400 uppercase">Código Único</label>
              <input v-model="newSitioCode" type="text" placeholder="Ej. ST-01" class="w-full px-4 py-3 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none text-sm font-mono font-bold text-primary transition-all" :class="{'border-red-500': sitioFormErrors.codigo}" required />
              <p v-if="sitioFormErrors.codigo" class="text-red-500 text-[10px] mt-1">{{ sitioFormErrors.codigo[0] }}</p>
            </div>
          </div>
          <div class="pt-4 flex gap-3 justify-end">
            <button type="button" @click="isAddSitioModalOpen = false" class="px-4 py-2 border rounded-xl hover:bg-white/5 transition-all text-xs font-bold">Cancelar</button>
            <button type="submit" class="px-5 py-2.5 bg-primary text-white font-bold rounded-xl text-xs">Crear Sitio</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal Nueva Zona -->
    <div v-if="isAddZonaModalOpen" class="fixed inset-0 bg-mako-950/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div class="bg-white/95 dark:bg-mako-900/95 border border-mako-200 dark:border-white/10 rounded-[2rem] shadow-2xl w-full max-w-lg p-6 relative animate-fade-in">
        <button @click="isAddZonaModalOpen = false" class="absolute top-6 right-6 p-2 rounded-full hover:bg-mako-100 dark:hover:bg-white/10 text-mako-400 transition-colors"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
        <h3 class="text-xl font-bold mb-6 flex items-center gap-3 text-mako-900 dark:text-white">Registrar Nueva Zona</h3>
        <form @submit.prevent="handleAddZona" class="space-y-4">
          <div v-if="activeTab !== 'alta-rapida'" class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-mako-400 uppercase">Empresa</label>
              <select v-model="newZonaEmpresa" class="w-full px-4 py-3 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none text-sm font-semibold transition-all" :class="{'border-red-500': zonaFormErrors.empresa}">
                <option value="" disabled>Seleccione...</option>
                <option v-for="emp in empresas" :key="emp.id" :value="emp.id">{{ emp.nombre }}</option>
              </select>
              <p v-if="zonaFormErrors.empresa" class="text-red-500 text-[10px] mt-1">{{ zonaFormErrors.empresa[0] }}</p>
            </div>
            <div>
              <label class="block text-xs font-bold text-mako-400 uppercase">Sitio</label>
              <select v-model="newZonaSitio" :disabled="!newZonaEmpresa" class="w-full px-4 py-3 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none text-sm font-semibold transition-all" :class="{'border-red-500': zonaFormErrors.sitio}">
                <option value="" disabled>Seleccione...</option>
                <option v-for="sit in newZonaSitiosList" :key="sit.id" :value="sit.id">{{ sit.nombre }}</option>
              </select>
              <p v-if="zonaFormErrors.sitio" class="text-red-500 text-[10px] mt-1">{{ zonaFormErrors.sitio[0] }}</p>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-mako-400 uppercase">Nombre de la Zona / Sector</label>
              <input v-model="newZonaName" type="text" placeholder="Ej. Sector Norte" class="w-full px-4 py-3 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none text-sm font-semibold transition-all" :class="{'border-red-500': zonaFormErrors.nombre}" required />
              <p v-if="zonaFormErrors.nombre" class="text-red-500 text-[10px] mt-1">{{ zonaFormErrors.nombre[0] }}</p>
            </div>
            <div>
              <label class="block text-xs font-bold text-mako-400 uppercase">Código de la Zona</label>
              <input v-model="newZonaCode" type="text" placeholder="Ej. ZN-01" class="w-full px-4 py-3 rounded-xl bg-mako-100 dark:bg-mako-800/40 border border-mako-300 dark:border-mako-700 outline-none text-sm font-mono font-bold text-primary transition-all" :class="{'border-red-500': zonaFormErrors.codigo}" required />
              <p v-if="zonaFormErrors.codigo" class="text-red-500 text-[10px] mt-1">{{ zonaFormErrors.codigo[0] }}</p>
            </div>
          </div>
          <div class="pt-4 flex gap-3 justify-end">
            <button type="button" @click="isAddZonaModalOpen = false" class="px-4 py-2 border rounded-xl hover:bg-white/5 transition-all text-xs font-bold">Cancelar</button>
            <button type="submit" class="px-5 py-2.5 bg-primary text-white font-bold rounded-xl text-xs">Crear Zona</button>
          </div>
        </form>
      </div>
    </div>

  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 99px;
}
.dark .custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
</style>
