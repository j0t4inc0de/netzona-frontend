<script setup>
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useTelemetricsStore } from '../stores/telemetrics'
import { themeColors } from '../theme'
import { LMap, LTileLayer, LMarker, LPopup } from '@vue-leaflet/vue-leaflet'
import 'leaflet/dist/leaflet.css'
import { GridStack } from 'gridstack'
import 'gridstack/dist/gridstack.min.css'

const auth = useAuthStore()
const store = useTelemetricsStore()

// Filtrar predios por permisos
const allowedPredios = computed(() => {
  if (auth.userRole === 'admin' || auth.userRole === 'tecnico') {
    return store.predios
  }
  return store.predios.filter((p) => auth.accessibleItems.includes(p.id))
})

// Predio Seleccionado
const selectedPredioId = ref('')
if (allowedPredios.value.length > 0) {
  selectedPredioId.value = allowedPredios.value[0].id
}

const selectedPredio = computed(() => {
  return store.predios.find((p) => p.id === selectedPredioId.value) || null
})

// Coordenadas de mapa
const mapZoom = ref(15)
const mapCenter = ref([-36.6083, -72.1022])
const map = ref(null)

const updateMapLocation = () => {
  if (selectedPredio.value) {
    mapCenter.value = [selectedPredio.value.lat, selectedPredio.value.lng]
    mapZoom.value = selectedPredio.value.zoom
  }
}

