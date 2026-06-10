import { useTelemetricsStore } from '../stores/telemetrics'

let intervalId = null

export const startMockService = () => {
  const store = useTelemetricsStore()

  // Generar datos cada 2 segundos para simular el tiempo real de todos los nodos
  intervalId = setInterval(() => {
    store.updateRealtimeMetrics()
  }, 2000)
}

export const stopMockService = () => {
  if (intervalId) clearInterval(intervalId)
}

