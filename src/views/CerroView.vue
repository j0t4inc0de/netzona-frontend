<script setup>
import { computed, ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useTelemetricsStore } from '../stores/telemetrics'
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

const store = useTelemetricsStore()
const route = useRoute()

const getWidgetSpec = (tipoWidget) => {
  const specs = {
    line_chart: { defaultW: 6, defaultH: 2, minW: 4, minH: 2 },
    gauge: { defaultW: 3, defaultH: 2, minW: 2, minH: 1 },
    metric_card: { defaultW: 3, defaultH: 1, minW: 2, minH: 1 },
    battery_card: { defaultW: 3, defaultH: 1, minW: 2, minH: 1 },
    signal_card: { defaultW: 3, defaultH: 1, minW: 2, minH: 1 },
    status_card: { defaultW: 3, defaultH: 1, minW: 2, minH: 1 }
  }
  return specs[tipoWidget] || { defaultW: 3, defaultH: 1, minW: 2, minH: 1 }
}

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
let grids = []
let initGridTimeout = null

const initGrid = async () => {
  await nextTick()
  if (initGridTimeout) {
    clearTimeout(initGridTimeout)
    initGridTimeout = null
  }
  if (grids.length > 0) {
    grids.forEach(g => {
      g.off('dragstop resizestop')
      g.destroy(false)
    })
    grids = []
  }
  initGridTimeout = setTimeout(async () => {
    const isResetting = localStorage.getItem('is_resetting_layout') === 'true'
    
    const elements = document.querySelectorAll('.grid-stack')
    elements.forEach(async (el) => {
      const devId = el.getAttribute('data-device-id')
      if (!devId) return
      
      const dev = selectedZona.value?.dispositivos?.find(d => d.id === devId)
      if (!dev) return

      if (isResetting) {
        const items = el.querySelectorAll('.grid-stack-item')
        items.forEach(itemEl => {
          itemEl.removeAttribute('gs-x')
          itemEl.removeAttribute('gs-y')
          itemEl.removeAttribute('style')
        })
        el.removeAttribute('style')
      }

      // Copy attributes
      const items = el.querySelectorAll('.grid-stack-item')
      items.forEach(itemEl => {
        const w = itemEl.getAttribute('data-gs-w')
        const h = itemEl.getAttribute('data-gs-h')
        const minW = itemEl.getAttribute('data-gs-min-w')
        const minH = itemEl.getAttribute('data-gs-min-h')
        if (w) itemEl.setAttribute('gs-w', w)
        if (h) itemEl.setAttribute('gs-h', h)
        if (minW) itemEl.setAttribute('gs-min-w', minW)
        if (minH) itemEl.setAttribute('gs-min-h', minH)
      })

      const isMobile = window.innerWidth <= 768
      const gridInst = GridStack.init({
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
      }, el) || el.gridstack

      if (!gridInst) return

      grids.push(gridInst)

      isGridLoading.value = true

      // Load layout
      if (dev.dashboard_template_id) {
        try {
          let layoutData = null
          if (dev.layout_dashboard) {
            layoutData = dev.layout_dashboard
          } else {
            const res = await api(`/cuentas/preferencias/?sitio=${selectedCerro.value.id}&dashboard_template=${dev.dashboard_template_id}`)
            if (res.ok) {
              const data = await res.json()
              layoutData = data.layout_dashboard
            }
          }

          if (layoutData) {
            const finalLayout = []
            if (layoutData.length > 0) {
              const mappedLayout = layoutData.map(item => ({
                id: item.widget_id || item.id,
                x: item.x,
                y: item.y,
                w: item.w,
                h: item.h
              }))
              finalLayout.push(...mappedLayout)
            }
            const localStr = localStorage.getItem(`grid_static_${dev.id}`)
            if (localStr && !isResetting) {
              finalLayout.push(...JSON.parse(localStr))
            }
            
            if (finalLayout.length > 0) {
              gridInst.batchUpdate()
              for (const item of finalLayout) {
                const itemEl = el.querySelector(`[gs-id="${item.id}"]`)
                if (itemEl) {
                  gridInst.update(itemEl, { x: item.x, y: item.y, w: item.w, h: item.h })
                }
              }
              gridInst.batchUpdate(false)
            }
          }
        } catch (e) {
          console.warn('No se pudo cargar el layout para el dispositivo', dev.serial, e)
        }
      }

      setTimeout(() => {
        isGridLoading.value = false
      }, 500)

      gridInst.on('dragstop resizestop', async () => {
        if (isGridLoading.value) return
        if (localStorage.getItem('is_resetting_layout') === 'true') return
        if (!dev.dashboard_template_id) return
        
        const layout = gridInst.save()
        
        const backendLayout = layout.filter(item => item.id && !item.id.startsWith('widget-')).map(item => {
          const itemEl = el.querySelector(`[gs-id="${item.id}"]`)
          const node = itemEl ? itemEl.gridstackNode : null

          const rawW = item.w ?? node?.w ?? parseInt(itemEl?.getAttribute('gs-w'))
          const rawH = item.h ?? node?.h ?? parseInt(itemEl?.getAttribute('gs-h'))
          const rawX = item.x ?? node?.x ?? parseInt(itemEl?.getAttribute('gs-x'))
          const rawY = item.y ?? node?.y ?? parseInt(itemEl?.getAttribute('gs-y'))

          const w = isNaN(rawW) ? 1 : Math.max(1, parseInt(rawW))
          const h = isNaN(rawH) ? 1 : Math.max(1, parseInt(rawH))
          const x = isNaN(rawX) ? 0 : Math.max(0, parseInt(rawX))
          const y = isNaN(rawY) ? 0 : Math.max(0, parseInt(rawY))

          return {
            widget_id: item.id,
            x,
            y,
            w,
            h
          }
        })
        
        const staticLayout = layout.filter(item => item.id && item.id.startsWith('widget-')).map(item => {
          const itemEl = el.querySelector(`[gs-id="${item.id}"]`)
          const node = itemEl ? itemEl.gridstackNode : null

          const rawW = item.w ?? node?.w ?? parseInt(itemEl?.getAttribute('gs-w'))
          const rawH = item.h ?? node?.h ?? parseInt(itemEl?.getAttribute('gs-h'))
          const rawX = item.x ?? node?.x ?? parseInt(itemEl?.getAttribute('gs-x'))
          const rawY = item.y ?? node?.y ?? parseInt(itemEl?.getAttribute('gs-y'))

          const w = isNaN(rawW) ? 1 : Math.max(1, parseInt(rawW))
          const h = isNaN(rawH) ? 1 : Math.max(1, parseInt(rawH))
          const x = isNaN(rawX) ? 0 : Math.max(0, parseInt(rawX))
          const y = isNaN(rawY) ? 0 : Math.max(0, parseInt(rawY))

          return {
            id: item.id,
            x,
            y,
            w,
            h
          }
        })
        
        localStorage.setItem(`grid_static_${dev.id}`, JSON.stringify(staticLayout))

        if (backendLayout.length > 0) {
          try {
            await api('/cuentas/preferencias/', {
              method: 'PATCH',
              body: JSON.stringify({
                sitio_id: selectedCerro.value.id,
                dashboard_template_id: dev.dashboard_template_id,
                layout_dashboard: backendLayout
              })
            })
          } catch (e) {
            console.error('Error al guardar layout para el dispositivo', dev.serial, e)
          }
        }
      })
    })

    setTimeout(() => {
      if (map.value && map.value.leafletObject) {
        map.value.leafletObject.invalidateSize()
      }
      window.dispatchEvent(new Event('resize'))
    }, 300)
  }, 100)
}

