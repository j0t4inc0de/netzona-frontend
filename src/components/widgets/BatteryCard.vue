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

const batteryLevel = computed(() => {
  if (props.widget.valor === null || props.widget.valor === undefined) return 0
  return Number(props.widget.valor)
})

// Determina el color basado en el nivel
const batteryColorClass = computed(() => {
  const level = batteryLevel.value
  if (props.widget.valor === null) return 'text-mako-400'
  if (level < 20) return 'text-red-500'
  if (level < 50) return 'text-amber-500'
  return 'text-green-500 dark:text-primary'
})

// Determina qué icono de batería mostrar
const batteryIconPath = computed(() => {
  const level = batteryLevel.value
  if (level < 10) return 'M3 10h18M3 14h18M3 7h18a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z' // Empty
  if (level < 33) return 'M6 10h4v4H6v-4Zm-3 0h18M3 14h18M3 7h18a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z' // 1/3
  if (level < 66) return 'M6 10h8v4H6v-4Zm-3 0h18M3 14h18M3 7h18a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z' // 2/3
  return 'M6 10h12v4H6v-4Zm-3 0h18M3 14h18M3 7h18a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z' // Full
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

    <!-- Icono de Batería con SVG adaptable -->
    <div class="mb-1" :class="batteryColorClass">
      <svg class="w-7 h-7" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M18 12h2m2 0h-2m-2-3H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2Zm-3 3v2M9 12v2" />
        <rect x="5" y="11" :width="Math.max(1, Math.min(10, (batteryLevel / 100) * 10))" height="4" rx="0.5" fill="currentColor" opacity="0.8" />
      </svg>
    </div>

    <p class="text-[10px] uppercase font-bold tracking-widest text-mako-400 text-center truncate w-full px-2">
      {{ widget.titulo || 'Batería' }}
    </p>

    <h3 class="text-2xl font-semibold tracking-tighter mt-0.5 flex items-baseline" :class="batteryColorClass">
      <span>{{ displayValue }}</span>
      <span v-if="widget.unidad && widget.valor !== null" class="text-xs ml-0.5 font-medium opacity-85">
        {{ widget.unidad }}
      </span>
    </h3>

    <div class="text-[9px] text-mako-400 font-medium mt-1.5">
      <span v-if="widget.valor === null">Sin datos</span>
      <span v-else-if="formattedTime">Medido: {{ formattedTime }}</span>
    </div>
  </div>
</template>
