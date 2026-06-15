<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { api } from '../../services/api'
import { useDark } from '@vueuse/core'

const props = defineProps({
  widget: {
    type: Object,
    required: true
  },
  serial: {
    type: String,
    required: true
  }
})

const isDark = useDark()
const isLoading = ref(false)
const hasError = ref(ref(false))
const points = ref([])

// Configuración de rango
const ranges = computed(() => {
  return props.widget.configuracion?.rangos_permitidos || ['1h', '24h', '7d', '20d', '30d']
})

const selectedRange = ref(props.widget.configuracion?.rango_default || '24h')

// Traducir rangos a etiquetas legibles
const getRangeLabel = (range) => {
  switch (range) {
    case '1h': return '1 Hora'
    case '24h': return '24 Horas'
    case '7d': return '7 Días'
    case '20d': return '20 Días'
    case '30d': return '30 Días'
    default: return range
  }
}

// Calcular desde/hasta en UTC
const getDesdeHasta = (range) => {
  const hasta = new Date()
  const desde = new Date()
  
  if (range === '1h') {
    desde.setHours(desde.getHours() - 1)
  } else if (range === '24h') {
    desde.setHours(desde.getHours() - 24)
  } else if (range === '7d') {
    desde.setDate(desde.getDate() - 7)
  } else if (range === '20d') {
    desde.setDate(desde.getDate() - 20)
  } else if (range === '30d') {
    desde.setDate(desde.getDate() - 30)
  } else {
    desde.setHours(desde.getHours() - 24) // fallback
  }
  
  return {
    desde: desde.toISOString(),
    hasta: hasta.toISOString()
  }
}

// Carga de historial desde el endpoint provisto por el backend
const fetchHistory = async () => {
  const endpoint = props.widget.historial_endpoint
  if (!endpoint) return
  
  isLoading.value = true
  hasError.value = false
  
  try {
    const { desde, hasta } = getDesdeHasta(selectedRange.value)
    // Nos aseguramos de agregar el prefijo correcto de query params
    const separator = endpoint.includes('?') ? '&' : '?'
    const url = `${endpoint}${separator}desde=${desde}&hasta=${hasta}`
    
    const res = await api(url)
    if (res.ok) {
      const data = await res.json()
      
      // Parsear soportando múltiples estructuras del backend de forma defensiva
      let rawPoints = []
      if (Array.isArray(data)) {
        rawPoints = data
      } else if (data && Array.isArray(data.puntos)) {
        rawPoints = data.puntos
      }
      
      points.value = rawPoints.map(p => {
        const timeStr = p.t || p.timestamp || p.fecha
        const val = p.v !== undefined ? p.v : p.valor
        const date = new Date(timeStr)
        
        let label = ''
        if (selectedRange.value === '1h' || selectedRange.value === '24h') {
          label = date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
        } else {
          label = date.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' }) + ' ' + date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
        }
        
        return {
          x: label,
          y: val !== null ? Number(val) : null
        }
      })
    } else {
      hasError.value = true
    }
  } catch (error) {
    console.error('Error cargando historial de widget:', error)
    hasError.value = true
  } finally {
    isLoading.value = false
  }
}

// Recargar cuando cambie el rango o el endpoint/serial
watch([selectedRange, () => props.widget.historial_endpoint, () => props.serial], () => {
  fetchHistory()
})

onMounted(() => {
  fetchHistory()
})

// Configuración de Series para ApexCharts
const series = computed(() => [
  {
    name: props.widget.nombre_sensor || props.widget.titulo || 'Valor',
    data: points.value
  }
])

// Configuración de Opciones de ApexCharts adaptada estéticamente
const chartOptions = computed(() => {
  const unit = props.widget.unidad || ''
  return {
    chart: {
      type: 'area',
      height: '100%',
      toolbar: { show: false },
      zoom: { enabled: false },
      background: 'transparent',
      foreColor: '#9ca3af',
    },
    theme: {
      mode: isDark.value ? 'dark' : 'light',
    },
    stroke: {
      curve: 'smooth',
      width: 2.5,
    },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.3,
        opacityTo: 0.02,
        stops: [0, 90, 100],
      },
    },
    colors: [isDark.value ? '#6D92F8' : '#0C4CE4'],
    dataLabels: { enabled: false },
    grid: {
      borderColor: 'rgba(156, 163, 175, 0.15)',
      strokeDashArray: 4,
    },
    xaxis: {
      type: 'category',
      labels: {
        rotate: 0,
        style: { fontSize: '10px' },
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        style: { fontSize: '10px' },
        formatter: (val) => val !== null && val !== undefined ? `${val.toFixed(1)} ${unit}` : ''
      },
    },
    tooltip: {
      shared: true,
      intersect: false,
      y: {
        formatter: (val) => val !== null && val !== undefined ? `${val.toFixed(1)} ${unit}` : 'Sin datos'
      }
    },
    legend: {
      show: false
    }
  }
})
</script>

<template>
  <div class="h-full w-full p-6 bg-white/80 dark:bg-mako-900/60 border border-white/40 dark:border-white/5 rounded-[2rem] shadow-md flex flex-col justify-between select-none">
    
    <!-- Cabecera del Gráfico -->
    <div class="flex justify-between items-center mb-3">
      <p class="text-xs uppercase font-bold text-mako-400 truncate max-w-[65%]">
        {{ widget.titulo || 'Historial' }}
      </p>
      
      <!-- Selector de Rangos -->
      <select
        v-model="selectedRange"
        :disabled="isLoading"
        class="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-bold outline-none cursor-pointer dark:bg-mako-900 disabled:opacity-55"
      >
        <option v-for="r in ranges" :key="r" :value="r">
          {{ getRangeLabel(r) }}
        </option>
      </select>
    </div>

    <!-- Área de Visualización -->
    <div class="flex-1 min-h-[180px] relative flex items-center justify-center">
      <!-- Loading State -->
      <div v-if="isLoading" class="absolute inset-0 flex items-center justify-center bg-white/10 dark:bg-mako-900/10 backdrop-blur-[1px] z-10 rounded-xl">
        <svg class="animate-spin h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>

      <!-- Error State -->
      <div v-else-if="hasError" class="text-center p-4 flex flex-col items-center justify-center">
        <p class="text-xs text-red-500 font-semibold mb-2">No se pudo cargar el historial.</p>
        <button
          @click="fetchHistory"
          class="text-[10px] bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 px-3 py-1 rounded-full font-bold border border-red-500/20 transition-colors"
        >
          Reintentar
        </button>
      </div>

      <!-- Empty State -->
      <div v-else-if="points.length === 0" class="text-xs text-mako-400 italic text-center p-4">
        Sin datos para el rango seleccionado.
      </div>

      <!-- ApexChart Render -->
      <div v-else class="w-full h-full">
        <apexchart
          type="area"
          width="100%"
          height="100%"
          :options="chartOptions"
          :series="series"
        />
      </div>
    </div>
  </div>
</template>
