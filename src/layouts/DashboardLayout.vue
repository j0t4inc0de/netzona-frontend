<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useTelemetricsStore } from '../stores/telemetrics'
import { useDark, useToggle } from '@vueuse/core'
import { toast } from 'vue-sonner'

const auth = useAuthStore()
const telemetrics = useTelemetricsStore()
const router = useRouter()
const route = useRoute()
const isDark = useDark()
const toggleDarkBase = useToggle(isDark)

import { api } from '../services/api'

let pollingInterval = null

onMounted(async () => {
  telemetrics.fetchDataFromBackend()
  
  // Iniciar polling
  pollingInterval = setInterval(() => {
    telemetrics.updateRealtimeMetrics()
  }, 5000)

  
  // Cargar preferencia del tema desde el backend
  try {
    const res = await api('/cuentas/preferencias/')
    if (res.ok) {
      const pref = await res.json()
      if (typeof pref.tema_oscuro === 'boolean') {
        isDark.value = pref.tema_oscuro
      }
    }
  } catch {
    console.warn('Backend API missing or failed, using local dark mode preference')
  }
})

onUnmounted(() => {
  if (pollingInterval) clearInterval(pollingInterval)
})

const toggleDark = () => {
  const switchTheme = () => {
    toggleDarkBase()
    // Guardar preferencia en el backend
    try {
      api('/cuentas/preferencias/', {
        method: 'PUT',
        body: JSON.stringify({ tema_oscuro: isDark.value })
      })
    } catch {
      // Fallback silencioso si el backend no está listo
    }
  }

  if (!document.startViewTransition) {
    switchTheme()
    return
  }

  document.startViewTransition(() => {
    switchTheme()
  })
}

const logout = () => {
  auth.logout()
  router.push('/login')
}

// Configuración (Modal)
const showSettings = ref(false)
const reloadKey = ref(0)
const showConfirmReset = ref(false)
const isResetting = ref(false)

const passwordActual = ref('')
const passwordNueva = ref('')
const passwordNuevaConfirmacion = ref('')
const isChangingPassword = ref(false)
const changePasswordError = ref('')
const changePasswordSuccess = ref('')

const handleChangePassword = async () => {
  changePasswordError.value = ''
  changePasswordSuccess.value = ''

  if (!passwordActual.value || !passwordNueva.value || !passwordNuevaConfirmacion.value) {
    changePasswordError.value = 'Complete todos los campos.'
    return
  }

  if (passwordNueva.value !== passwordNuevaConfirmacion.value) {
    changePasswordError.value = 'Las nuevas contraseñas no coinciden.'
    return
  }

  isChangingPassword.value = true
  try {
    const res = await api('/cuentas/password/cambiar/', {
      method: 'POST',
      body: JSON.stringify({
        password_actual: passwordActual.value,
        password_nueva: passwordNueva.value,
        password_nueva_confirmacion: passwordNuevaConfirmacion.value
      })
    })

    if (res.ok) {
      changePasswordSuccess.value = 'Contraseña actualizada correctamente.'
      toast.success('Contraseña cambiada con éxito')
      passwordActual.value = ''
      passwordNueva.value = ''
      passwordNuevaConfirmacion.value = ''
    } else {
      const errorData = await res.json().catch(() => ({}))
      changePasswordError.value = errorData.password_nueva?.[0] || errorData.password_actual?.[0] || errorData.detail || 'Error al cambiar la contraseña.'
    }
  } catch {
    changePasswordError.value = 'Error de conexión al cambiar la contraseña.'
  } finally {
    isChangingPassword.value = false
  }
}

const triggerResetConfirmation = () => {
  showConfirmReset.value = true
}

const resetLayouts = async () => {
  if (isResetting.value) return
  isResetting.value = true
  
  // Guardar estado de reseteo para evitar que las vistas guarden posiciones incorrectas
  localStorage.setItem('is_resetting_layout', 'true')
  
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3000)
    
    await api('/cuentas/preferencias/', { 
      method: 'DELETE',
      signal: controller.signal
    })
    clearTimeout(timeoutId)
  } catch (error) {
    console.warn("Backend no disponible o error al reiniciar preferencias:", error)
  } finally {
    // Limpiar layouts estáticos guardados localmente
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('grid_static_')) {
        localStorage.removeItem(key)
      }
    })

    toast.success('Diseño restaurado por defecto exitosamente')
    showConfirmReset.value = false
    showSettings.value = false
    reloadKey.value += 1
    
    setTimeout(() => {
      isResetting.value = false
      localStorage.removeItem('is_resetting_layout')
    }, 1000)
  }
}

