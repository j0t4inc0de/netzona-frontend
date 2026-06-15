<script setup>
import { computed } from 'vue'

const props = defineProps({
  widget: {
    type: Object,
    required: true
  }
})

const displayValue = computed(() => {
  if (props.widget.valor === null || props.widget.valor === undefined) {
    return '--'
  }
  return props.widget.valor
})

const formattedTime = computed(() => {
  if (!props.widget.medido_en) return ''
  const date = new Date(props.widget.medido_en)
  return date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
})

const signalStrength = computed(() => {
  if (props.widget.valor === null || props.widget.valor === undefined) return null
  return Number(props.widget.valor)
})

// Determina cuántas barras de señal encender (de 0 a 4)
const signalBars = computed(() => {
  const rssi = signalStrength.value
  if (rssi === null) return 0
  
  // Si viene en porcentaje (0-100) en lugar de dBm
  if (rssi >= 0 && rssi <= 100) {
    if (rssi > 75) return 4
    if (rssi > 50) return 3
    if (rssi > 25) return 2
    if (rssi > 5) return 1
    return 0
  }

  // Si viene en dBm (típicamente negativo, de -120 a -50)
  if (rssi >= -70) return 4 // Excelente
  if (rssi >= -85) return 3 // Bueno
  if (rssi >= -100) return 2 // Regular
  if (rssi >= -115) return 1 // Malo
  return 0 // Sin señal o extremadamente mala
})

const signalColorClass = computed(() => {
  const bars = signalBars.value
  if (props.widget.valor === null) return 'text-mako-400'
  if (bars === 4) return 'text-green-500 dark:text-primary'
  if (bars === 3) return 'text-green-400 dark:text-primary/80'
  if (bars === 2) return 'text-amber-500'
  return 'text-red-500'
})

const isStale = computed(() => {
  return props.widget.estado && props.widget.estado !== 'ok'
})
</script>

<template>
  <div class="h-full w-full flex flex-col items-center justify-center p-5 bg-white/80 dark:bg-mako-900/60 backdrop-blur-xl border border-white/40 dark:border-white/5 shadow-[0_8px_25px_rgba(0,0,0,0.03)] dark:shadow-[0_8px_25px_rgba(0,0,0,0.15)] rounded-3xl transition-all duration-300 hover:border-primary/20 select-none relative">
    <div v-if="isStale" class="absolute top-3 right-3 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase">
      {{ widget.estado === 'stale' ? 'Desactualizado' : widget.estado }}
    </div>

    <!-- Icono de Señal (Barras dinámicas) -->
    <div class="mb-2 flex items-end gap-[3px] h-6" :class="signalColorClass">
      <div class="w-[3px] rounded-t-sm bg-current" :class="signalBars >= 1 ? 'opacity-100 h-2' : 'opacity-20 h-2'"></div>
      <div class="w-[3px] rounded-t-sm bg-current" :class="signalBars >= 2 ? 'opacity-100 h-[11px]' : 'opacity-20 h-[11px]'"></div>
      <div class="w-[3px] rounded-t-sm bg-current" :class="signalBars >= 3 ? 'opacity-100 h-[14px]' : 'opacity-20 h-[14px]'"></div>
      <div class="w-[3px] rounded-t-sm bg-current" :class="signalBars >= 4 ? 'opacity-100 h-[18px]' : 'opacity-20 h-[18px]'"></div>
    </div>

    <p class="text-[10px] uppercase font-bold tracking-widest text-mako-400 text-center truncate w-full px-2">
      {{ widget.titulo || 'Señal' }}
    </p>

    <h3 class="text-2xl font-semibold tracking-tighter mt-0.5 flex items-baseline">
      <span>{{ displayValue }}</span>
      <span v-if="widget.unidad && widget.valor !== null" class="text-xs ml-0.5 font-medium opacity-85 text-primary">
        {{ widget.unidad }}
      </span>
    </h3>

    <div class="text-[9px] text-mako-400 font-medium mt-1.5">
      <span v-if="widget.valor === null">Sin datos</span>
      <span v-else-if="formattedTime">Medido: {{ formattedTime }}</span>
    </div>
  </div>
</template>
