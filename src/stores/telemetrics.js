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
  const addClient = async (name, code, rut = '') => {
    try {
      const res = await api('/empresas/clientes/', {
        method: 'POST',
        body: JSON.stringify({ nombre: name, codigo: code, rut: rut, activo: true })
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw errData
      }
      const data = await res.json()
      return data
    } catch (error) {
      console.error('Error on addClient', error)
      throw error
    }
  }

  const registerNode = async (payload) => {
    try {
      const res = await api('/dispositivos/equipos/', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw errData
      }
    } catch (error) {
      console.error('Error on registerNode', error)
      throw error
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
  const transformEstadoActual = (data) => {
    if (!data) return {}
    if (data.sensores && Array.isArray(data.sensores)) {
      const transformed = {}
      for (const s of data.sensores) {
        if (s.codigo_sensor) {
          transformed[s.codigo_sensor.toUpperCase()] = { valor: s.valor }
        }
      }
      return transformed
    }
    return data
  }

  const pushHistory = (zona, key, time, valor) => {
    if (!zona.history) zona.history = {}
    if (!zona.history[key]) zona.history[key] = []
    zona.history[key].push({ x: time, y: valor })
    if (zona.history[key].length > 30) zona.history[key].shift()
  }

  const isUpdatingRealtime = ref(false)

  // --- ACTUALIZACIÓN DE MÉTRICAS (LONG POLLING API REAL) ---
  const updateRealtimeMetrics = async (activeCerroId = null) => {
    if (isUpdatingRealtime.value) return
    isUpdatingRealtime.value = true

    try {
      const cerrosToUpdate = activeCerroId
        ? cerros.value.filter(c => String(c.id) === String(activeCerroId))
        : cerros.value

      for (const cerro of cerrosToUpdate) {
        try {
          const res = await api(`/empresas/sitios/${cerro.id}/estado-actual/`)
          if (res.ok) {
            const rawData = await res.json()
            if (!rawData.dispositivos || !Array.isArray(rawData.dispositivos)) continue

            const deviceMap = new Map()
            rawData.dispositivos.forEach(d => {
              if (d.dispositivo && d.dispositivo.serial) {
                deviceMap.set(d.dispositivo.serial, d)
              } else if (d.serial) {
                deviceMap.set(d.serial, d)
              }
            })

            const time = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

            for (const zona of cerro.zonas) {
              // Actualizar sensores
              for (const s of zona.sensors) {
                const devData = deviceMap.get(s.serial)
                if (!devData) continue

                const data = transformEstadoActual(devData)
                
                if (data['TEMPERATURA']) {
                  zona.metrics.temperature = data['TEMPERATURA'].valor
                  pushHistory(zona, 'temperature', time, data['TEMPERATURA'].valor)
                }
                if (data['HUMEDAD']) {
                  zona.metrics.humidity = data['HUMEDAD'].valor
                  pushHistory(zona, 'humidity', time, data['HUMEDAD'].valor)
                }
                if (data['BATERIA']) {
                  zona.metrics.battery = data['BATERIA'].valor
                }
                if (data['VOLTAJE_PANEL']) {
                  zona.metrics.solarPanelVoltage = data['VOLTAJE_PANEL'].valor
                }
                if (data['VOLTAJE']) {
                  zona.metrics.voltage = data['VOLTAJE'].valor
                  pushHistory(zona, 'voltage', time, data['VOLTAJE'].valor)
                }
                if (data['POTENCIA']) {
                  zona.metrics.power = data['POTENCIA'].valor
                  pushHistory(zona, 'power', time, data['POTENCIA'].valor)
                }
              }

              // Actualizar repetidores
              for (const r of zona.repeaters) {
                const devData = deviceMap.get(r.serial)
                if (!devData) continue

                const data = transformEstadoActual(devData)
                
                if (data['VOLTAJE']) {
                  zona.metrics.voltage = data['VOLTAJE'].valor
                  pushHistory(zona, 'voltage', time, data['VOLTAJE'].valor)
                }
                if (data['POTENCIA']) {
                  zona.metrics.power = data['POTENCIA'].valor
                  pushHistory(zona, 'power', time, data['POTENCIA'].valor)
                }
                if (data['BATERIA']) {
                  zona.metrics.battery = data['BATERIA'].valor
                }
                if (data['TEMPERATURA']) {
                  zona.metrics.temperature = data['TEMPERATURA'].valor
                  pushHistory(zona, 'temperature', time, data['TEMPERATURA'].valor)
                }
                if (data['HUMEDAD']) {
                  zona.metrics.humidity = data['HUMEDAD'].valor
                  pushHistory(zona, 'humidity', time, data['HUMEDAD'].valor)
                }
                if (data['VOLTAJE_PANEL']) {
                  zona.metrics.solarPanelVoltage = data['VOLTAJE_PANEL'].valor
                }
              }

              // Sincronizar directamente con los widgets dinámicos en pantalla
              for (const device of zona.dispositivos) {
                const devData = deviceMap.get(device.serial)
                if (devData && device.widgets && devData.sensores && Array.isArray(devData.sensores)) {
                  device.widgets.forEach(w => {
                    const sensorData = devData.sensores.find(sd => sd.codigo_sensor && sd.codigo_sensor.toUpperCase() === w.codigo_sensor.toUpperCase())
                    if (sensorData) {
                      w.valor = sensorData.valor
                      w.medido_en = sensorData.medido_en
                      w.estado = sensorData.estado || 'ok'
                    }
                  })
                }
              }
            }
          }
        } catch (err) {
          console.warn(`Error al actualizar tiempo real para el sitio/cerro ${cerro.id}:`, err)
        }
      }
    } catch (e) {
      console.warn("Polling de estado actual fallido", e)
    } finally {
      isUpdatingRealtime.value = false
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
    
    // 1. Obtener Sitios (Cerros) de forma plana
    const fetchSitios = async () => {
      try {
        const resSitios = await api('/empresas/sitios/')
        if (resSitios.ok) {
          const dataSitios = await resSitios.json()
          const sitios = dataSitios.results || dataSitios

          const newCerros = sitios.map((sitio) => {
            return {
              id: sitio.id,
              name: sitio.nombre,
              client: sitio.empresa,
              lat: sitio.latitud ? parseFloat(sitio.latitud) : -36.6083,
              lng: sitio.longitud ? parseFloat(sitio.longitud) : -72.1022,
              zoom: 15,
              zonas: [],
              isLoaded: false
            }
          })

          if (newCerros.length > 0) {
            // Preservar detalles ya cargados si existen
            newCerros.forEach(newC => {
              const existing = cerros.value.find(c => c.id === newC.id)
              if (existing && existing.isLoaded) {
                newC.zonas = existing.zonas
                newC.isLoaded = true
              }
            })
            cerros.value = newCerros
          }
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
    if (authStore.currentUser && authStore.currentUser.group_names && authStore.currentUser.groups) {
      authStore.currentUser.group_names.forEach((name, idx) => {
        const id = authStore.currentUser.groups[idx]
        if (id !== undefined) groupMap.set(name, id)
      })
    }
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

  // --- CARGA BAJO DEMANDA DE ZONAS Y DISPOSITIVOS DE UN CERRO ---
  const fetchCerroDetails = async (cerroId, force = false) => {
    const cerro = cerros.value.find(c => String(c.id) === String(cerroId))
    if (!cerro) return
    if (cerro.isLoaded && !force) return

    isLoading.value = true
    try {
      const resDisp = await api(`/dispositivos/equipos/?sitio=${cerroId}`)
      let allDispositivos = []
      if (resDisp.ok) {
        const dataDisp = await resDisp.json()
        allDispositivos = dataDisp.results || dataDisp
      }

      // Obtener de forma agrupada los dashboards, widgets y layouts de los dispositivos del sitio
      const dashboardsMap = new Map()
      try {
        const resDashboards = await api(`/dashboards/por-sitio/?sitio=${cerroId}`)
        if (resDashboards.ok) {
          const dashboardsData = await resDashboards.json()
          const items = dashboardsData.results || dashboardsData
          if (Array.isArray(items)) {
            items.forEach(item => {
              if (item.dispositivo && item.dispositivo.serial) {
                dashboardsMap.set(item.dispositivo.serial, item)
              } else if (item.serial) {
                dashboardsMap.set(item.serial, item)
              }
            })
          }
        }
      } catch (dashError) {
        console.warn('No se pudo cargar dashboards/por-sitio:', dashError)
      }

      const resZonas = await api(`/empresas/zonas/?sitio=${cerroId}`)
      if (resZonas.ok) {
        const dataZonas = await resZonas.json()
        const zonas = dataZonas.results || dataZonas

        const zonasPromises = zonas.map(async (zona) => {
          const mappedZona = {
            id: zona.id,
            name: zona.nombre,
            cerroId: cerroId,
            lat: cerro.lat,
            lng: cerro.lng,
            zoom: 15,
            dispositivos: [],
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
              voltage: [],
              power: [],
              soilMoisture: [],
              solarPanelVoltage: []
            },
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

            const devObj = {
              id: d.id,
              nombre: d.nombre,
              serial: d.serial,
              latitud: d.latitud,
              longitud: d.longitud,
              dashboard_template_id: null,
              widgets: [],
              layout_dashboard: null
            }

            if (dashboardsMap.has(d.serial)) {
              const dashInfo = dashboardsMap.get(d.serial)
              if (dashInfo.dashboard && dashInfo.dashboard.id) {
                devObj.dashboard_template_id = dashInfo.dashboard.id
              }
              const widgets = dashInfo.widgets || (dashInfo.dashboard ? dashInfo.dashboard.widgets : []) || []
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
              devObj.widgets = widgets
              if (dashInfo.preferencias && dashInfo.preferencias.layout_dashboard) {
                devObj.layout_dashboard = dashInfo.preferencias.layout_dashboard
              }
            } else {
              try {
                const resDash = await api(`/dispositivos/${d.serial}/dashboard/`)
                if (resDash.ok) {
                  const dash = await resDash.json()
                  if (dash.dashboard && dash.dashboard.id) {
                    devObj.dashboard_template_id = dash.dashboard.id
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
                  devObj.widgets = widgets
                }
              } catch {
                // ignore error
              }
            }
            mappedZona.dispositivos.push(devObj)
          }))

          const realWeather = await fetchWeatherForecast(mappedZona.lat, mappedZona.lng)
          if (realWeather) {
            mappedZona.weatherForecast = realWeather
          }
          
          return mappedZona
        })
        
        cerro.zonas = await Promise.all(zonasPromises)
        cerro.isLoaded = true
      }
    } catch (e) {
      console.warn('Error fetching zonas/dispositivos para cerro', cerroId, e)
    } finally {
      isLoading.value = false
    }
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
                   const points = dataHist.puntos || (Array.isArray(dataHist) ? dataHist : [])
                   const chartData = points.map(h => {
                     const date = new Date(h.t || h.timestamp || h.fecha)
                     const val = h.v !== undefined ? h.v : h.valor
                     const label = range === '24h' 
                       ? date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                       : date.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' }) + ' ' + date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
                     return { x: label, y: val }
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
    fetchCerroDetails,
    fetchZonaHistory,
  }
})
