<script setup>
import { computed, ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useTelemetricsStore } from '../stores/telemetrics'
import { useDark } from '@vueuse/core'
import { LMap, LTileLayer, LMarker, LPopup } from '@vue-leaflet/vue-leaflet'
import 'leaflet/dist/leaflet.css'
import { GridStack } from 'gridstack'
import 'gridstack/dist/gridstack.min.css'

import { useRoute } from 'vue-router'
import { api } from '../services/api'

// Importar Widgets Dinámicos
import MetricCard from '../components/widgets/MetricCard.vue'
import BatteryCard from '../components/widgets/BatteryCard.vue'
import SignalCard from '../components/widgets/SignalCard.vue'
import StatusCard from '../components/widgets/StatusCard.vue'
import GaugeWidget from '../components/widgets/GaugeWidget.vue'
import LineChartWidget from '../components/widgets/LineChartWidget.vue'

const auth = useAuthStore()
const store = useTelemetricsStore()
const isDark = useDark()
const route = useRoute()

const selectedCerroId = computed(() => route.params.id)

const selectedCerro = computed(() => {
  return store.cerros.find(c => c.id === selectedCerroId.value)
})

const allowedZonas = computed(() => {
  return selectedCerro.value?.zonas || []
})

// Zona Seleccionada
const selectedZonaId = ref('')

watch([selectedCerroId, allowedZonas], () => {
  if (allowedZonas.value.length > 0 && (!selectedZonaId.value || !allowedZonas.value.find(z => z.id === selectedZonaId.value))) {
    selectedZonaId.value = allowedZonas.value[0].id
  }
}, { immediate: true })

const selectedZona = computed(() => {
  return allowedZonas.value.find((z) => z.id === selectedZonaId.value) || null
})

// Ordenar widgets según especificación (Doc 04): widgets.sort((a, b) => a.orden - b.orden)
const sortedWidgets = computed(() => {
  if (!selectedZona.value || !selectedZona.value.widgets) return []
  return [...selectedZona.value.widgets].sort((a, b) => (a.orden || 0) - (b.orden || 0))
})

// Coordenadas de mapa
const mapZoom = ref(15)
const mapCenter = ref([-36.6083, -72.1022])
const map = ref(null)

const updateMapLocation = () => {
  if (selectedZona.value) {
    mapCenter.value = [selectedZona.value.lat, selectedZona.value.lng]
    mapZoom.value = selectedZona.value.zoom
  }
}

const isGridLoading = ref(false)
let grid = null

