import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './assets/css/tailwind.css'
import VueApexCharts from 'vue3-apexcharts'

import App from './App.vue'
import router from './router'
import { useAuthStore } from './stores/auth'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(VueApexCharts)

const authStore = useAuthStore(pinia)

authStore.initializeAuth().finally(() => {
  app.mount('#app')
})
