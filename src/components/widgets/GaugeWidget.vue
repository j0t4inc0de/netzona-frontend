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

const min = computed(() => {
  return props.widget.configuracion?.min !== undefined ? Number(props.widget.configuracion.min) : 0
})

const max = computed(() => {
  return props.widget.configuracion?.max !== undefined ? Number(props.widget.configuracion.max) : 100
})

const percentage = computed(() => {
  if (props.widget.valor === null || props.widget.valor === undefined) return 0
  const val = Number(props.widget.valor)
  const range = max.value - min.value
  if (range <= 0) return 0
  const pct = ((val - min.value) / range) * 100
  return Math.max(0, Math.min(100, pct))
})

// SVG gauge calculation: circle with radius 36, circumference 226.19
const strokeDashoffset = computed(() => {
  const circumference = 226.19
  // If it's a full circle:
  // return circumference - (percentage.value / 100) * circumference
  // But a semi-circle or 3/4 circle is cooler. Let's do a 3/4 circle (arc length 270 deg)
  // Let's keep it simple with a full circular progress bar centered nicely:
  return circumference - (percentage.value / 100) * circumference
})

const isStale = computed(() => {
  return props.widget.estado && props.widget.estado !== 'ok'
})
</script>

<template>
  <div class="h-full w-full flex flex-col items-center justify-center p-4 bg-white/80 dark:bg-mako-900/60 backdrop-blur-xl border border-white/40 dark:border-white/5 shadow-[0_8px_25px_rgba(0,0,0,0.03)] dark:shadow-[0_8px_25px_rgba(0,0,0,0.15)] rounded-3xl transition-all duration-300 hover:border-primary/20 select-none relative">
    <div v-if="isStale" class="absolute top-3 right-3 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase">
      {{ widget.estado === 'stale' ? 'Desactualizado' : widget.estado }}
    </div>

    <!-- Título del Gauge -->
    <p class="text-[10px] uppercase font-bold tracking-widest text-mako-400 text-center truncate w-full px-2">
      {{ widget.titulo || 'Medidor' }}
    </p>

    <!-- Indicador de Aguja/Círculo SVG -->
    <div class="relative w-20 h-20 flex items-center justify-center mt-1">
      <svg class="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
        <!-- Círculo de Fondo -->
        <circle
          cx="50"
          cy="50"
          r="36"
          stroke="currentColor"
          stroke-width="7"
          fill="transparent"
          class="text-mako-200 dark:text-mako-800"
        />
        <!-- Arco de Progreso -->
        <circle
          cx="50"
          cy="50"
          r="36"
          stroke="currentColor"
          stroke-width="7"
          stroke-linecap="round"
          fill="transparent"
          class="text-primary transition-all duration-500 ease-out"
          :stroke-dasharray="226.19"
          :stroke-dashoffset="strokeDashoffset"
        />
      </svg>
      <!-- Texto Central -->
      <div class="absolute inset-0 flex flex-col items-center justify-center">
        <span class="text-xl font-bold tracking-tight">{{ displayValue }}</span>
        <span v-if="widget.unidad && widget.valor !== null" class="text-[9px] font-bold text-primary -mt-1">
          {{ widget.unidad }}
        </span>
      </div>
    </div>

    <!-- Rango Mín/Máx e Info -->
    <div class="flex justify-between w-[85%] text-[8px] text-mako-400 font-semibold mt-1">
      <span>Mín: {{ min }}</span>
      <span>Máx: {{ max }}</span>
    </div>

    <div class="text-[9px] text-mako-400 font-medium mt-1">
      <span v-if="widget.valor === null">Sin datos</span>
      <span v-else-if="formattedTime">Medido: {{ formattedTime }}</span>
    </div>
  </div>
</template>
