import { useTelemetricsStore } from '../stores/telemetrics'

let intervalId = null

export const startMockService = () => {
  const store = useTelemetricsStore()

  // Actualizar datos cada 5 segundos mediante Long Polling al backend
  intervalId = setInterval(() => {
    store.updateRealtimeMetrics()
  }, 5000)
}

export const stopMockService = () => {
  if (intervalId) clearInterval(intervalId)
}