let grid = null
const initGrid = () => {
  if (grid) {
    grid.destroy(false)
  }
  setTimeout(() => {
    const el = document.querySelector('.grid-stack')
    if (el) {
      grid = GridStack.init({
        cellHeight: '145px',
        margin: 16,
        minRow: 1,
      })
      // Ajustar dimensiones del mapa Leaflet cuando el grid termina de posicionar
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

// Escuchar cambios de predio seleccionado
watch(
  selectedPredioId,
  () => {
    updateMapLocation()
    initGrid()
  },
  { immediate: true },
)

onUnmounted(() => {
  if (grid) grid.destroy(false)
})

// Configuración del gráfico ApexCharts
const chartSeries = computed(() => {
  if (!selectedPredio.value) return []
  return [
    {
      name: 'Humedad Suelo (%)',
      data: selectedPredio.value.history.soilMoisture,
    },
    {
      name: 'Temperatura Ambient. (°C)',
      data: selectedPredio.value.history.temperature,
    },
  ]
})

const chartOptions = computed(() => {
  const isDark = document.documentElement.classList.contains('dark')
  return {
    chart: {
      type: 'area',
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
      mode: isDark ? 'dark' : 'light',
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
    colors: [themeColors.primary.DEFAULT, '#f59e0b'],
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
      },
    },
    tooltip: {
      shared: true,
      intersect: false,
    },
    legend: {
      position: 'top',
      horizontalAlign: 'right',
      fontSize: '11px',
    },
  }
})
</script>

<template>
  <div
    v-if="allowedPredios.length === 0"
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
    <h2 class="text-xl font-bold">Sin predios agrícolas autorizados</h2>
    <p class="text-sm text-mako-500 dark:text-mako-400 mt-2 max-w-md">
      Su usuario no cuenta con permisos para visualizar ningún predio agrícola en este momento. Por
      favor, póngase en contacto con su Administrador.
    </p>
  </div>

  <div v-else class="grid grid-cols-1 xl:grid-cols-4 gap-8">
    <!-- PANEL PRINCIPAL (3 columnas en escritorio) -->
    <div class="xl:col-span-3 space-y-6">
      <!-- Cuadrícula Drag and Drop (Gridstack) -->
      <div class="grid-stack mt-4">
        <!-- Temperatura -->
        <div class="grid-stack-item" gs-w="3" gs-h="1" gs-x="0" gs-y="0">
          <div class="grid-stack-item-content glass-card-agro">
            <p class="label-agro">Temp. Aire</p>
            <h3 class="value-agro">
              {{ selectedPredio?.metrics.temperature }}<span class="unit-agro">°C</span>
            </h3>
          </div>
        </div>

        <!-- Humedad del Aire -->
        <div class="grid-stack-item" gs-w="3" gs-h="1" gs-x="3" gs-y="0">
          <div class="grid-stack-item-content glass-card-agro">
            <p class="label-agro">Humedad Aire</p>
            <h3 class="value-agro">
              {{ selectedPredio?.metrics.humidity }}<span class="unit-agro">%</span>
            </h3>
          </div>
        </div>

        <!-- Humedad del Suelo -->
        <div class="grid-stack-item" gs-w="3" gs-h="1" gs-x="6" gs-y="0">
          <div class="grid-stack-item-content glass-card-agro">
            <p class="label-agro">Hum. Suelo</p>
            <h3 class="value-agro text-primary">
              {{ selectedPredio?.metrics.soilMoisture }}<span class="unit-agro">%</span>
            </h3>
          </div>
        </div>

        <!-- Voltaje Panel Solar -->
        <div class="grid-stack-item" gs-w="3" gs-h="1" gs-x="9" gs-y="0">
          <div class="grid-stack-item-content glass-card-agro">
            <p class="label-agro">Panel Solar</p>
            <h3 class="value-agro">
              {{ selectedPredio?.metrics.solarPanelVoltage }}<span class="unit-agro">V</span>
            </h3>
          </div>
        </div>

        <!-- Batería del Sensor -->
        <div class="grid-stack-item" gs-w="8" gs-h="1" gs-x="0" gs-y="1">
          <div class="grid-stack-item-content glass-card-agro">
            <p class="label-agro">Batería Nodo</p>
            <h3
              class="value-agro"
              :class="selectedPredio?.metrics.battery < 20 ? 'text-red-500' : ''"
            >
              {{ selectedPredio?.metrics.battery }}<span class="unit-agro">%</span>
            </h3>
          </div>
        </div>

        <!-- Mapa de Predio -->
        <div class="grid-stack-item" gs-w="4" gs-h="2" gs-x="8" gs-y="1">
          <div
            class="grid-stack-item-content !p-0 bg-white/80 dark:bg-mako-900/60 border border-white/40 dark:border-white/5 rounded-[2rem] overflow-hidden shadow-md relative"
          >
            <l-map
              v-if="selectedPredio"
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

              <!-- Marcadores de Sensores en el Predio -->
              <l-marker
                v-for="s in selectedPredio.sensors"
                :key="s.id"
                :lat-lng="[selectedPredio.lat + s.latOffset, selectedPredio.lng + s.lngOffset]"
              >
                <l-popup>
                  <div class="p-1 font-sans text-mako-900">
                    <h4 class="font-bold text-sm">{{ s.name }}</h4>
                    <p class="text-xs text-mako-500 font-semibold mt-0.5">S/N: {{ s.serial }}</p>
                    <p class="text-xs font-bold text-primary mt-1">
                      Lectura: {{ s.value }} {{ s.unit }}
                    </p>
                  </div>
                </l-popup>
              </l-marker>
            </l-map>

            <div
              class="absolute bottom-3 left-3 bg-white/95 dark:bg-mako-950/90 px-3 py-1.5 rounded-full text-[10px] font-bold shadow z-[1000] border border-white/10 flex items-center gap-1.5 pointer-events-none"
            >
              <span class="w-2 h-2 rounded-full bg-primary"></span>
              Objetivos Sensores Activos (GPS)
            </div>
          </div>
        </div>

        <!-- Historial Gráfico -->
        <div class="grid-stack-item" gs-w="8" gs-h="3" gs-x="0" gs-y="2">
          <div
            class="grid-stack-item-content p-6 bg-white/80 dark:bg-mako-900/60 border border-white/40 dark:border-white/5 rounded-[2rem] shadow-md flex flex-col justify-between"
          >
            <div class="flex justify-between items-center mb-3">
              <p class="text-xs uppercase font-bold text-mako-400">Lecturas de Humedad & Temp</p>
              <span
                class="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-bold"
                >Tiempo Real</span
              >
            </div>
            <div class="flex-1 min-h-[250px] relative">
              <apexchart
                v-if="selectedPredio && selectedPredio.history.temperature.length > 0"
                type="area"
                width="100%"
                height="100%"
                :options="chartOptions"
                :series="chartSeries"
              />
              <div
                v-else
                class="h-full flex items-center justify-center text-xs text-mako-400 italic"
              >
                Recopilando datos de simulación...
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- SIDEBAR DE PREDIOS (1 columna en escritorio) -->
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
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            />
          </svg>
          Seleccionar Predio
        </h2>

        <div class="space-y-3">
          <button
            v-for="p in allowedPredios"
            :key="p.id"
            @click="selectedPredioId = p.id"
            class="w-full text-left p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between"
            :class="
              selectedPredioId === p.id
                ? 'bg-primary/10 border-primary shadow-inner text-primary font-semibold'
                : 'bg-mako-100/50 hover:bg-mako-100 dark:bg-mako-800/20 dark:hover:bg-mako-800/40 border-transparent'
            "
          >
            <div class="flex justify-between items-center w-full">
              <span class="text-sm font-semibold truncate">{{ p.name }}</span>
              <span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>
            </div>
            <div class="flex justify-between w-full mt-2 text-[10px] text-mako-400">
              <span>{{ p.sensors.length }} Sensores</span>
              <span>🔋 {{ p.metrics.battery }}%</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.glass-card-agro {
  @apply flex flex-col items-center justify-center p-5 bg-white/80 dark:bg-mako-900/60 backdrop-blur-xl border border-white/40 dark:border-white/5 shadow-[0_8px_25px_rgb(0,0,0,0.03)] dark:shadow-[0_8px_25px_rgb(0,0,0,0.15)] rounded-3xl transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/20;
}
.label-agro {
  @apply text-[10px] uppercase font-bold tracking-widest text-mako-400;
}
.value-agro {
  @apply text-3xl font-semibold tracking-tighter mt-1;
}
.unit-agro {
  @apply text-xs ml-0.5 font-medium opacity-85 text-primary;
}
</style>
