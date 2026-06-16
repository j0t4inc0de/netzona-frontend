<script setup>
import { computed } from 'vue'

const props = defineProps({
  widget: {
    type: Object,
    required: true
  }
})

const isBoolean = computed(() => {
  return typeof props.widget.valor === 'boolean'
})

const displayValue = computed(() => {
  if (props.widget.valor === null || props.widget.valor === undefined) {
    return 'Sin datos'
  }
  if (isBoolean.value) {
    // Custom label depending on sensor code if possible, or fallback to standard Activo/Inactivo
    const code = (props.widget.codigo_sensor || '').toLowerCase()
    if (code.includes('puerta')) {
      return props.widget.valor ? 'Abierta' : 'Cerrada'
    }
    if (code.includes('alarma') || code.includes('alerta')) {
      return props.widget.valor ? 'Activa' : 'Inactiva'
    }
    if (code.includes('relay') || code.includes('rele') || code.includes('valvula')) {
      return props.widget.valor ? 'Encendido' : 'Apagado'
    }
    return props.widget.valor ? 'Sí' : 'No'
  }
  return String(props.widget.valor)
})

const statusColorClass = computed(() => {
  if (props.widget.valor === null || props.widget.valor === undefined) {
    return 'bg-mako-100 dark:bg-mako-800 text-mako-400 border-mako-200 dark:border-mako-700'
  }
  
  if (isBoolean.value) {
    const val = props.widget.valor
    const code = (props.widget.codigo_sensor || '').toLowerCase()
    
    // For warnings like "puerta_abierta" or "alarma_activa", true is warning (red)
    if (code.includes('puerta') || code.includes('alarma') || code.includes('alerta') || code.includes('abiert')) {
      return val 
        ? 'bg-red-500/10 text-red-500 border-red-500/20' 
        : 'bg-green-500/10 text-green-500 border-green-500/20 dark:text-primary dark:bg-primary/10 dark:border-primary/20'
    }
    
    // For standard active states like relay/valve, true is active (green/primary)
    return val 
      ? 'bg-green-500/10 text-green-500 border-green-500/20 dark:text-primary dark:bg-primary/10 dark:border-primary/20' 
      : 'bg-mako-100 dark:bg-mako-800 text-mako-500 dark:text-mako-400 border-mako-200 dark:border-mako-700'
  }
  
  // For text-based status, use a generic neutral styled badge
  return 'bg-primary/10 text-primary border-primary/20'
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
  <div class="h-full w-full flex flex-col items-center justify-center p-5 bg-white/80 dark:bg-mako-800/60 backdrop-blur-xl border border-white/40 dark:border-white/5 shadow-[0_8px_25px_rgba(0,0,0,0.03)] dark:shadow-[0_8px_25px_rgba(0,0,0,0.15)] rounded-3xl transition-all duration-300 hover:border-primary/20 select-none relative">
    <div v-if="isStale" class="absolute top-3 right-3 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase">
      {{ widget.estado === 'stale' ? 'Desactualizado' : widget.estado }}
    </div>

    <!-- Título del Status -->
    <p class="text-[10px] uppercase font-bold tracking-widest text-mako-400 text-center truncate w-full px-2 mb-2">
      {{ widget.titulo || 'Estado' }}
    </p>

    <!-- Badge de Estado Destacado -->
    <span class="px-5 py-2 rounded-2xl text-lg font-bold border transition-colors shadow-sm text-center max-w-[90%] truncate" :class="statusColorClass">
      {{ displayValue }}
    </span>

    <div class="text-[9px] text-mako-400 font-medium mt-3">
      <span v-if="widget.valor === null">Sin datos</span>
      <span v-else-if="formattedTime">Medido: {{ formattedTime }}</span>
    </div>
  </div>
</template>
