import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '../services/api'
import { fetchWeatherForecast } from '../services/weatherService'

export const useTelemetricsStore = defineStore('telemetrics', () => {
  // --- ESTADO DE CARGA ---
  const isLoading = ref(false)

  // --- CLIENTES ---
  const clients = ref([
    { id: 'client-1', name: 'Agrícola Biobío Ltda.' },
    { id: 'client-2', name: 'Radio Enlaces del Sur Spa' },
  ])

  // --- NODOS REGISTRADOS (Global por Netzona Técnico) ---
  const globalNodes = ref([
    { id: 'node-1', serial: 'SN-AG-001', model: 'AgroSoil-V1', type: 'agricola', clientId: 'client-1', assigned: true },
    { id: 'node-2', serial: 'SN-AG-002', model: 'AgroTemp-V2', type: 'agricola', clientId: 'client-1', assigned: true },
    { id: 'node-3', serial: 'SN-RF-101', model: 'NetzonaRepeater-V1', type: 'telecom', clientId: 'client-2', assigned: true },
    { id: 'node-4', serial: 'SN-RF-102', model: 'NetzonaRepeater-V1', type: 'telecom', clientId: 'client-2', assigned: true },
  ])

  // --- TRABAJADORES (Gestionado por Cliente Admin) ---
  const workers = ref([
    {
      id: 'worker-1',
      name: 'Pedro Díaz',
      username: 'pedro.diaz',
      role: 'trabajador',
      permissions: ['predio-1', 'cerro-1'], // Accede solo a algunos predios/cerros
    },
    {
      id: 'worker-2',
      name: 'María Soto',
      username: 'maria.soto',
      role: 'trabajador',
      permissions: ['predio-2', 'cerro-2'],
    },
  ])

  // --- CASO 1: PREDIOS AGRÍCOLAS ---
  const predios = ref([
    {
      id: 'predio-1',
      name: 'Fundo San Francisco',
      client: 'client-1',
      lat: -36.6083,
      lng: -72.1022,
      zoom: 15,
      sensors: [
        { id: 'sens-1', name: 'Sector Norte - Suelo', serial: 'SN-AG-001', latOffset: 0.002, lngOffset: -0.003, value: 34.5, unit: '%' },
        { id: 'sens-2', name: 'Sector Sur - Temperatura/Humedad', serial: 'SN-AG-002', latOffset: -0.001, lngOffset: 0.004, value: 22.8, unit: '°C' },
      ],
      metrics: {
        temperature: 24.5,
        humidity: 55,
        soilMoisture: 38.2,
        battery: 89.4,
        solarPanelVoltage: 4.8,
      },
      history: {
        temperature: [],
        humidity: [],
        soilMoisture: [],
      }
    },
    {
      id: 'predio-2',
      name: 'Fundo El Sauce',
      client: 'client-1',
      lat: -36.8123,
      lng: -72.5855,
      zoom: 14,
      sensors: [
        { id: 'sens-3', name: 'Invernadero Principal', serial: 'SN-AG-003', latOffset: 0.0, lngOffset: 0.0, value: 29.1, unit: '%' },
      ],
      metrics: {
        temperature: 21.0,
        humidity: 65,
        soilMoisture: 42.0,
        battery: 92.1,
        solarPanelVoltage: 5.1,
      },
      history: {
        temperature: [],
        humidity: [],
        soilMoisture: [],
      }
    }
  ])

  // --- CASO 2: CERROS (RADIOCOMUNICACIONES) ---
  const cerros = ref([
    {
      id: 'cerro-1',
      name: 'Cerro Caracol',
      client: 'client-2',
      lat: -36.8374,
      lng: -73.0423,
      zoom: 16,
      repeaters: [
        { id: 'rep-1', name: 'Repetidora VHF R1', serial: 'SN-RF-101' }
      ],
      metrics: {
        voltage: 13.8,      // Voltaje banco baterías repetidora (ej. 12V nominal)
        power: 45,          // Potencia de salida Watts
        doorOpen: false,    // Sensor magnético de puerta abierta
        relayState: false,  // Pulsador/switch para activar algo remoto (Ej. Ventilador o Generador)
        windSpeed: 14.5,    // Velocidad del viento km/h
        batteryTemp: 18.2,  // Temperatura interna baterías
        battery: 95.0,
      },
      history: {
        voltage: [],
        power: [],
      },
      weatherForecast: [
        { day: 'Lun', temp: '15°C', status: 'Despejado', icon: 'Sun' },
        { day: 'Mar', temp: '14°C', status: 'Parcial', icon: 'CloudSun' },
        { day: 'Mié', temp: '12°C', status: 'Lluvia', icon: 'CloudRain' },
        { day: 'Jue', temp: '11°C', status: 'Lluvia', icon: 'CloudRain' },
        { day: 'Vie', temp: '13°C', status: 'Nublado', icon: 'Cloud' },
      ]
    },
    {
      id: 'cerro-2',
      name: 'Cerro La Virgen',
      client: 'client-2',
      lat: -36.8012,
      lng: -73.1501,
      zoom: 16,
      repeaters: [
        { id: 'rep-2', name: 'Repetidora VHF R2', serial: 'SN-RF-102' }
      ],
      metrics: {
        voltage: 12.1,
        power: 42,
        doorOpen: true,    // Puerta abierta simulada
        relayState: true,
        windSpeed: 28.1,
        batteryTemp: 22.5,
        battery: 45.2,
      },
      history: {
        voltage: [],
        power: [],
      },
      weatherForecast: [
        { day: 'Lun', temp: '13°C', status: 'Nublado', icon: 'Cloud' },
        { day: 'Mar', temp: '12°C', status: 'Lluvia', icon: 'CloudRain' },
        { day: 'Mié', temp: '11°C', status: 'Lluvia fuerte', icon: 'CloudLightning' },
        { day: 'Jue', temp: '12°C', status: 'Despejado', icon: 'Sun' },
        { day: 'Vie', temp: '14°C', status: 'Parcial', icon: 'CloudSun' },
      ]
    }
  ])

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
    } catch (error) {
      console.warn('Backend API missing or failed, using local state fallback for registerNode', error)
    }

    const id = `node-${globalNodes.value.length + 1}`
    globalNodes.value.push({
      id,
      serial,
      model,
      type,
      clientId,
      assigned: true
    })

    // Agregar al predio o cerro correspondiente
    if (type === 'agricola') {
      // Buscar el primer predio del cliente
      const predio = predios.value.find(p => p.client === clientId)
      if (predio) {
        predio.sensors.push({
          id: `sens-${Math.random().toString(36).substr(2, 9)}`,
          name: `Nuevo Sensor - ${model}`,
          serial,
          latOffset: (Math.random() - 0.5) * 0.005,
          lngOffset: (Math.random() - 0.5) * 0.005,
          value: 20 + Math.random() * 10,
          unit: '°C'
        })
      }
    } else {
      // Buscar el primer cerro del cliente
      const cerro = cerros.value.find(c => c.client === clientId)
      if (cerro) {
        cerro.repeaters.push({
          id: `rep-${Math.random().toString(36).substr(2, 9)}`,
          name: `Repetidora - ${model}`,
          serial
        })
      }
    }
  }

  // --- ACCIONES CLIENTE ADMIN ---
  const addWorker = async (name, username, selectedPermissions) => {
    try {
      // Intento de conexión real al backend
      await api('/cuentas/usuarios/', {
        method: 'POST',
        body: JSON.stringify({
          first_name: name,
          email: `${username}@netzona.local`,
          password: 'Password123!',
        })
      })
    } catch (error) {
      console.warn('Backend API missing or failed, using local state fallback for addWorker', error)
    }

    const id = `worker-${workers.value.length + 1}`
    workers.value.push({
      id,
      name,
      username,
      role: 'trabajador',
      permissions: [...selectedPermissions]
    })
  }

  const removeWorker = async (id) => {
    try {
      const realId = id.toString().replace('worker-', '')
      await api(`/cuentas/usuarios/${realId}/`, { method: 'DELETE' })
    } catch (error) {
      console.warn('Backend API fail on DELETE /cuentas/usuarios/', error)
    }
    workers.value = workers.value.filter(w => w.id !== id)
  }

  const updateWorkerPermissions = async (id, newPermissions) => {
    try {
      const realId = id.toString().replace('worker-', '')
      await api(`/cuentas/usuarios/${realId}/`, {
        method: 'PUT',
        body: JSON.stringify({ permisos_ids: newPermissions })
      })
    } catch (error) {
      console.warn('Backend API fail on PUT /cuentas/usuarios/', error)
    }
    const worker = workers.value.find(w => w.id === id)
    if (worker) {
      worker.permissions = [...newPermissions]
    }
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
          } catch(e) {}
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
          } catch(e) {}
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
          sensors: [],
          repeaters: [],
          metrics: {
            temperature: 0,
            humidity: 0,
            soilMoisture: 0,
            battery: 0,
            solarPanelVoltage: 0,
            voltage: 0,
            power: 0,
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
                dash.dashboard.widgets.forEach(w => {
                  const val = w.valor || 0
                  if (w.codigo_sensor === 'TEMPERATURA' || w.titulo.toLowerCase().includes('temp')) mapped.metrics.temperature = val
                  if (w.codigo_sensor === 'HUMEDAD' || w.titulo.toLowerCase().includes('hum')) mapped.metrics.humidity = val
                  if (w.codigo_sensor === 'BATERIA' || w.titulo.toLowerCase().includes('bat')) mapped.metrics.battery = val
                  if (w.codigo_sensor === 'VOLTAJE' || w.titulo.toLowerCase().includes('volt')) mapped.metrics.voltage = val
                  if (w.codigo_sensor === 'POTENCIA' || w.titulo.toLowerCase().includes('pot')) mapped.metrics.power = val
                })
              }

              // Llamar endpoints reales para Gráficos Históricos
              const codigosHistorial = ['TEMPERATURA', 'HUMEDAD', 'VOLTAJE', 'POTENCIA']
              for (const cod of codigosHistorial) {
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
                      if (cod === 'VOLTAJE') mapped.history.voltage = chartData
                      if (cod === 'POTENCIA') mapped.history.power = chartData
                    }
                  }
                } catch(e) {}
              }
            } catch (err) {
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
      } catch(e) {}

      // 3. Obtener Trabajadores (Usuarios)
      try {
        const resWorkers = await api('/cuentas/usuarios/')
        if (resWorkers.ok) {
          const dataWorkers = await resWorkers.json()
          const workersList = dataWorkers.results || dataWorkers
          workers.value = workersList.map(w => ({
            id: w.id,
            name: w.first_name || w.username,
            username: w.username,
            role: 'trabajador',
            permissions: w.accesos_ids || []
          }))
        }
      } catch(e) {}

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
      } catch(e) {}

    } catch (e) {
      console.error('Failed to sync telemetrics from backend:', e)
    } finally {
      isLoading.value = false
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
  }
})