onMounted(() => {
  initGrid()
})

// Cargar dinámicamente zonas, dispositivos y dashboards para el cerro seleccionado
watch(selectedCerroId, async (newId) => {
  if (newId) {
    await store.fetchCerroDetails(newId)
  }
}, { immediate: true })

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
  if (initGridTimeout) {
    clearTimeout(initGridTimeout)
  }
  if (grids.length > 0) {
    grids.forEach(g => {
      g.off('dragstop resizestop')
      g.destroy(false)
    })
  }
})</script>

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
      <!-- Caso: Sin dispositivos en la Zona -->
      <div v-if="!selectedZona?.dispositivos || selectedZona.dispositivos.length === 0" class="flex flex-col items-center justify-center p-12 bg-white/80 dark:bg-mako-800/60 border border-white/40 dark:border-white/5 rounded-[2rem] shadow-md text-center min-h-[40vh] select-none">
        <svg class="w-12 h-12 text-mako-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
        </svg>
        <h3 class="text-lg font-bold text-mako-700 dark:text-mako-200">Sin dispositivos registrados</h3>
        <p class="text-sm text-mako-400 mt-1">Esta zona no tiene ningún dispositivo asignado aún.</p>
      </div>

      <!-- Cuadrículas por Dispositivo -->
      <div v-else class="space-y-8">
        <div v-for="dev in selectedZona.dispositivos" :key="dev.id" class="space-y-4">
          <!-- Encabezado del Dispositivo -->
          <div class="flex flex-wrap justify-between items-center bg-white/80 dark:bg-mako-800/60 backdrop-blur-xl border border-white/40 dark:border-white/5 rounded-2xl px-6 py-4 shadow-sm">
            <div>
              <h3 class="text-base font-bold text-mako-900 dark:text-white">{{ dev.nombre }}</h3>
              <p class="text-xs text-mako-500 font-mono mt-0.5">S/N: {{ dev.serial }}</p>
            </div>
            
            <!-- Google Maps link if coords loaded -->
            <div v-if="dev.latitud !== null && dev.latitud !== undefined && dev.latitud !== '' && dev.longitud !== null && dev.longitud !== undefined && dev.longitud !== ''">
              <a :href="`https://www.google.com/maps?q=${dev.latitud},${dev.longitud}`" target="_blank" rel="noopener noreferrer" class="text-xs font-bold text-primary hover:underline flex items-center gap-1 bg-primary/10 px-3 py-1.5 rounded-full transition-all">
                Ver en Google Maps
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
              </a>
            </div>
          </div>

          <!-- Caso: Sin plantilla de Dashboard para este Dispositivo -->
          <div v-if="!dev.dashboard_template_id" class="flex flex-col items-center justify-center p-8 bg-white/50 dark:bg-mako-800/30 border border-dashed border-mako-300 dark:border-mako-700 rounded-[2rem] text-center min-h-[20vh] select-none">
            <h4 class="text-sm font-semibold text-mako-600 dark:text-mako-300">Dashboard no disponible para este equipo</h4>
            <p class="text-xs text-mako-400 mt-1">Registre una plantilla de dashboard en el Panel Técnico.</p>
          </div>

          <!-- Caso: Dashboard existe pero no tiene widgets -->
          <div v-else-if="!dev.widgets || dev.widgets.length === 0" class="flex flex-col items-center justify-center p-8 bg-white/50 dark:bg-mako-800/30 border border-dashed border-mako-300 dark:border-mako-700 rounded-[2rem] text-center min-h-[20vh] select-none">
            <h4 class="text-sm font-semibold text-mako-600 dark:text-mako-300">Sin widgets configurados</h4>
            <p class="text-xs text-mako-400 mt-1">Este dashboard aún no tiene widgets configurados para este dispositivo.</p>
          </div>

          <!-- Cuadrícula Gridstack para el Dispositivo -->
          <div v-else class="grid-stack mt-2" :data-device-id="dev.id">
            <div 
              v-for="w in [...dev.widgets].sort((a, b) => (a.orden || 0) - (b.orden || 0))" 
              :key="w.id" 
              class="grid-stack-item" 
              :gs-id="w.id" 
              :data-gs-w="getWidgetSpec(w.tipo_widget).defaultW" 
              :data-gs-h="getWidgetSpec(w.tipo_widget).defaultH"
              :data-gs-min-w="getWidgetSpec(w.tipo_widget).minW"
              :data-gs-min-h="getWidgetSpec(w.tipo_widget).minH"
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
          </div>
        </div>

        <!-- Leaflet Map Container at the bottom of the column -->
        <div class="bg-white/80 dark:bg-mako-800/60 border border-white/40 dark:border-white/5 rounded-[2rem] overflow-hidden shadow-md relative h-[400px] w-full">
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
