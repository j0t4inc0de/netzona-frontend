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

const isStale = computed(() => {
  return props.widget.estado && props.widget.estado !== 'ok'
})
</script>

<template>
  <div class="h-full w-full flex flex-col items-center justify-center p-5 bg-white/80 dark:bg-mako-900/60 backdrop-blur-xl border border-white/40 dark:border-white/5 shadow-[0_8px_25px_rgba(0,0,0,0.03)] dark:shadow-[0_8px_25px_rgba(0,0,0,0.15)] rounded-3xl transition-all duration-300 hover:border-primary/20 select-none relative">
    <!-- Badge de estado de advertencia -->
    <div v-if="isStale" class="absolute top-3 right-3 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase">
      {{ widget.estado === 'stale' ? 'Desactualizado' : widget.estado }}
    </div>

    <p class="text-[10px] uppercase font-bold tracking-widest text-mako-400 text-center truncate w-full px-2">
      {{ widget.titulo || widget.nombre_sensor || 'Métrica' }}
    </p>
    
    <h3 class="text-3xl font-semibold tracking-tighter mt-1 flex items-baseline">
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
