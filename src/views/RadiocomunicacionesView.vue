<script setup>
import { computed, ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useTelemetricsStore } from '../stores/telemetrics'
import { useDark } from '@vueuse/core'
import { LMap, LTileLayer, LMarker } from '@vue-leaflet/vue-leaflet'
import 'leaflet/dist/leaflet.css'
import { GridStack } from 'gridstack'
import 'gridstack/dist/gridstack.min.css'
import { api } from '../services/api'

const auth = useAuthStore()
const store = useTelemetricsStore()
const isDark = useDark()

// Filtrar cerros por permisos
const allowedCerros = computed(() => {
  if (auth.userRole === 'admin' || auth.userRole === 'tecnico') {
    return store.cerros
  }
  return store.cerros.filter((c) => auth.accessibleItems.includes(c.id))
})

// Cerro Seleccionado
const selectedCerroId = ref('')

watch(allowedCerros, (newVal) => {
  if (newVal.length > 0 && !selectedCerroId.value) {
    selectedCerroId.value = newVal[0].id
  }
}, { immediate: true })

const selectedCerro = computed(() => {
  return store.cerros.find((c) => c.id === selectedCerroId.value) || null
})

// Coordenadas de mapa
const mapZoom = ref(15)
const mapCenter = ref([-36.8374, -73.0423])
const map = ref(null)

const updateMapLocation = () => {
  if (selectedCerro.value) {
    mapCenter.value = [selectedCerro.value.lat, selectedCerro.value.lng]
    mapZoom.value = selectedCerro.value.zoom
  }
}

const selectedRange = ref('24h')
const isGridLoading = ref(false)

let grid = null
const initGrid = async () => {
  await nextTick()
  if (grid) {
    grid.destroy(false)
    grid = null
  }
  setTimeout(async () => {
    const el = document.querySelector('.grid-stack')
    if (el) {
      grid = GridStack.init({
        cellHeight: '135px',
        margin: 16,
        minRow: 1,
        columnOpts: {
          breakpointForWindow: true,
          breakpoints: [
            { w: 768, c: 1 }
          ]
        }
      })

      isGridLoading.value = true

      // Load Layout from Backend
      if (selectedCerro.value && selectedCerro.value.dashboard_template_id) {
        try {
          const res = await api(`/cuentas/preferencias/?sitio=${selectedCerro.value.id}&dashboard_template=${selectedCerro.value.dashboard_template_id}`)
          if (res.ok) {
            const data = await res.json()
            const finalLayout = []
            if (data.layout_dashboard && data.layout_dashboard.length > 0) {
              const mappedLayout = data.layout_dashboard.map(item => ({
                id: item.widget_id,
                x: item.x,
                y: item.y,
                w: item.w,
                h: item.h
              }))
              finalLayout.push(...mappedLayout)
            }
            const localStr = localStorage.getItem(`grid_static_${selectedCerro.value.id}`)
            if (localStr) {
              finalLayout.push(...JSON.parse(localStr))
            }
            if (finalLayout.length > 0) {
              grid.load(finalLayout, false)
            }
          }
        } catch (e) {
          console.warn('No se pudo cargar el layout personalizado', e)
        }
      }

      setTimeout(() => {
        isGridLoading.value = false
      }, 500)

      // Handle Save
      grid.on('change', async (event, items) => {
        if (isGridLoading.value) return
        if (!selectedCerro.value || !selectedCerro.value.dashboard_template_id) return
        
        const layout = grid.save()
        const backendLayout = layout.filter(item => item.id && !item.id.startsWith('widget-')).map(item => ({
          widget_id: item.id,
          x: item.x,
          y: item.y,
          w: item.w ?? item.width,
          h: item.h ?? item.height
        }))
        
        const staticLayout = layout.filter(item => item.id && item.id.startsWith('widget-')).map(item => ({
          id: item.id,
          x: item.x,
          y: item.y,
          w: item.w ?? item.width,
          h: item.h ?? item.height
        }))
        
        localStorage.setItem(`grid_static_${selectedCerro.value.id}`, JSON.stringify(staticLayout))

        if (backendLayout.length > 0) {
          try {
            const res = await api('/cuentas/preferencias/', {
              method: 'PUT',
              body: JSON.stringify({
                sitio_id: selectedCerro.value.id,
                dashboard_template_id: selectedCerro.value.dashboard_template_id,
                layout_dashboard: backendLayout
              })
            })
            if (!res.ok) {
              const errorData = await res.json().catch(() => ({}))
              console.error('Error de validación al guardar layout en el backend:', errorData)
            }
          } catch (e) {
            console.error('Error de red al guardar layout', e)
          }
        }
      })

      setTimeout(() => {
        if (map.value && map.value.leafletObject) {
          map.value.leafletObject.invalidateSize()
        }
        window.dispatchEvent(new Event('resize'))
      }, 300)
    }
  }, 100)
}

