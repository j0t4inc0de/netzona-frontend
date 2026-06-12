<script setup>
// imports
import { Toaster } from 'vue-sonner'
</script>

<template>
  <router-view />
  <Toaster position="top-right" richColors closeButton />
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
