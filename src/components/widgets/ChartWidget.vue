<script setup>
import { computed, ref, watch } from 'vue'
import { useMetricsStore } from '../../stores/metrics'
import { useDark } from '@vueuse/core'

const store = useMetricsStore()
const isDark = useDark()

const maxPoints = 30

const chartData = ref([
  {
    x: new Date().toLocaleTimeString('es-CL', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
    y: Number(store.power),
  },
])

const series = computed(() => [
  {
    name: 'Potencia',
    data: chartData.value,
  },
])

const chartOptions = computed(() => ({
  chart: {
    id: 'power-history-chart',
    type: 'area',
    height: '100%',
    toolbar: {
      show: false,
    },
    zoom: {
      enabled: false,
    },
    animations: {
      enabled: true,
      easing: 'linear',
      dynamicAnimation: {
        speed: 500,
      },
    },
    background: 'transparent',
    foreColor: '#9ca3af',
  },

  theme: {
    mode: isDark.value ? 'dark' : 'light',
  },

  stroke: {
    curve: 'smooth',
    width: 3,
  },

  fill: {
    type: 'gradient',
    gradient: {
      shadeIntensity: 1,
      opacityFrom: 0.35,
      opacityTo: 0.05,
      stops: [0, 90, 100],
    },
  },

  colors: [isDark.value ? '#6D92F8' : '#0C4CE4'],

  dataLabels: {
    enabled: false,
  },

  grid: {
    borderColor: 'rgba(156, 163, 175, 0.15)',
    strokeDashArray: 4,
    xaxis: {
      lines: {
        show: false,
      },
    },
  },

  xaxis: {
    type: 'category',
    labels: {
      rotate: 0,
      style: {
        fontSize: '11px',
      },
    },
    axisBorder: {
      show: false,
    },
    axisTicks: {
      show: false,
    },
  },

  yaxis: {
    labels: {
      formatter(value) {
        return `${Math.round(value)} W`
      },
      style: {
        fontSize: '11px',
      },
    },
  },

  tooltip: {
    theme: isDark.value ? 'dark' : 'light',
    y: {
      formatter(value) {
        return `${value.toFixed(1)} W`
      },
    },
  },

  markers: {
    size: 0,
  },

  legend: {
    show: false,
  },
}))

watch(
  () => store.power,
  (newPower) => {
    const point = {
      x: new Date().toLocaleTimeString('es-CL', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      y: Number(newPower),
    }

    chartData.value = [...chartData.value, point].slice(-maxPoints)
  },
)
</script>

<template>
  <div class="w-full h-full flex flex-col">
    <div class="flex justify-between w-full mb-4 items-center">
      <p class="label">Historial de Potencia</p>

      <span
        class="text-xs font-medium px-3 py-1 bg-primary/10 text-primary rounded-full border border-primary/20 shadow-[0_0_10px_rgba(0,209,94,0.1)]"
      >
        En vivo
      </span>
    </div>

    <div
      class="w-full flex-1 min-h-0 rounded-[1rem] border border-mako-300 dark:border-mako-700 bg-white/40 dark:bg-mako-800/30 transition-colors group-hover:border-primary/50 overflow-hidden relative"
    >
      <apexchart type="area" width="100%" height="100%" :options="chartOptions" :series="series" />
    </div>
  </div>
</template>