onMounted(() => {
  initGrid()
})

watch(
  [selectedCerroId, selectedRange],
  async ([cerroId, range], [oldCerroId, oldRange]) => {
    updateMapLocation()
    const rangeChanged = oldRange !== undefined && range !== oldRange
    const predioChanged = oldCerroId !== undefined && oldCerroId !== '' && cerroId !== oldCerroId
    
    if (cerroId && (rangeChanged || predioChanged)) {
      await store.fetchSiteHistory(cerroId, true, range)
    }
    if (!store.isLoading) {
      initGrid()
    }
  },
  { immediate: true },
)

watch(
  () => store.isLoading,
  (loading) => {
    if (!loading) {
      initGrid()
    }
  }
)

onUnmounted(() => {
  if (grid) grid.destroy(false)
})

// Configuración del gráfico ApexCharts (Voltaje y Potencia)
const chartSeries = computed(() => {
  if (!selectedCerro.value) return []
  return [
    {
      name: 'Potencia VHF (W)',
      data: selectedCerro.value.history.power,
    },
    {
      name: 'Voltaje Baterías (V)',
      data: selectedCerro.value.history.voltage,
    },
  ]
})

const chartOptions = computed(() => {
  return {
    chart: {
      type: 'line',
      height: 280,
      toolbar: { show: false },
      zoom: { enabled: false },
      animations: {
        enabled: true,
        easing: 'linear',
        dynamicAnimation: { speed: 1000 },
      },
      background: 'transparent',
      foreColor: '#9ca3af',
    },
    theme: {
      mode: isDark.value ? 'dark' : 'light',
    },
    stroke: {
      curve: 'smooth',
      width: [3, 3],
    },
    colors: [isDark.value ? '#6D92F8' : '#0C4CE4', '#3b82f6'],
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
    yaxis: [
      {
        title: { text: 'Watts', style: { color: isDark.value ? '#6D92F8' : '#0C4CE4' } },
        labels: { style: { fontSize: '10px' } },
      },
      {
        opposite: true,
        title: { text: 'Voltios', style: { color: '#3b82f6' } },
        labels: { style: { fontSize: '10px' } },
      },
    ],
    tooltip: {
      shared: true,
    },
    legend: {
      position: 'top',
      horizontalAlign: 'right',
      fontSize: '11px',
    },
  }
})

// Controladores de Iconos Clima
const getWeatherSvg = (iconName) => {
  switch (iconName) {
    case 'Sun':
      return `<svg class="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707-.707M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`
    case 'CloudSun':
      return `<svg class="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707-.707M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`
    case 'CloudRain':
      return `<svg class="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>`
    case 'CloudLightning':
      return `<svg class="w-8 h-8 text-purple-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>`
    default:
      return `<svg class="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>`
  }
}
</script>

