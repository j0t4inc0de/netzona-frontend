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
  const groups = ref([])

  // --- CERROS (SITIOS) ---
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
      await fetchWorkersFromBackend()
    } catch (error) {
      console.error('Error on registerNode', error)
    }
  }

  // --- ACCIONES CLIENTE ADMIN ---
  const addWorker = async (name, username, selectedPermissions, groupId = null, rut = '', empresaId = null) => {
    const authStore = useAuthStore()
    const finalEmpresaId = empresaId || authStore.currentUser?.empresa || 1

    const nameParts = name.trim().split(/\s+/)
    const nombres = nameParts[0] || ''
    const apellidos = nameParts.slice(1).join(' ') || ''
    const email = username.includes('@') ? username.trim().toLowerCase() : `${username.trim().toLowerCase()}@netzona.cl`

    const body = {
      nombres,
      apellidos,
      email,
      rut: rut.trim(),
      empresa: finalEmpresaId
    }

    if (groupId) {
      body.groups = [groupId]
    }

    try {
      const res = await api('/cuentas/usuarios/', {
        method: 'POST',
        body: JSON.stringify(body)
      })

      if (res.ok) {
        const newWorker = await res.json()

        // Asignar accesos de manera secuencial para evitar SQLite locking errors
        if (selectedPermissions && selectedPermissions.length > 0) {
          for (const siteId of selectedPermissions) {
            const accRes = await api('/cuentas/accesos/', {
              method: 'POST',
              body: JSON.stringify({
                usuario: newWorker.id,
                empresa: finalEmpresaId,
                sitio: siteId,
                activo: true
              })
            })
            if (!accRes.ok) console.warn('No se pudo asignar acceso', siteId)
          }
        }
      } else {
        const errData = await res.json().catch(() => ({}))
        throw errData
      }
    } catch (error) {
      console.error('Error on addWorker', error)
      throw error
    }

    await fetchWorkersFromBackend()
  }

  const removeWorker = async (id) => {
    try {
      const realId = id.toString().replace('worker-', '')
      const res = await api(`/cuentas/usuarios/${realId}/`, { method: 'DELETE' })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw errData
      }
    } catch (error) {
      console.error('Backend API fail on removeWorker', error)
      throw error
    }

    // Remover del estado local inmediatamente
    workers.value = workers.value.filter(w => w.id !== id)

    await fetchDataFromBackend()
  }

  const updateWorkerPermissions = async (id, newPermissions) => {
    const authStore = useAuthStore()
    const realUserId = id.toString().replace('worker-', '')
    const worker = workers.value.find(w => w.id === id)
    const finalEmpresaId = worker?.empresa || authStore.currentUser?.empresa || 1

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

      // Agregar en secuencial para prevenir SQLite lock
      for (const siteId of toAdd) {
        const cerro = cerros.value.find(c => c.id === siteId)
        const siteEmpresa = cerro?.client || finalEmpresaId

        const accRes = await api('/cuentas/accesos/', {
          method: 'POST',
          body: JSON.stringify({
            usuario: realUserId,
            empresa: siteEmpresa,
            sitio: siteId,
            activo: true
          })
        })
        if (!accRes.ok) console.warn('Error al agregar acceso', siteId)
      }

      // Eliminar en secuencial
      for (const acc of toDelete) {
        await api(`/cuentas/accesos/${acc.id}/`, {
          method: 'DELETE'
        })
      }
    } catch (error) {
      console.error('Backend API fail on updateWorkerPermissions', error)
      throw error
    }

    await fetchWorkersFromBackend()
  }

  // --- ACCIONES DE DISPOSITIVO ---
  const toggleRelay = async (cerroId, zonaId) => {
    const cerro = cerros.value.find(c => c.id === cerroId)
    if (cerro) {
      const zona = cerro.zonas.find(z => z.id === zonaId)
      if (zona) {
        zona.metrics.relayState = !zona.metrics.relayState
        
        try {
          // Enviar señal MQTT mediante API backend
          const repSerial = zona.repeaters[0]?.serial || 'UNKNOWN'
          await api(`/dispositivos/${repSerial}/comando/`, {
            method: 'POST',
            body: JSON.stringify({ 
              accion: 'toggle_relay', 
              estado: zona.metrics.relayState 
            })
          })
        } catch (error) {
          console.warn('Backend API missing or failed, using local state fallback for toggleRelay', error)
        }
      }
    }
  }

  // --- ACTUALIZACIÓN DE MÉTRICAS (LONG POLLING API REAL) ---
  const updateRealtimeMetrics = async () => {
    try {
      for (const cerro of cerros.value) {
        for (const zona of cerro.zonas) {
          for (const s of zona.sensors) {
            try {
              const res = await api(`/dispositivos/${s.serial}/estado-actual/`)
              if (res.ok) {
                const data = await res.json()
                const time = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                if (data['TEMPERATURA']) {
                  zona.metrics.temperature = data['TEMPERATURA'].valor
                  zona.history.temperature.push({ x: time, y: data['TEMPERATURA'].valor })
                  if (zona.history.temperature.length > 30) zona.history.temperature.shift()
                }
                if (data['HUMEDAD']) {
                  zona.metrics.humidity = data['HUMEDAD'].valor
                  zona.history.humidity.push({ x: time, y: data['HUMEDAD'].valor })
                  if (zona.history.humidity.length > 30) zona.history.humidity.shift()
                }
                if (data['BATERIA']) zona.metrics.battery = data['BATERIA'].valor
                if (data['VOLTAJE_PANEL']) zona.metrics.solarPanelVoltage = data['VOLTAJE_PANEL'].valor
              }
            } catch {
              // ignore error
            }
          }

          for (const r of zona.repeaters) {
            try {
              const res = await api(`/dispositivos/${r.serial}/estado-actual/`)
              if (res.ok) {
                const data = await res.json()
                const time = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                
                if (data['VOLTAJE']) {
                  zona.metrics.voltage = data['VOLTAJE'].valor
                  zona.history.voltage.push({ x: time, y: data['VOLTAJE'].valor })
                  if (zona.history.voltage.length > 30) zona.history.voltage.shift()
                }
                if (data['POTENCIA']) {
                  zona.metrics.power = data['POTENCIA'].valor
                  zona.history.power.push({ x: time, y: data['POTENCIA'].valor })
                  if (zona.history.power.length > 30) zona.history.power.shift()
                }
                if (data['BATERIA']) zona.metrics.battery = data['BATERIA'].valor
              }
            } catch {
              // ignore error
            }
          }
        }
      }
    } catch (e) {
      console.warn("Polling de estado actual fallido", e)
    }
  }

  // --- RECARGAR SOLO TRABAJADORES ---
  const fetchWorkersFromBackend = async () => {
    try {
      const resWorkers = await api('/cuentas/usuarios/')
      const resAccesos = await api('/cuentas/accesos/?activo=True')
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
            role = 'tecnico'
          } else if (w.group_names && w.group_names.includes('cliente_empresa')) {
            role = 'admin'
          }

          const userAccesos = accesosList
            .filter(acc => acc.usuario === w.id)
            .map(acc => acc.sitio)
            .filter(Boolean)

          return {
            id: w.id,
            name: `${w.nombres || ''} ${w.apellidos || ''}`.trim() || w.email || w.username,
            username: w.email || w.username,
            nombres: w.nombres || '',
            apellidos: w.apellidos || '',
            rut: w.rut || '',
            role: role,
            empresa: w.empresa,
            group_names: w.group_names || [],
            groups: w.groups || [],
            permissions: userAccesos
          }
        })
      }
    } catch (e) {
      console.error('Error al sincronizar trabajadores:', e)
    }
  }

  // --- INTEGRACIÓN REAL CON BACKEND ---
  const fetchDataFromBackend = async () => {
    const authStore = useAuthStore()
    isLoading.value = true
    
    // 1. Obtener Sitios (Cerros)
    const fetchSitios = async () => {
      try {
        const resSitios = await api('/empresas/sitios/')
        if (resSitios.ok) {
          const dataSitios = await resSitios.json()
          const sitios = dataSitios.results || dataSitios

          const newCerros = await Promise.all(sitios.map(async (sitio) => {
            const cerro = {
              id: sitio.id,
              name: sitio.nombre,
              client: sitio.empresa,
              lat: sitio.latitud ? parseFloat(sitio.latitud) : -36.6083,
              lng: sitio.longitud ? parseFloat(sitio.longitud) : -72.1022,
              zoom: 15,
              zonas: []
            }

            try {
              const resDisp = await api(`/dispositivos/equipos/?sitio=${sitio.id}`)
              let allDispositivos = []
              if (resDisp.ok) {
                const dataDisp = await resDisp.json()
                allDispositivos = dataDisp.results || dataDisp
              }

              const resZonas = await api(`/empresas/zonas/?sitio=${sitio.id}`)
              if (resZonas.ok) {
                const dataZonas = await resZonas.json()
                const zonas = dataZonas.results || dataZonas

                const zonasPromises = zonas.map(async (zona) => {
                  const mappedZona = {
                    id: zona.id,
                    name: zona.nombre,
                    cerroId: sitio.id,
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
                    widgets: [],
                    weatherForecast: [
                      { day: 'Lun', temp: '15°C', status: 'Despejado', icon: 'Sun' }
                    ]
                  }

                  const dispositivosZona = allDispositivos.filter(d => d.zona === zona.id || d.zona_codigo === zona.codigo)
                  
                  await Promise.all(dispositivosZona.map(async (d) => {
                    mappedZona.sensors.push({
                      id: d.id,
                      name: d.nombre,
                      serial: d.serial,
                      latOffset: (Math.random() - 0.5) * 0.005,
                      lngOffset: (Math.random() - 0.5) * 0.005,
                      value: 0,
                      unit: ''
                    })

                    mappedZona.repeaters.push({
                      id: d.id,
                      name: d.nombre,
                      serial: d.serial
                    })

                    try {
                      const resDash = await api(`/dispositivos/${d.serial}/dashboard/`)
                      if (resDash.ok) {
                        const dash = await resDash.json()
                        if (dash.dashboard && dash.dashboard.id) {
                          mappedZona.dashboard_template_id = dash.dashboard.id
                        }
                        const widgets = dash.dashboard ? dash.dashboard.widgets : dash.widgets || []
                        widgets.forEach(w => {
                          w.device_serial = d.serial
                          const val = w.valor || 0
                          if (w.codigo_sensor === 'TEMPERATURA' || w.titulo.toLowerCase().includes('temp')) { mappedZona.metrics.temperature = val; mappedZona.metrics.temp_widget_id = w.id }
                          if (w.codigo_sensor === 'HUMEDAD' || w.titulo.toLowerCase().includes('hum')) { mappedZona.metrics.humidity = val; mappedZona.metrics.hum_widget_id = w.id }
                          if (w.codigo_sensor === 'BATERIA' || w.titulo.toLowerCase().includes('bat')) { mappedZona.metrics.battery = val; mappedZona.metrics.bat_widget_id = w.id }
                          if (w.codigo_sensor === 'VOLTAJE' || w.titulo.toLowerCase().includes('volt')) { mappedZona.metrics.voltage = val; mappedZona.metrics.volt_widget_id = w.id }
                          if (w.codigo_sensor === 'POTENCIA' || w.titulo.toLowerCase().includes('pot')) { mappedZona.metrics.power = val; mappedZona.metrics.pow_widget_id = w.id }
                          if (w.codigo_sensor === 'HUMEDAD_SUELO' || w.titulo.toLowerCase().includes('suelo')) { mappedZona.metrics.soilMoisture = val; mappedZona.metrics.soil_widget_id = w.id }
                          if (w.codigo_sensor === 'VOLTAJE_PANEL' || w.titulo.toLowerCase().includes('panel')) { mappedZona.metrics.solarPanelVoltage = val; mappedZona.metrics.solar_widget_id = w.id }
                        })
                        mappedZona.widgets.push(...widgets)
                      }

                      // Historial se cargará dinámicamente cuando el usuario navegue a la vista de la zona
                    } catch {
                      // ignore error
                    }
                  }))

                  const realWeather = await fetchWeatherForecast(mappedZona.lat, mappedZona.lng)
                  if (realWeather) {
                    mappedZona.weatherForecast = realWeather
                  }
                  
                  return mappedZona
                })
                
                cerro.zonas = await Promise.all(zonasPromises)
              }
            } catch (e) {
              console.warn('Error fetching zonas/dispositivos para cerro', sitio.id, e)
            }
            return cerro
          }))

          if (newCerros.length > 0) cerros.value = newCerros
        }
      } catch (e) {
        console.error('Error al sincronizar sitios:', e)
      }
    }

    // 2. Obtener Clientes (Empresas)
    const fetchClientes = async () => {
      try {
        const resClientes = await api('/empresas/clientes/')
        if (resClientes.ok) {
          const dataClientes = await resClientes.json()
          const clientesList = dataClientes.results || dataClientes
          clients.value = clientesList.map(c => ({ id: c.id, name: c.nombre }))
        }
      } catch (e) {
        console.error('Error al sincronizar clientes:', e)
      }
    }

    // Ejecutar fetchs independientes en paralelo para carga rápida
    await Promise.all([
      fetchSitios(),
      fetchClientes(),
      fetchWorkersFromBackend()
    ])

    // 4. Obtener Grupos
    try {
      const resGroups = await api('/cuentas/grupos/')
      if (resGroups.ok) {
        const dataGroups = await resGroups.json()
        groups.value = dataGroups.results || dataGroups
      }
    } catch (e) {
      console.warn('Error fetching groups, checking dynamic fallback:', e)
    }

    // Build fallback groups array from existing users & current user if API failed or returned empty
    const groupMap = new Map()
    // Current user's groups
    if (authStore.currentUser && authStore.currentUser.group_names && authStore.currentUser.groups) {
      authStore.currentUser.group_names.forEach((name, idx) => {
        const id = authStore.currentUser.groups[idx]
        if (id !== undefined) groupMap.set(name, id)
      })
    }
    // Loaded users' groups
    workers.value.forEach(w => {
      if (w.group_names && w.groups) {
        w.group_names.forEach((name, idx) => {
          const id = w.groups[idx]
          if (id !== undefined) groupMap.set(name, id)
        })
      }
    })

    if (groups.value.length === 0 && groupMap.size > 0) {
      const fallbackList = []
      groupMap.forEach((id, name) => {
        fallbackList.push({ id, name })
      })
      groups.value = fallbackList
    }

    // 5. Obtener Nodos Globales (Todos los Dispositivos)
    try {
      const resGlobal = await api('/dispositivos/equipos/')
      if (resGlobal.ok) {
        const dataGlobal = await resGlobal.json()
        const globalList = dataGlobal.results || dataGlobal
        globalNodes.value = globalList.map(d => ({
          id: d.id,
          serial: d.serial,
          model: d.nombre,
          type: d.sitio_id ? 'asignado' : 'sin_asignar',
          clientId: d.empresa_id,
          assigned: !!d.sitio_id,
          mqtt_topic: d.mqtt_topic
        }))
      }
    } catch (e) {
      console.error('Error al sincronizar equipos globales:', e)
    }

    isLoading.value = false
  }


  const fetchZonaHistory = async (cerroId, zonaId, range = '24h') => {
    try {
      let desde = ''
      let hasta = new Date().toISOString()
      
      if (range === '24h') {
        const d = new Date()
        d.setHours(d.getHours() - 24)
        desde = d.toISOString()
      } else if (range === '7d') {
        const d = new Date()
        d.setDate(d.getDate() - 7)
        desde = d.toISOString()
      } else if (range === '30d') {
        const d = new Date()
        d.setDate(d.getDate() - 30)
        desde = d.toISOString()
      } else if (range.startsWith('custom:')) {
        const dates = range.replace('custom:', '').split('|')
        if (dates[0]) desde = new Date(dates[0] + 'T00:00:00').toISOString()
        if (dates[1]) hasta = new Date(dates[1] + 'T23:59:59').toISOString()
      } else {
        const d = new Date()
        d.setHours(d.getHours() - 24)
        desde = d.toISOString()
      }

      const cerro = cerros.value.find(c => c.id === cerroId)
      if (!cerro) return
      const zona = cerro.zonas.find(z => z.id === zonaId)
      if (!zona) return

      // Obtenemos los dispositivos de la zona (filtrando desde el sitio o la zona)
      // Como optimization, usamos los seriales que ya están guardados en zona.sensors y zona.repeaters
      const listDisp = [...zona.sensors, ...zona.repeaters]

      await Promise.all(listDisp.map(async (d) => {
        try {
          const resDash = await api(`/dispositivos/${d.serial}/dashboard/`)
          if (resDash.ok) {
            const dash = await resDash.json()
            const widgets = dash.dashboard ? dash.dashboard.widgets : dash.widgets || []
            const codigosPresentes = widgets.map(w => w.codigo_sensor).filter(Boolean)
            
            await Promise.all(codigosPresentes.map(async (cod) => {
              try {
                const resHist = await api(`/dispositivos/${d.serial}/sensores/${cod}/historial/?desde=${desde}&hasta=${hasta}`)
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
                    if (cod === 'TEMPERATURA') zona.history.temperature = chartData
                    if (cod === 'HUMEDAD') zona.history.humidity = chartData
                    if (cod === 'HUMEDAD_SUELO') zona.history.soilMoisture = chartData
                    if (cod === 'VOLTAJE_PANEL') zona.history.solarPanelVoltage = chartData
                    if (cod === 'VOLTAJE') zona.history.voltage = chartData
                    if (cod === 'POTENCIA') zona.history.power = chartData
                  }
                }
              } catch {
                // ignore error
              }
            }))
          }
        } catch {
          // ignore error
        }
      }))
    } catch (e) {
      console.error('Error al actualizar historial', e)
    }
  }

  return {
    isLoading,
    clients,
    globalNodes,
    workers,
    groups,
    cerros,
    addClient,
    registerNode,
    addWorker,
    removeWorker,
    updateWorkerPermissions,
    toggleRelay,
    updateRealtimeMetrics,
    fetchDataFromBackend,
    fetchZonaHistory,
  }
})
