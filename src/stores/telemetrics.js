import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '../services/api'
import { useAuthStore } from './auth'
import { fetchWeatherForecast } from '../services/weatherService'

export const useTelemetricsStore = defineStore('telemetrics', () => {
  // --- ESTADO DE CARGA ---
  const isLoading = ref(false)

  // --- CLIENTES ---
  const clients = ref([])

  // --- NODOS REGISTRADOS (Global por Netzona Técnico) ---
  const globalNodes = ref([])

  // --- TRABAJADORES (Gestionado por Cliente Admin) ---
  const workers = ref([])

  // --- CASO 1: PREDIOS AGRÍCOLAS ---
  const predios = ref([])

  // --- CASO 2: CERROS (RADIOCOMUNICACIONES) ---
  const cerros = ref([])

  // --- ACCIONES TÉCNICO NETZONA ---
  const addClient = async (name) => {
    try {
      await api('/empresas/clientes/', {
        method: 'POST',
        body: JSON.stringify({ nombre: name, activo: true })
      })
    } catch (error) {
      console.warn('Backend API missing or failed, using local state fallback for addClient', error)
    }

    const id = `client-${clients.value.length + 1}`
    clients.value.push({ id, name })
    return id
  }

  const registerNode = async (serial, model, type, clientId) => {
    try {
      // Intento de conexión real al backend
      await api('/dispositivos/equipos/', {
        method: 'POST',
        body: JSON.stringify({
          serial: serial,
          nombre: model,
          empresa: clientId,
          activo: true
        })
      })
      await fetchDataFromBackend()
    } catch (error) {
      console.error('Error on registerNode', error)
    }
  }

  // --- ACCIONES CLIENTE ADMIN ---
  const addWorker = async (name, username, selectedPermissions) => {
    const authStore = useAuthStore()
    const empresaId = authStore.currentUser?.empresa || 1

    const nameParts = name.trim().split(/\s+/)
    const nombres = nameParts[0] || ''
    const apellidos = nameParts.slice(1).join(' ') || ''
    const email = username.includes('@') ? username : `${username}@netzona.cl`
    const rut = `12345678-9` // RUT dummy requerido por el backend

    try {
      const res = await api('/cuentas/usuarios/', {
        method: 'POST',
        body: JSON.stringify({
          nombres,
          apellidos,
          email,
          rut,
          empresa: empresaId,
          password: 'Password123!'
        })
      })

      if (res.ok) {
        const newWorker = await res.json()
        
        // Asignar accesos uno a uno
        for (const siteId of selectedPermissions) {
          await api('/cuentas/accesos/', {
            method: 'POST',
            body: JSON.stringify({
              usuario: newWorker.id,
              empresa: empresaId,
              sitio: siteId,
              activo: true
            })
          })
        }
      }
    } catch (error) {
      console.warn('Backend API missing or failed, using fallback logic for addWorker', error)
    }

    await fetchDataFromBackend()
  }

  const removeWorker = async (id) => {
    try {
      const realId = id.toString().replace('worker-', '')
      await api(`/cuentas/usuarios/${realId}/`, { method: 'DELETE' })
    } catch (error) {
      console.warn('Backend API fail on DELETE /cuentas/usuarios/', error)
    }
    await fetchDataFromBackend()
  }

  const updateWorkerPermissions = async (id, newPermissions) => {
    const authStore = useAuthStore()
    const empresaId = authStore.currentUser?.empresa || 1
    const realUserId = id.toString().replace('worker-', '')

    try {
      // 1. Obtener accesos existentes del usuario
      const resAcc = await api(`/cuentas/accesos/?usuario=${realUserId}`)
      let existingAccesos = []
      if (resAcc.ok) {
        const dataAcc = await resAcc.json()
        existingAccesos = dataAcc.results || dataAcc
      }

      // 2. Determinar agregados y eliminados
      const toAdd = newPermissions.filter(siteId => !existingAccesos.some(acc => acc.sitio === siteId && acc.activo))
      const toDelete = existingAccesos.filter(acc => !newPermissions.includes(acc.sitio) && acc.activo)

      // Agregar
      for (const siteId of toAdd) {
        await api('/cuentas/accesos/', {
          method: 'POST',
          body: JSON.stringify({
            usuario: realUserId,
            empresa: empresaId,
            sitio: siteId,
            activo: true
          })
        })
      }

      // Eliminar
      for (const acc of toDelete) {
        await api(`/cuentas/accesos/${acc.id}/`, {
          method: 'DELETE'
        })
      }
    } catch (error) {
      console.warn('Backend API fail on updateWorkerPermissions', error)
    }

    await fetchDataFromBackend()
  }

  // --- ACCIONES DE DISPOSITIVO ---
  const toggleRelay = async (cerroId) => {
    const cerro = cerros.value.find(c => c.id === cerroId)
    if (cerro) {
      cerro.metrics.relayState = !cerro.metrics.relayState
      
      try {
        // Enviar señal MQTT mediante API backend
        const repSerial = cerro.repeaters[0]?.serial || 'UNKNOWN'
        await api(`/dispositivos/${repSerial}/comando/`, {
          method: 'POST',
          body: JSON.stringify({ 
            accion: 'toggle_relay', 
            estado: cerro.metrics.relayState 
          })
        })
      } catch (error) {
        console.warn('Backend API missing or failed, using local state fallback for toggleRelay', error)
      }
    }
  }

  // --- ACTUALIZACIÓN DE MÉTRICAS (LONG POLLING API REAL) ---
  const updateRealtimeMetrics = async () => {
    try {
      // Polling para Predios Agrícolas
      for (const p of predios.value) {
        for (const s of p.sensors) {
          try {
            const res = await api(`/dispositivos/${s.serial}/estado-actual/`)
            if (res.ok) {
              const data = await res.json()
              const time = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
              // Data es usualmente un listado o diccionario. Actualizamos si encontramos el código:
              if (data['TEMPERATURA']) {
                p.metrics.temperature = data['TEMPERATURA'].valor
                p.history.temperature.push({ x: time, y: data['TEMPERATURA'].valor })
                if (p.history.temperature.length > 30) p.history.temperature.shift()
              }
              if (data['HUMEDAD']) {
                p.metrics.humidity = data['HUMEDAD'].valor
                p.history.humidity.push({ x: time, y: data['HUMEDAD'].valor })
                if (p.history.humidity.length > 30) p.history.humidity.shift()
              }
              if (data['BATERIA']) p.metrics.battery = data['BATERIA'].valor
              if (data['VOLTAJE_PANEL']) p.metrics.solarPanelVoltage = data['VOLTAJE_PANEL'].valor
            }
          } catch {}
        }
      }

      // Polling para Cerros Telecomunicaciones
      for (const c of cerros.value) {
        for (const r of c.repeaters) {
          try {
            const res = await api(`/dispositivos/${r.serial}/estado-actual/`)
            if (res.ok) {
              const data = await res.json()
              const time = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
              
              if (data['VOLTAJE']) {
                c.metrics.voltage = data['VOLTAJE'].valor
                c.history.voltage.push({ x: time, y: data['VOLTAJE'].valor })
                if (c.history.voltage.length > 30) c.history.voltage.shift()
              }
              if (data['POTENCIA']) {
                c.metrics.power = data['POTENCIA'].valor
                c.history.power.push({ x: time, y: data['POTENCIA'].valor })
                if (c.history.power.length > 30) c.history.power.shift()
              }
              if (data['BATERIA']) c.metrics.battery = data['BATERIA'].valor
            }
          } catch {}
        }
      }
    } catch (e) {
      console.warn("Polling de estado actual fallido", e)
    }
  }

  // --- INTEGRACIÓN REAL CON BACKEND ---
  const fetchDataFromBackend = async () => {
    isLoading.value = true
    try {
      // 1. Obtener Sitios
      const resSitios = await api('/empresas/sitios/')
      if (!resSitios.ok) throw new Error('Error al obtener sitios')
      const dataSitios = await resSitios.json()
      const sitios = dataSitios.results || dataSitios

      const newPredios = []
      const newCerros = []

      // Procesar cada sitio
      for (const sitio of sitios) {
        // Estructura base mapeada al frontend
        const mapped = {
          id: sitio.id,
          name: sitio.nombre,
          client: sitio.empresa_id,
          lat: sitio.latitud ? parseFloat(sitio.latitud) : -36.6083,
          lng: sitio.longitud ? parseFloat(sitio.longitud) : -72.1022,
          zoom: 15,
          dashboard_template_id: null,
          sensors: [],
          repeaters: [],
          metrics: {
            temperature: 0, temp_widget_id: 'widget-temp',
            humidity: 0, hum_widget_id: 'widget-hum',
            soilMoisture: 0, soil_widget_id: 'widget-soil',
            battery: 0, bat_widget_id: 'widget-bat',
            solarPanelVoltage: 0, solar_widget_id: 'widget-solar',
            voltage: 0, volt_widget_id: 'widget-volt',
            power: 0, pow_widget_id: 'widget-pow',
            windSpeed: 0,
            batteryTemp: 0,
            doorOpen: false,
            relayState: false,
          },
          history: {
            temperature: [],
            humidity: [],
            soilMoisture: [],
            voltage: [],
            power: [],
          },
          weatherForecast: [
            { day: 'Lun', temp: '15°C', status: 'Despejado', icon: 'Sun' }
          ]
        }

        // Obtener dispositivos del sitio
        const resDisp = await api(`/dispositivos/equipos/?sitio=${sitio.id}`)
        if (resDisp.ok) {
          const dataDisp = await resDisp.json()
          const dispositivos = dataDisp.results || dataDisp

          for (const d of dispositivos) {
            mapped.sensors.push({
              id: d.id,
              name: d.nombre,
              serial: d.serial,
              latOffset: (Math.random() - 0.5) * 0.005,
              lngOffset: (Math.random() - 0.5) * 0.005,
              value: 0,
              unit: ''
            })

            mapped.repeaters.push({
              id: d.id,
              name: d.nombre,
              serial: d.serial
            })

            // Intentar obtener el dashboard del dispositivo para extraer métricas actuales
            try {
              const resDash = await api(`/dispositivos/${d.serial}/dashboard/`)
              if (resDash.ok) {
                const dash = await resDash.json()
                if (dash.dashboard && dash.dashboard.id) {
                  mapped.dashboard_template_id = dash.dashboard.id
                }
                const widgets = dash.dashboard ? dash.dashboard.widgets : dash.widgets || []
                widgets.forEach(w => {
                  const val = w.valor || 0
                  if (w.codigo_sensor === 'TEMPERATURA' || w.titulo.toLowerCase().includes('temp')) { mapped.metrics.temperature = val; mapped.metrics.temp_widget_id = w.id }
                  if (w.codigo_sensor === 'HUMEDAD' || w.titulo.toLowerCase().includes('hum')) { mapped.metrics.humidity = val; mapped.metrics.hum_widget_id = w.id }
                  if (w.codigo_sensor === 'BATERIA' || w.titulo.toLowerCase().includes('bat')) { mapped.metrics.battery = val; mapped.metrics.bat_widget_id = w.id }
                  if (w.codigo_sensor === 'VOLTAJE' || w.titulo.toLowerCase().includes('volt')) { mapped.metrics.voltage = val; mapped.metrics.volt_widget_id = w.id }
                  if (w.codigo_sensor === 'POTENCIA' || w.titulo.toLowerCase().includes('pot')) { mapped.metrics.power = val; mapped.metrics.pow_widget_id = w.id }
                  // Asumimos soil moisture y solar panel con los restantes
                  if (w.codigo_sensor === 'HUMEDAD_SUELO' || w.titulo.toLowerCase().includes('suelo')) { mapped.metrics.soilMoisture = val; mapped.metrics.soil_widget_id = w.id }
                  if (w.codigo_sensor === 'VOLTAJE_PANEL' || w.titulo.toLowerCase().includes('panel')) { mapped.metrics.solarPanelVoltage = val; mapped.metrics.solar_widget_id = w.id }
                })
              }

              // Llamar endpoints reales para Gráficos Históricos de sensores activos
              const codigosPresentes = widgets.map(w => w.codigo_sensor).filter(Boolean)
              for (const cod of codigosPresentes) {
                try {
                  const resHist = await api(`/dispositivos/${d.serial}/sensores/${cod}/historial/`)
                  if (resHist.ok) {
                    const dataHist = await resHist.json()
                    // dataHist = [{ valor: 12.5, timestamp: '2023-10-05T10:00:00Z' }, ...]
                    const chartData = dataHist.map(h => ({
                      x: new Date(h.timestamp || h.fecha).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                      y: h.valor
                    }))
                    
                    if (chartData.length > 0) {
                      if (cod === 'TEMPERATURA') mapped.history.temperature = chartData
                      if (cod === 'HUMEDAD') mapped.history.humidity = chartData
                      if (cod === 'HUMEDAD_SUELO') mapped.history.soilMoisture = chartData
                      if (cod === 'VOLTAJE_PANEL') mapped.history.solarPanelVoltage = chartData
                      if (cod === 'VOLTAJE') mapped.history.voltage = chartData
                      if (cod === 'POTENCIA') mapped.history.power = chartData
                    }
                  }
                } catch {}
              }
            } catch {
              // Ignore if dashboard not configured
            }
          }
        }

        // Clasificar como Cerro o Predio (Simplificación: si tiene "cerro", "radio" o "repeater" en nombre/desc)
        const isCerro = sitio.nombre.toLowerCase().includes('cerro') || sitio.descripcion?.toLowerCase().includes('radio')
        if (isCerro) {
          // Intentar cargar el clima de OpenWeatherMap usando las coordenadas
          const realWeather = await fetchWeatherForecast(mapped.lat, mapped.lng)
          if (realWeather) {
            mapped.weatherForecast = realWeather
          }
          newCerros.push(mapped)
        } else {
          newPredios.push(mapped)
        }
      }

      // Si el backend retornó sitios, reemplazamos los mocks
      if (newPredios.length > 0) predios.value = newPredios
      if (newCerros.length > 0) cerros.value = newCerros

      // 2. Obtener Clientes (Empresas)
      try {
        const resClientes = await api('/empresas/clientes/')
        if (resClientes.ok) {
          const dataClientes = await resClientes.json()
          const clientesList = dataClientes.results || dataClientes
          clients.value = clientesList.map(c => ({ id: c.id, name: c.nombre }))
        }
      } catch {}

      // 3. Obtener Trabajadores (Usuarios) y sus Accesos
      try {
        const resWorkers = await api('/cuentas/usuarios/')
        const resAccesos = await api('/cuentas/accesos/?activo=true')
        if (resWorkers.ok) {
          const dataWorkers = await resWorkers.json()
          const workersList = dataWorkers.results || dataWorkers
          
          let accesosList = []
          if (resAccesos && resAccesos.ok) {
            const dataAccesos = await resAccesos.json()
            accesosList = dataAccesos.results || dataAccesos
          }

          workers.value = workersList.map(w => {
            let role = 'trabajador'
            if (w.is_superuser || (w.group_names && w.group_names.includes('admin_netzona'))) {
              role = 'admin'
            } else if (w.group_names && w.group_names.includes('tecnico')) {
              role = 'tecnico'
            }

            const userAccesos = accesosList
              .filter(acc => acc.usuario === w.id)
              .map(acc => acc.sitio)
              .filter(Boolean)

            return {
              id: w.id,
              name: `${w.nombres || ''} ${w.apellidos || ''}`.trim() || w.email || w.username,
              username: w.email || w.username,
              role: role,
              permissions: userAccesos
            }
          })
        }
      } catch {}

      // 4. Obtener Nodos Globales (Todos los Dispositivos)
      try {
        const resGlobal = await api('/dispositivos/equipos/')
        if (resGlobal.ok) {
          const dataGlobal = await resGlobal.json()
          const globalList = dataGlobal.results || dataGlobal
          globalNodes.value = globalList.map(d => ({
            id: d.id,
            serial: d.serial,
            model: d.nombre,
            type: d.sitio_id ? 'asignado' : 'sin_asignar', // O la lógica real
            clientId: d.empresa_id,
            assigned: !!d.sitio_id
          }))
        }
      } catch {}

    } catch (e) {
      console.error('Failed to sync telemetrics from backend:', e)
    } finally {
      isLoading.value = false
    }
  }

  const fetchSiteHistory = async (siteId, isCerro, range = '24h') => {
    try {
      const resDisp = await api(`/dispositivos/equipos/?sitio=${siteId}`)
      if (!resDisp.ok) return
      
      const dispositivos = await resDisp.json()
      const listDisp = dispositivos.results || dispositivos
      
      const siteList = isCerro ? cerros.value : predios.value
      const site = siteList.find(s => s.id === siteId)
      if (!site) return

      for (const d of listDisp) {
        try {
          const resDash = await api(`/dispositivos/${d.serial}/dashboard/`)
          if (resDash.ok) {
            const dash = await resDash.json()
            const widgets = dash.dashboard ? dash.dashboard.widgets : dash.widgets || []
            const codigosPresentes = widgets.map(w => w.codigo_sensor).filter(Boolean)
            
            for (const cod of codigosPresentes) {
              try {
                const resHist = await api(`/dispositivos/${d.serial}/sensores/${cod}/historial/?rango=${range}`)
                if (resHist.ok) {
                  const dataHist = await resHist.json()
                  const chartData = dataHist.map(h => {
                    const date = new Date(h.timestamp || h.fecha)
                    const label = range === '24h' 
                      ? date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                      : date.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' }) + ' ' + date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
                    return { x: label, y: h.valor }
                  })
                  
                  if (chartData.length > 0) {
                    if (cod === 'TEMPERATURA') site.history.temperature = chartData
                    if (cod === 'HUMEDAD') site.history.humidity = chartData
                    if (cod === 'HUMEDAD_SUELO') site.history.soilMoisture = chartData
                    if (cod === 'VOLTAJE_PANEL') site.history.solarPanelVoltage = chartData
                    if (cod === 'VOLTAJE') site.history.voltage = chartData
                    if (cod === 'POTENCIA') site.history.power = chartData
                  }
                }
              } catch {}
            }
          }
        } catch {}
      }
    } catch (e) {
      console.error('Error al actualizar historial', e)
    }
  }

  return {
    isLoading,
    clients,
    globalNodes,
    workers,
    predios,
    cerros,
    addClient,
    registerNode,
    addWorker,
    removeWorker,
    updateWorkerPermissions,
    toggleRelay,
    updateRealtimeMetrics,
    fetchDataFromBackend,
    fetchSiteHistory,
  }
})
