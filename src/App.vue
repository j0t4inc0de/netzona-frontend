<script setup>
import { onMounted, onUnmounted } from 'vue'
import { startMockService, stopMockService } from './services/mockService'

onMounted(() => {
  // Inicializa el generador de simulación de datos en tiempo real de Telemetrics
  startMockService()
})

onUnmounted(() => {
  stopMockService()
})
</script>

<template>
  <!-- Router shell principal de la aplicación -->
  <router-view />
</template>

<style lang="postcss">
/* Animaciones de View Transitions para cambios fluidos de página */
::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: 400ms;
  animation-timing-function: ease-in-out;
}

::view-transition-old(root) {
  animation-name: fade-out;
}

::view-transition-new(root) {
  animation-name: fade-in;
}

@keyframes fade-out {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}

@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
</style>
