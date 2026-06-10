import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useTelemetricsStore = defineStore('telemetrics', () => {
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
  const addClient = (name) => {
    const id = `client-${clients.value.length + 1}`
    clients.value.push({ id, name })
    return id
  }

  const registerNode = (serial, model, type, clientId) => {
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
  const addWorker = (name, username, selectedPermissions) => {
    const id = `worker-${workers.value.length + 1}`
    workers.value.push({
      id,
      name,
      username,
      role: 'trabajador',
      permissions: [...selectedPermissions]
    })
  }

  const removeWorker = (id) => {
    workers.value = workers.value.filter(w => w.id !== id)
  }

  const updateWorkerPermissions = (id, newPermissions) => {
    const worker = workers.value.find(w => w.id === id)
    if (worker) {
      worker.permissions = [...newPermissions]
    }
  }

  // --- ACCIONES DE DISPOSITIVO ---
  const toggleRelay = (cerroId) => {
    const cerro = cerros.value.find(c => c.id === cerroId)
    if (cerro) {
      cerro.metrics.relayState = !cerro.metrics.relayState
    }
  }

  // --- ACTUALIZACIÓN DE MÉTRICAS (Simulación) ---
  const updateRealtimeMetrics = () => {
    // 1. Predios
    predios.value.forEach(p => {
      // Modificar ligeramente
      p.metrics.temperature = +(p.metrics.temperature + (Math.random() - 0.5) * 0.4).toFixed(1)
      p.metrics.humidity = Math.max(10, Math.min(100, +(p.metrics.humidity + (Math.random() - 0.5) * 1.0).toFixed(0)))
      p.metrics.soilMoisture = Math.max(0, Math.min(100, +(p.metrics.soilMoisture + (Math.random() - 0.5) * 0.8).toFixed(1)))
      p.metrics.battery = Math.max(0, +(p.metrics.battery - 0.02).toFixed(2))
      p.metrics.solarPanelVoltage = Math.max(0, Math.min(6, +(p.metrics.solarPanelVoltage + (Math.random() - 0.5) * 0.1).toFixed(2)))

      // Sensores individuales
      p.sensors.forEach(s => {
        if (s.unit === '°C') {
          s.value = p.metrics.temperature
        } else if (s.unit === '%') {
          s.value = p.metrics.soilMoisture
        }
      })

      // Guardar historial
      const time = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      p.history.temperature.push({ x: time, y: p.metrics.temperature })
      p.history.humidity.push({ x: time, y: p.metrics.humidity })
      p.history.soilMoisture.push({ x: time, y: p.metrics.soilMoisture })

      // Limitar historial
      if (p.history.temperature.length > 30) {
        p.history.temperature.shift()
        p.history.humidity.shift()
        p.history.soilMoisture.shift()
      }
    })

    // 2. Cerros
    cerros.value.forEach(c => {
      c.metrics.voltage = Math.max(10.5, Math.min(15.0, +(c.metrics.voltage + (Math.random() - 0.5) * 0.1).toFixed(2)))
      c.metrics.power = Math.max(30, Math.min(60, +(c.metrics.power + (Math.random() - 0.5) * 2).toFixed(0)))
      c.metrics.windSpeed = Math.max(0, +(c.metrics.windSpeed + (Math.random() - 0.5) * 1.5).toFixed(1))
      c.metrics.batteryTemp = Math.max(5, Math.min(45, +(c.metrics.batteryTemp + (Math.random() - 0.5) * 0.3).toFixed(1)))
      c.metrics.battery = Math.max(0, +(c.metrics.battery - 0.01).toFixed(2))

      // Guardar historial
      const time = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      c.history.voltage.push({ x: time, y: c.metrics.voltage })
      c.history.power.push({ x: time, y: c.metrics.power })

      // Limitar historial
      if (c.history.voltage.length > 30) {
        c.history.voltage.shift()
        c.history.power.shift()
      }
    })
  }

  return {
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
  }
})