<template>
  <AppLoader v-if="store.isLoading" />

  <div
    v-else-if="allowedCerros.length === 0"
    class="flex flex-col items-center justify-center min-h-[60vh] text-center p-8"
  >
    <div
      class="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 mb-4"
    >
      <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
    </div>
    <h2 class="text-xl font-bold">Sin cerros repetidores autorizados</h2>
    <p class="text-sm text-mako-500 dark:text-mako-400 mt-2 max-w-md">
      Su usuario no cuenta con permisos para visualizar ningún cerro de radiocomunicaciones.
      Contacte a su administrador.
    </p>
  </div>

  <div v-else class="grid grid-cols-1 xl:grid-cols-4 gap-8">
    <!-- PANEL PRINCIPAL -->
    <div class="xl:col-span-3 space-y-6">
      <!-- Cuadrícula Drag and Drop (Gridstack) -->
      <div class="grid-stack mt-4">
        <!-- Voltaje Banco -->
        <div class="grid-stack-item" :gs-id="selectedCerro?.metrics.volt_widget_id || 'widget-voltage'" gs-w="3" gs-h="1" gs-x="0" gs-y="0">
          <div class="grid-stack-item-content glass-card-radio">
            <p class="label-radio">Voltaje Banco</p>
            <h3
              class="value-radio"
              :class="
                selectedCerro?.metrics.voltage < 11.5
                  ? 'text-red-500 animate-pulse'
                  : 'text-blue-500'
              "
            >
              {{ selectedCerro?.metrics.voltage }}<span class="unit-radio">V</span>
            </h3>
          </div>
        </div>

        <!-- Potencia Tx -->
        <div class="grid-stack-item" :gs-id="selectedCerro?.metrics.pow_widget_id || 'widget-power'" gs-w="3" gs-h="1" gs-x="3" gs-y="0">
          <div class="grid-stack-item-content glass-card-radio">
            <p class="label-radio">Potencia Tx</p>
            <h3 class="value-radio text-primary">
              {{ selectedCerro?.metrics.power }}<span class="unit-radio">W</span>
            </h3>
          </div>
        </div>

        <!-- Temp. Baterías -->
        <div class="grid-stack-item" :gs-id="selectedCerro?.metrics.bat_widget_id || 'widget-bat'" gs-w="3" gs-h="1" gs-x="6" gs-y="0">
          <div class="grid-stack-item-content glass-card-radio">
            <p class="label-radio">Temp. Baterías</p>
            <h3 class="value-radio">
              {{ selectedCerro?.metrics.batteryTemp }}<span class="unit-radio">°C</span>
            </h3>
          </div>
        </div>

        <!-- Velocidad Viento -->
        <div class="grid-stack-item" :gs-id="selectedCerro?.metrics.wind_widget_id || 'widget-wind'" gs-w="3" gs-h="1" gs-x="9" gs-y="0">
          <div class="grid-stack-item-content glass-card-radio">
            <p class="label-radio">Velocidad Viento</p>
            <h3
              class="value-radio"
              :class="selectedCerro?.metrics.windSpeed > 25 ? 'text-yellow-500' : ''"
            >
              {{ selectedCerro?.metrics.windSpeed }}<span class="unit-radio">km/h</span>
            </h3>
          </div>
        </div>

        <!-- Control Magnético Puerta -->
        <div class="grid-stack-item" gs-id="widget-status" gs-w="4" gs-h="2" gs-x="0" gs-y="1">
          <div
            class="grid-stack-item-content p-6 rounded-[2rem] border transition-all duration-300 flex flex-col justify-between"
            :class="
              selectedCerro?.metrics.doorOpen
                ? 'bg-red-500/10 border-red-500/30 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.15)] animate-pulse'
                : 'bg-white/80 dark:bg-mako-900/60 border-white/40 dark:border-white/5'
            "
          >
            <div>
              <p class="text-xs uppercase font-bold text-mako-400 mb-2">Sensor de Seguridad</p>
              <h4 class="text-lg font-bold">Puerta de la Caseta</h4>
            </div>
            <div class="flex items-center gap-3 mt-4">
              <span class="p-3 bg-white/10 rounded-2xl">
                <svg
                  v-if="selectedCerro?.metrics.doorOpen"
                  class="w-8 h-8"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <svg
                  v-else
                  class="w-8 h-8 text-green-500"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
              </span>
              <div>
                <p class="text-xl font-extrabold uppercase">
                  {{ selectedCerro?.metrics.doorOpen ? '¡Abierta!' : 'Cerrada' }}
                </p>
                <p class="text-xs text-mako-400">
                  {{ selectedCerro?.metrics.doorOpen ? 'Intrusión caseta' : 'Acceso restringido' }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Pulsador / Actuador Remoto -->
        <div class="grid-stack-item" gs-id="widget-relay" gs-w="4" gs-h="2" gs-x="4" gs-y="1">
          <div
            class="grid-stack-item-content p-6 bg-white/80 dark:bg-mako-900/60 border border-white/40 dark:border-white/5 rounded-[2rem] shadow-md flex flex-col justify-between"
          >
            <div>
              <p class="text-xs uppercase font-bold text-mako-400 mb-2">Comandos Remotos</p>
              <h4 class="text-lg font-bold">Relé Auxiliar (Pulsador)</h4>
            </div>
            <div class="flex items-center justify-between mt-4">
              <span class="text-xs text-mako-400">Trazabilidad en vivo</span>
              <button
                @click="store.toggleRelay(selectedCerro.id)"
                class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 outline-none"
                :class="
                  selectedCerro?.metrics.relayState ? 'bg-primary' : 'bg-mako-300 dark:bg-mako-800'
                "
              >
                <span
                  class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300"
                  :class="selectedCerro?.metrics.relayState ? 'translate-x-6' : 'translate-x-1'"
                ></span>
              </button>
            </div>
            <div class="mt-2 text-[10px] text-mako-400 font-bold uppercase truncate">
              Estado:
              <span :class="selectedCerro?.metrics.relayState ? 'text-primary' : 'text-mako-400'">
                {{ selectedCerro?.metrics.relayState ? 'EQUIPOS ACTIVOS' : 'EQUIPOS APAGADOS' }}
              </span>
            </div>
          </div>
        </div>

        <!-- Mapa de Cerro (Leaflet) -->
        <div class="grid-stack-item" gs-id="widget-map" gs-w="4" gs-h="2" gs-x="8" gs-y="1">
          <div
            class="grid-stack-item-content bg-white/80 dark:bg-mako-900/60 border border-white/40 dark:border-white/5 rounded-[2rem] overflow-hidden shadow-md relative"
          >
            <l-map
              v-if="selectedCerro"
              ref="map"
              :zoom="mapZoom"
              :center="mapCenter"
              :use-global-leaflet="false"
              class="h-full w-full"
            >
              <l-tile-layer
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                layer-type="base"
                name="CartoDB Voyager"
              ></l-tile-layer>
              <l-marker :lat-lng="[selectedCerro.lat, selectedCerro.lng]"></l-marker>
            </l-map>
          </div>
        </div>

        <!-- Gráfico Histórico -->
        <div class="grid-stack-item" gs-id="widget-history" gs-w="8" gs-h="3" gs-x="0" gs-y="3">
          <div
            class="grid-stack-item-content p-6 bg-white/80 dark:bg-mako-900/60 border border-white/40 dark:border-white/5 rounded-[2rem] shadow-md flex flex-col justify-between"
          >
            <div class="flex justify-between items-center mb-3">
              <p class="text-xs uppercase font-bold text-mako-400">Historial Potencia & Voltaje</p>
              <select
                v-model="selectedRange"
                class="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-bold outline-none cursor-pointer dark:bg-mako-900"
              >
                <option value="24h">24 Horas</option>
                <option value="7d">7 Días</option>
                <option value="30d">30 Días</option>
              </select>
            </div>
            <div class="flex-1 min-h-[250px] relative">
              <apexchart
                v-if="selectedCerro && selectedCerro.history.voltage.length > 0"
                type="line"
                width="100%"
                height="100%"
                :options="chartOptions"
                :series="chartSeries"
              />
              <div
                v-else
                class="h-full flex items-center justify-center text-xs text-mako-400 italic"
              >
                Recopilando datos históricos de transmisión...
              </div>
            </div>
          </div>
        </div>

        <!-- Pronósticos del Clima Semanal -->
        <div class="grid-stack-item" gs-w="4" gs-h="3" gs-x="8" gs-y="3">
          <div
            class="grid-stack-item-content p-6 bg-white/80 dark:bg-mako-900/60 border border-white/40 dark:border-white/5 rounded-[2rem] shadow-md flex flex-col justify-between"
          >
            <div>
              <p class="text-xs uppercase font-bold text-mako-400 mb-4">
                Clima del Cerro (Pronóstico)
              </p>
              <div class="divide-y divide-mako-200/50 dark:divide-white/5">
                <div
                  v-for="fc in selectedCerro?.weatherForecast"
                  :key="fc.day"
                  class="flex items-center justify-between py-2 text-sm"
                >
                  <span class="font-semibold text-mako-500 w-12">{{ fc.day }}</span>
                  <span class="flex-1 text-center font-medium text-xs dark:text-mako-300">{{
                    fc.status
                  }}</span>
                  <div class="flex items-center gap-2">
                    <span class="font-bold">{{ fc.temp }}</span>
                    <div
                      v-html="getWeatherSvg(fc.icon)"
                      class="w-6 h-6 flex items-center justify-center"
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- PANEL LATERAL DE SELECCIÓN DE CERROS -->
    <div class="xl:col-span-1 space-y-4">
      <div
        class="p-6 bg-white/80 dark:bg-mako-900/60 border border-white/40 dark:border-white/5 rounded-[2rem] shadow-md h-full"
      >
        <h2 class="text-lg font-semibold mb-4 flex items-center gap-2">
          <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z"
            />
          </svg>
          Seleccionar Cerro
        </h2>

        <div class="space-y-3">
          <button
            v-for="c in allowedCerros"
            :key="c.id"
            @click="selectedCerroId = c.id"
            class="w-full text-left p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between"
            :class="
              selectedCerroId === c.id
                ? 'bg-primary/10 border-primary shadow-inner text-primary font-semibold'
                : 'bg-mako-100/50 hover:bg-mako-100 dark:bg-mako-800/20 dark:hover:bg-mako-800/40 border-transparent'
            "
          >
            <div class="flex justify-between items-center w-full">
              <span class="text-sm font-semibold truncate">{{ c.name }}</span>
              <span
                class="w-2 h-2 rounded-full"
                :class="c.metrics.doorOpen ? 'bg-red-500 animate-ping' : 'bg-green-500'"
              ></span>
            </div>
            <div class="flex justify-between w-full mt-2 text-[10px] text-mako-400">
              <span>{{ c.repeaters.length }} Repetidora(s)</span>
              <span>⚡ {{ c.metrics.power }}W</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.glass-card-radio {
  @apply flex flex-col items-center justify-center p-5 bg-white/80 dark:bg-mako-900/60 backdrop-blur-xl border border-white/40 dark:border-white/5 shadow-[0_8px_25px_rgb(0,0,0,0.03)] dark:shadow-[0_8px_25px_rgb(0,0,0,0.15)] rounded-3xl transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/20;
}
.label-radio {
  @apply text-[10px] uppercase font-bold tracking-widest text-mako-400;
}
.value-radio {
  @apply text-3xl font-semibold tracking-tighter mt-1;
}
.unit-radio {
  @apply text-xs ml-0.5 font-medium opacity-85 text-primary;
}
</style>