const initGrid = async () => {
  await nextTick()
  if (grid) {
    grid.off('dragstop resizestop')
    grid.destroy(false)
    grid = null
  }
  setTimeout(async () => {
    const el = document.querySelector('.grid-stack')
    if (el) {
      const isMobile = window.innerWidth <= 768
      grid = GridStack.init({
        cellHeight: '145px',
        margin: 16,
        minRow: 1,
        columnOpts: {
          breakpointForWindow: true,
          breakpoints: [
            { w: 768, c: 1 }
          ]
        },
        disableDrag: isMobile,
        disableResize: isMobile
      })

      isGridLoading.value = true

      // Cargar Layout desde el Backend
      if (selectedZona.value && selectedZona.value.dashboard_template_id) {
        try {
          const res = await api(`/cuentas/preferencias/?sitio=${selectedCerro.value.id}&dashboard_template=${selectedZona.value.dashboard_template_id}`)
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
            // Cargar componentes estáticos de localStorage
            const localStr = localStorage.getItem(`grid_static_${selectedZona.value.id}`)
            if (localStr) {
              finalLayout.push(...JSON.parse(localStr))
            }
            
            // Aplicar layout guardado
            if (finalLayout.length > 0) {
              grid.batchUpdate()
              for (const item of finalLayout) {
                const el = document.querySelector(`[gs-id="${item.id}"]`)
                if (el) {
                  grid.update(el, { x: item.x, y: item.y, w: item.w, h: item.h })
                }
              }
              grid.batchUpdate(false)
            }
          }
        } catch (e) {
          console.warn('No se pudo cargar el layout personalizado', e)
        }
      }

      setTimeout(() => {
        isGridLoading.value = false
      }, 500)

      // Guardar Layout al arrastrar/redimensionar
      grid.on('dragstop resizestop', async () => {
        if (isGridLoading.value) return
        if (localStorage.getItem('is_resetting_layout') === 'true') return
        if (!selectedZona.value || !selectedZona.value.dashboard_template_id) return
        
        const layout = grid.save()
        
        const backendLayout = layout.filter(item => item.id && !item.id.startsWith('widget-')).map(item => {
          const el = document.querySelector(`[gs-id="${item.id}"]`)
          const node = el ? el.gridstackNode : null
          return {
            widget_id: item.id,
            x: item.x ?? node?.x ?? 0,
            y: item.y ?? node?.y ?? 0,
            w: item.w ?? node?.w ?? parseInt(el?.getAttribute('gs-w')) ?? 1,
            h: item.h ?? node?.h ?? parseInt(el?.getAttribute('gs-h')) ?? 1
          }
        })
        
        const staticLayout = layout.filter(item => item.id && item.id.startsWith('widget-')).map(item => {
          const el = document.querySelector(`[gs-id="${item.id}"]`)
          const node = el ? el.gridstackNode : null
          return {
            id: item.id,
            x: item.x ?? node?.x ?? 0,
            y: item.y ?? node?.y ?? 0,
            w: item.w ?? node?.w ?? parseInt(el?.getAttribute('gs-w')) ?? 1,
            h: item.h ?? node?.h ?? parseInt(el?.getAttribute('gs-h')) ?? 1
          }
        })
        
        localStorage.setItem(`grid_static_${selectedZona.value.id}`, JSON.stringify(staticLayout))

        if (backendLayout.length > 0) {
          try {
            const res = await api('/cuentas/preferencias/', {
              method: 'PUT',
              body: JSON.stringify({
                sitio_id: selectedCerro.value.id,
                dashboard_template_id: selectedZona.value.dashboard_template_id,
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

      // Ajustar dimensiones del mapa Leaflet
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
  [selectedCerroId, selectedZonaId],
  () => {
    updateMapLocation()
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
  if (grid) {
    grid.off('dragstop resizestop')
    grid.destroy(false)
  }
})
</script>

<template>
  <AppLoader v-if="store.isLoading" />

  <div
    v-else-if="!selectedCerro || allowedZonas.length === 0"
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
    <h2 class="text-xl font-bold">Sin Zonas autorizadas</h2>
    <p class="text-sm text-mako-500 dark:text-mako-400 mt-2 max-w-md">
      Su usuario no cuenta con permisos para visualizar nada en este momento. Por
      favor, póngase en contacto con su Administrador.
    </p>
  </div>

  <div v-else class="grid grid-cols-1 xl:grid-cols-4 gap-8">
    <!-- PANEL PRINCIPAL (3 columnas en escritorio) -->
    <div class="xl:col-span-3 space-y-6">
      <!-- Caso: Sin plantilla de Dashboard (Doc 04) -->
      <div v-if="!selectedZona?.dashboard_template_id" class="flex flex-col items-center justify-center p-12 bg-white/80 dark:bg-mako-800/60 border border-white/40 dark:border-white/5 rounded-[2rem] shadow-md text-center min-h-[40vh] select-none">
        <svg class="w-12 h-12 text-amber-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <h3 class="text-lg font-bold text-mako-700 dark:text-mako-200">Dashboard no disponible</h3>
        <p class="text-sm text-mako-400 mt-1">No hay dashboard configurado para esta empresa y tipo de dispositivo.</p>
      </div>

      <!-- Caso: Dashboard existe pero no tiene widgets (Doc 04) -->
      <div v-else-if="sortedWidgets.length === 0" class="flex flex-col items-center justify-center p-12 bg-white/80 dark:bg-mako-800/60 border border-white/40 dark:border-white/5 rounded-[2rem] shadow-md text-center min-h-[40vh] select-none">
        <svg class="w-12 h-12 text-mako-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <h3 class="text-lg font-bold text-mako-700 dark:text-mako-200">Sin widgets configurados</h3>
        <p class="text-sm text-mako-400 mt-1">Este dashboard aún no tiene widgets configurados.</p>
      </div>

      <!-- Cuadrícula Drag and Drop (Gridstack) -->
      <div v-else class="grid-stack mt-4">
        <!-- Renderizar widgets dinámicos -->
        <div 
          v-for="w in sortedWidgets" 
          :key="w.id" 
          class="grid-stack-item" 
          :gs-id="w.id" 
          :gs-w="w.ancho || 3" 
          :gs-h="w.alto || 1"
        >
          <div class="grid-stack-item-content !p-0 bg-transparent rounded-3xl overflow-hidden">
            <MetricCard v-if="w.tipo_widget === 'metric_card'" :widget="w" />
            <BatteryCard v-else-if="w.tipo_widget === 'battery_card'" :widget="w" />
            <SignalCard v-else-if="w.tipo_widget === 'signal_card'" :widget="w" />
            <StatusCard v-else-if="w.tipo_widget === 'status_card'" :widget="w" />
            <GaugeWidget v-else-if="w.tipo_widget === 'gauge'" :widget="w" />
            <LineChartWidget v-else-if="w.tipo_widget === 'line_chart'" :widget="w" :serial="w.device_serial" />
            <MetricCard v-else :widget="w" />
          </div>
        </div>

        <!-- Mapa del Cerro (Sitio) - Elemento estático del frontend -->
        <div class="grid-stack-item" gs-id="widget-map" gs-w="4" gs-h="2">
          <div
            class="grid-stack-item-content !p-0 bg-white/80 dark:bg-mako-800/60 border border-white/40 dark:border-white/5 rounded-[2rem] overflow-hidden shadow-md relative"
          >
            <l-map
              v-if="selectedZona"
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

              <!-- Marcadores de Sensores en el Cerro -->
              <l-marker
                v-for="s in selectedZona.sensors"
                :key="s.id"
                :lat-lng="[selectedZona.lat + s.latOffset, selectedZona.lng + s.lngOffset]"
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
      </div>
    </div>

    <!-- SIDEBAR DE ZONAS (1 columna en escritorio) -->
    <div class="xl:col-span-1 space-y-4">
      <div
        class="p-6 bg-white/80 dark:bg-mako-800/60 border border-white/40 dark:border-white/5 rounded-[2rem] shadow-md h-full"
      >
        <h2 class="text-normal font-semibold mb-4 flex items-center gap-2">
          <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            />
          </svg>
          Zonas
        </h2>

        <div class="space-y-3">
          <button
            v-for="z in allowedZonas"
            :key="z.id"
            @click="selectedZonaId = z.id"
            class="w-full text-left p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between"
            :class="
              selectedZonaId === z.id
                ? 'bg-primary/10 border-primary shadow-inner text-primary font-semibold'
                : 'bg-mako-100/50 hover:bg-mako-100 dark:bg-mako-800/20 dark:hover:bg-mako-800/40 border-transparent'
            "
          >
            <div class="flex justify-between items-center w-full">
              <span class="text-sm font-semibold truncate">{{ z.name }}</span>
              <span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>
            </div>
            <div class="flex justify-between w-full mt-2 text-[10px] text-mako-400">
              <span>{{ z.sensors.length }} Sensores</span>
              <span>🔋 {{ z.metrics.battery }}%</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Estilos adicionales si fueran necesarios */
</style>