// Control del menú lateral en móviles
const isSidebarOpen = ref(false)
const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value
}

// Control del menú lateral en escritorio
const isDesktopSidebarCollapsed = ref(false)
const toggleDesktopSidebar = () => {
  isDesktopSidebarCollapsed.value = !isDesktopSidebarCollapsed.value
}


// Los Cerros se listan iterando telemetrics.cerros


const showAdminLink = computed(() => auth.userRole === 'admin' || auth.userRole === 'tecnico')
const showTecnicoLink = computed(() => auth.userRole === 'tecnico')
</script>

<template>
  <div
    class="min-h-screen bg-mako-50 dark:bg-mako-900 text-mako-900 dark:text-white font-sans transition-colors duration-300 flex"
  >
    <!-- Fondo dinámico difuminado -->
    <div class="fixed inset-0 overflow-hidden pointer-events-none z-0">
      <div
        class="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] rounded-full bg-primary/10 dark:bg-primary/5 blur-[120px]"
      ></div>
      <div
        class="absolute top-[30%] -right-[10%] w-[40%] h-[40%] rounded-full bg-primary/10 dark:bg-primary/5 blur-[120px]"
      ></div>
    </div>

    <!-- SIDEBAR (Escritorio) -->
    <aside
      class="bg-white/80 dark:bg-mako-900/60 border-r border-mako-200 dark:border-white/5 backdrop-blur-xl shrink-0 hidden md:flex flex-col sticky top-0 h-screen z-20 transition-all duration-300"
      :class="isDesktopSidebarCollapsed ? 'w-20' : 'w-64'"
    >
      <div class="h-[73px] flex items-center border-b border-transparent overflow-hidden transition-all duration-300" :class="isDesktopSidebarCollapsed ? 'px-[24px]' : 'px-6'">
        <div class="flex items-center">
          <img src="/netzona_logo.png" alt="Netzona Logo" class="h-8 w-auto object-contain shrink-0" />
          <span class="font-bold text-lg tracking-tight text-mako-900 dark:text-white whitespace-nowrap overflow-hidden transition-all duration-300"
                :class="isDesktopSidebarCollapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[150px] opacity-100 ml-2'">
            Telemetrics
          </span>
        </div>
      </div>

      <nav class="flex-1 p-4 space-y-2 overflow-y-auto overflow-x-hidden">
        <router-link
          v-for="cerro in telemetrics.cerros"
          :key="cerro.id"
          :to="'/dashboard/cerro/' + cerro.id"
          class="flex items-center py-3 rounded-2xl transition-all duration-300 text-mako-600 dark:text-mako-300 hover:bg-mako-100 dark:hover:bg-white/5"
          :class="isDesktopSidebarCollapsed ? 'px-[14px]' : 'px-4'"
          active-class="!bg-primary/10 !text-primary font-semibold ring-1 ring-primary/20 dark:ring-primary/40 shadow-sm"
          :title="isDesktopSidebarCollapsed ? cerro.name : ''"
        >
          <svg class="w-5 h-5 shrink-0 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m8 3 4 8 5-5 5 15H2L8 3z" />
          </svg>
          <span class="whitespace-nowrap overflow-hidden transition-all duration-300"
                :class="isDesktopSidebarCollapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[200px] opacity-100 ml-3'">
            {{ cerro.name }}
          </span>
        </router-link>

        <div v-if="showAdminLink || showTecnicoLink" class="pt-4 pb-2 relative flex items-center h-10 transition-all duration-300" :class="isDesktopSidebarCollapsed ? 'justify-center' : 'px-4'">
          <span class="text-xs font-bold uppercase tracking-wider text-mako-400 whitespace-nowrap overflow-hidden transition-all duration-300"
                :class="isDesktopSidebarCollapsed ? 'max-w-0 opacity-0' : 'max-w-[200px] opacity-100'">Gestión</span>
          <span class="text-xs font-bold uppercase tracking-wider text-mako-400 absolute transition-all duration-300"
                :class="isDesktopSidebarCollapsed ? 'opacity-100 scale-100' : 'opacity-0 scale-50 pointer-events-none'">•••</span>
        </div>

        <router-link
          v-if="showAdminLink"
          to="/admin"
          class="flex items-center py-3 rounded-2xl transition-all duration-300 text-mako-600 dark:text-mako-300 hover:bg-mako-100 dark:hover:bg-white/5"
          :class="isDesktopSidebarCollapsed ? 'px-[14px]' : 'px-4'"
          active-class="!bg-primary/10 !text-primary font-semibold ring-1 ring-primary/20 dark:ring-primary/40 shadow-sm"
          :title="isDesktopSidebarCollapsed ? 'Cuentas y Usuarios' : ''"
        >
          <svg class="w-5 h-5 shrink-0 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <span class="whitespace-nowrap overflow-hidden transition-all duration-300"
                :class="isDesktopSidebarCollapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[200px] opacity-100 ml-3'">
            Usuarios
          </span>
        </router-link>

        <router-link
          v-if="showTecnicoLink"
          to="/tecnico"
          class="flex items-center py-3 rounded-2xl transition-all duration-300 text-mako-600 dark:text-mako-300 hover:bg-mako-100 dark:hover:bg-white/5"
          :class="isDesktopSidebarCollapsed ? 'px-[14px]' : 'px-4'"
          active-class="!bg-primary/10 !text-primary font-semibold ring-1 ring-primary/20 dark:ring-primary/40 shadow-sm"
          :title="isDesktopSidebarCollapsed ? 'Gestión de Dispositivos' : ''"
        >
          <svg class="w-5 h-5 shrink-0 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
          </svg>
          <span class="whitespace-nowrap overflow-hidden transition-all duration-300"
                :class="isDesktopSidebarCollapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[200px] opacity-100 ml-3'">
            Dispositivos
          </span>
        </router-link>
      </nav>

      <!-- Panel inferior de perfil en sidebar -->
      <div class="border-t border-mako-200 dark:border-white/5 space-y-3 transition-all duration-300 py-4" :class="isDesktopSidebarCollapsed ? 'px-[20px]' : 'px-4'">
        <div class="flex items-center transition-all duration-300">
          <div class="w-10 h-10 shrink-0 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center font-bold text-primary transition-all duration-300">
            {{ auth.currentUser?.name.charAt(0) }}
          </div>
          <div class="overflow-hidden transition-all duration-300"
               :class="isDesktopSidebarCollapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[150px] opacity-100 ml-3'">
            <h4 class="text-sm font-semibold truncate leading-tight">{{ auth.currentUser?.name }}</h4>
            <span class="text-xs text-mako-400">
              {{ auth.currentUser?.role === 'tecnico' ? 'Admin Netzona' : auth.currentUser?.role === 'admin' ? 'Administrador' : 'Trabajador' }}
            </span>
          </div>
        </div>
        <button
          @click="logout"
          class="w-full flex items-center py-2 border border-red-500/30 hover:border-red-500 bg-red-500/5 hover:bg-red-500/20 text-red-500 rounded-xl text-sm font-medium transition-all duration-300 overflow-hidden"
          :class="isDesktopSidebarCollapsed ? 'px-[10px]' : 'px-4'"
          :title="isDesktopSidebarCollapsed ? 'Cerrar Sesión' : ''"
        >
          <svg class="w-5 h-5 shrink-0 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span class="whitespace-nowrap overflow-hidden transition-all duration-300"
                :class="isDesktopSidebarCollapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[150px] opacity-100 ml-2'">
            Cerrar Sesión
          </span>
        </button>
      </div>
    </aside>

    <!-- MOBILE SIDEBAR / DRAWER -->
    <div
      v-if="isSidebarOpen"
      class="fixed inset-0 bg-mako-950/40 backdrop-blur-sm z-40 md:hidden"
      @click="toggleSidebar"
    ></div>

    <aside
      class="fixed top-0 bottom-0 left-0 w-64 bg-white/95 dark:bg-mako-900/95 backdrop-blur-xl border-r border-mako-200 dark:border-white/5 z-50 transition-transform duration-300 md:hidden flex flex-col shadow-2xl"
      :class="isSidebarOpen ? 'translate-x-0' : '-translate-x-full'"
    >
      <div class="h-[73px] px-6 flex items-center justify-between border-b border-transparent">
        <div class="flex items-center gap-2">
          <img src="/netzona_logo.png" alt="Netzona Logo" class="h-8 w-auto object-contain" />
          <span class="font-bold text-lg tracking-tight text-mako-900 dark:text-white"
            >Telemetrics</span
          >
        </div>
        <button
          @click="toggleSidebar"
          class="p-1 rounded-lg hover:bg-mako-100 dark:hover:bg-white/5"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <nav class="flex-1 p-4 space-y-2 overflow-y-auto" @click="isSidebarOpen = false">
        <!-- Dynamic Cerros -->
        <router-link
          v-for="cerro in telemetrics.cerros"
          :key="cerro.id"
          :to="'/dashboard/cerro/' + cerro.id"
          class="flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 text-mako-600 dark:text-mako-300 hover:bg-mako-100 dark:hover:bg-white/5"
          active-class="!bg-primary/10 !text-primary font-semibold ring-1 ring-primary/20 dark:ring-primary/40 shadow-sm"
        >
          <svg class="w-5 h-5 shrink-0 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m8 3 4 8 5-5 5 15H2L8 3z" />
          </svg>
          {{ cerro.name }}
        </router-link>

        <div v-if="showAdminLink || showTecnicoLink" class="pt-4 pb-2 px-4">
          <span class="text-xs font-bold uppercase tracking-wider text-mako-400">Gestión</span>
        </div>

        <router-link
          v-if="showAdminLink"
          to="/admin"
          class="flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 text-mako-600 dark:text-mako-300 hover:bg-mako-100 dark:hover:bg-white/5"
          active-class="!bg-primary/10 !text-primary font-semibold ring-1 ring-primary/20 dark:ring-primary/40 shadow-sm"
        >
          Administrar Personal
        </router-link>

        <router-link
          v-if="showTecnicoLink"
          to="/tecnico"
          class="flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 text-mako-600 dark:text-mako-300 hover:bg-mako-100 dark:hover:bg-white/5"
          active-class="!bg-primary/10 !text-primary font-semibold ring-1 ring-primary/20 dark:ring-primary/40 shadow-sm"
        >
          Instalación de Nodos
        </router-link>
      </nav>

      <div class="p-4 border-t border-mako-200 dark:border-white/5 space-y-3">
        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center font-bold text-primary"
          >
            {{ auth.currentUser?.name.charAt(0) }}
          </div>
          <div class="truncate">
            <h4 class="text-sm font-semibold truncate leading-tight">
              {{ auth.currentUser?.name }}
            </h4>
            <span class="text-xs text-mako-400 capitalize">{{ auth.currentUser?.role }}</span>
          </div>
        </div>
        <button
          @click="logout"
          class="w-full flex items-center justify-center gap-2 px-4 py-2 border border-red-500/30 hover:border-red-500 bg-red-500/5 hover:bg-red-500/20 text-red-500 rounded-xl text-sm font-medium transition-all duration-200"
        >
          Cerrar Sesión
        </button>
      </div>
    </aside>

    <!-- CONTENT WRAPPER -->
    <div class="flex-1 flex flex-col min-w-0 relative z-10 overflow-x-hidden">
      <!-- HEADER -->
      <header
        class="sticky top-0 z-30 px-6 py-4 border-b border-mako-200 dark:border-white/5 backdrop-blur-xl bg-white/80 dark:bg-mako-900/60 flex justify-between items-center transition-colors duration-300"
      >
        <div class="flex items-center gap-4">
          <button
            @click="toggleSidebar"
            class="p-2 -ml-2 rounded-lg hover:bg-mako-100 dark:hover:bg-white/5 md:hidden"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <button
            @click="toggleDesktopSidebar"
            class="p-2 -ml-2 rounded-lg hover:bg-mako-100 dark:hover:bg-white/5 hidden md:block text-mako-800 dark:text-mako-200 transition-colors"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div class="flex items-center gap-2">
            <img
              src="/netzona_logo.png"
              alt="Netzona Logo"
              class="h-8 w-auto object-contain md:hidden"
            />
            <span class="font-bold text-lg tracking-tight md:hidden">Telemetrics</span>
          </div>
        </div>

        <div class="flex items-center gap-4">
          <!-- Toggle Dark Mode -->
          <button
            @click="toggleDark"
            class="theme-toggle hover:bg-mako-200 dark:hover:bg-white/10 p-2 rounded-full transition-colors flex items-center justify-center text-mako-800 dark:text-mako-200"
          >
            <svg v-if="isDark" class="w-6 h-6" viewBox="0 0 16 16" fill="currentColor">
              <path d="M7 3V0H9V3H7Z" />
              <path d="M9 13V16H7V13H9Z" />
              <path
                d="M11 8C11 9.65685 9.65685 11 8 11C6.34315 11 5 9.65685 5 8C5 6.34315 6.34315 5 8 5C9.65685 5 11 6.34315 11 8Z"
              />
              <path d="M0 9H3V7H0V9Z" />
              <path d="M16 7H13V9H16V7Z" />
              <path
                d="M3.75735 5.17157L1.63603 3.05025L3.05025 1.63603L5.17157 3.75735L3.75735 5.17157Z"
              />
              <path
                d="M12.2426 10.8284L14.364 12.9497L12.9497 14.364L10.8284 12.2426L12.2426 10.8284Z"
              />
              <path
                d="M3.05025 14.364L5.17157 12.2426L3.75735 10.8284L1.63603 12.9498L3.05025 14.364Z"
              />
              <path
                d="M12.9497 1.63604L10.8284 3.75736L12.2426 5.17158L14.364 3.05026L12.9497 1.63604Z"
              />
            </svg>

            <svg v-else class="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path
                fill-rule="evenodd"
                clip-rule="evenodd"
                d="M8.23129 2.24048C9.24338 1.78695 10.1202 2.81145 9.80357 3.70098C8.72924 6.71928 9.38932 10.1474 11.6193 12.3765C13.8606 14.617 17.3114 15.2755 20.3395 14.1819C21.2206 13.8637 22.2173 14.7319 21.7817 15.7199C21.7688 15.7491 21.7558 15.7782 21.7427 15.8074C20.9674 17.5266 19.7272 19.1434 18.1227 20.2274C16.4125 21.3828 14.3957 22.0001 12.3316 22.0001H12.3306C9.93035 21.9975 7.6057 21.1603 5.75517 19.6321C3.90463 18.1039 2.64345 15.9797 2.18793 13.6237C1.73241 11.2677 2.11094 8.82672 3.2586 6.71917C4.34658 4.72121 6.17608 3.16858 8.20153 2.25386L8.23129 2.24048Z"
              />
            </svg>
          </button>

          <!-- Settings Button -->
          <button
            @click="showSettings = true"
            class="hover:bg-mako-200 dark:hover:bg-white/10 p-2 rounded-full transition-colors flex items-center justify-center text-mako-800 dark:text-mako-200"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
            </svg>
          </button>
        </div>
      </header>

      <main class="flex-1 p-6 relative">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" :key="route.fullPath + reloadKey" />
          </transition>
        </router-view>
      </main>
    </div>

    <!-- Modal de Configuración -->
    <div v-if="showSettings" class="fixed inset-0 bg-mako-950/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div class="bg-white/95 dark:bg-mako-900/95 border border-mako-200 dark:border-white/10 rounded-[2rem] shadow-2xl w-full max-w-md p-6 relative">
        <button @click="showSettings = false" class="absolute top-4 right-4 p-2 rounded-full hover:bg-mako-100 dark:hover:bg-white/10">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
        
        <h2 class="text-xl font-bold mb-6 flex items-center gap-2">
          <svg class="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
          Configuraciones
        </h2>

        <div class="space-y-6">
          <!-- Tema -->
          <div class="flex items-center justify-between p-4 bg-mako-50 dark:bg-mako-800/40 rounded-2xl border border-mako-200 dark:border-white/5">
            <div>
              <h3 class="font-bold text-sm">Apariencia</h3>
              <p class="text-xs text-mako-500 mt-0.5">Alternar modo claro u oscuro</p>
            </div>
            <button
              @click="toggleDark"
              class="relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-300 outline-none"
              :class="isDark ? 'bg-primary' : 'bg-mako-300'"
            >
              <span class="inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-300" :class="isDark ? 'translate-x-6' : 'translate-x-1'"></span>
            </button>
          </div>
 
          <!-- Cambiar Contraseña -->
          <div class="p-4 bg-mako-50 dark:bg-mako-800/40 rounded-2xl border border-mako-200 dark:border-white/5">
            <h3 class="font-bold text-sm mb-3">Cambiar Contraseña</h3>
            <form @submit.prevent="handleChangePassword" class="space-y-3">
              <div>
                <input
                  v-model="passwordActual"
                  type="password"
                  placeholder="Contraseña actual"
                  class="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-mako-900 border border-mako-300 dark:border-mako-700 outline-none focus:border-primary text-mako-900 dark:text-white"
                  required
                />
              </div>
              <div class="grid grid-cols-2 gap-2">
                <input
                  v-model="passwordNueva"
                  type="password"
                  placeholder="Nueva contraseña"
                  class="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-mako-900 border border-mako-300 dark:border-mako-700 outline-none focus:border-primary text-mako-900 dark:text-white"
                  required
                />
                <input
                  v-model="passwordNuevaConfirmacion"
                  type="password"
                  placeholder="Confirmar nueva"
                  class="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-mako-900 border border-mako-300 dark:border-mako-700 outline-none focus:border-primary text-mako-900 dark:text-white"
                  required
                />
              </div>

              <p v-if="changePasswordError" class="text-red-500 text-[10px] font-semibold text-center bg-red-500/10 border border-red-500/20 py-1 rounded-lg">
                {{ changePasswordError }}
              </p>
              <p v-if="changePasswordSuccess" class="text-green-600 dark:text-green-400 text-[10px] font-semibold text-center bg-green-500/10 border border-green-500/20 py-1 rounded-lg">
                {{ changePasswordSuccess }}
              </p>

              <button
                type="submit"
                :disabled="isChangingPassword"
                class="w-full py-2 bg-primary hover:bg-primary/95 text-white font-bold text-xs rounded-xl transition-all shadow-md disabled:opacity-50"
              >
                {{ isChangingPassword ? 'Actualizando...' : 'Actualizar contraseña' }}
              </button>
            </form>
          </div>

          <!-- Restablecer Layout -->
          <div class="p-4 bg-red-500/5 rounded-2xl border border-red-500/20 transition-all duration-300">
            <div v-if="!showConfirmReset">
              <div>
                <h3 class="font-bold text-sm text-red-500">Restaurar Diseño (GridStack)</h3>
                <p class="text-xs text-mako-500 dark:text-mako-400 mt-1 mb-3">Si alguna vez desordenaste tus tarjetas, presiona este botón para devolverlas a su posición original de fábrica.</p>
              </div>
              <button @click="triggerResetConfirmation" class="w-full py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 font-bold text-xs rounded-xl border border-red-500/30 transition-colors">
                Restaurar todas las tarjetas
              </button>
            </div>
            
            <div v-else class="text-center space-y-3 animate-pulse">
              <div>
                <h3 class="font-bold text-sm text-red-500">¿Estás seguro?</h3>
                <p class="text-xs text-mako-500 dark:text-mako-400 mt-1">Se perderán las posiciones personalizadas de todo el sistema. Esta acción no se puede deshacer.</p>
              </div>
              <div class="flex gap-2 justify-center mt-3">
                <button @click="showConfirmReset = false" class="px-4 py-2 text-xs font-bold bg-mako-200 dark:bg-mako-700 text-mako-700 dark:text-mako-200 rounded-xl hover:bg-mako-300 dark:hover:bg-mako-600 transition-colors">
                  Cancelar
                </button>
                <button @click="resetLayouts" :disabled="isResetting" class="px-4 py-2 text-xs font-bold bg-red-500 hover:bg-red-600 text-white rounded-xl shadow-lg shadow-red-500/30 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                  <svg v-if="isResetting" class="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {{ isResetting ? 'Restaurando...' : 'Sí, restaurar' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
