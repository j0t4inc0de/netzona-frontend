<script setup>
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
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
const isCerrosDropdownOpen = ref(true)

onMounted(async () => {
  telemetrics.fetchDataFromBackend()
  
  // Iniciar polling
  pollingInterval = setInterval(() => {
    telemetrics.updateRealtimeMetrics()
  }, 5000)

  // Esperar a que se carguen los cerros para cerrarlo si hay más de 3
  setTimeout(() => {
    if (telemetrics.cerros.length > 3 && !route.path.startsWith('/dashboard/cerro/')) {
      isCerrosDropdownOpen.value = false
    }
  }, 1000)
  
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

watch(() => route.path, (newPath) => {
  if (newPath.startsWith('/dashboard/cerro/')) {
    isCerrosDropdownOpen.value = true
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

const bgFileInput = ref(null)
const isUploadingBg = ref(false)

const handleUploadBg = async (event) => {
  const file = event.target.files[0]
  if (!file) return

  if (!['image/jpeg', 'image/jpg', 'image/webp'].includes(file.type)) {
    toast.error('Formato no permitido. Solo se acepta JPG, JPEG y WEBP.')
    event.target.value = ''
    return
  }

  if (file.size > 2 * 1024 * 1024) {
    toast.error('La imagen supera el peso máximo de 2 MB.')
    event.target.value = ''
    return
  }

  isUploadingBg.value = true
  try {
    const formData = new FormData()
    formData.append('fondo_dashboard', file)

    const res = await api('/cuentas/preferencias/', {
      method: 'PATCH',
      body: formData
    })

    if (res.ok) {
      const data = await res.json()
      if (auth.currentUser) {
        auth.currentUser.fondo_dashboard = data.fondo_dashboard
      }
      toast.success('Fondo del dashboard actualizado.')
    } else {
      const errorMsg = await res.json().catch(() => ({}))
      toast.error(errorMsg.detail || errorMsg.fondo_dashboard?.[0] || 'Error al subir la imagen. Asegúrese de que cumple con los requisitos.')
    }
  } catch (e) {
    console.error(e)
    toast.error('Error al subir el fondo del dashboard.')
  } finally {
    isUploadingBg.value = false
    if (bgFileInput.value) bgFileInput.value.value = ''
  }
}

const handleRemoveBg = async () => {
  try {
    const res = await api('/cuentas/preferencias/', {
      method: 'PATCH',
      body: JSON.stringify({ fondo_dashboard: null })
    })

    if (res.ok) {
      if (auth.currentUser) {
        auth.currentUser.fondo_dashboard = null
      }
      toast.success('Fondo sólido restaurado.')
    } else {
      toast.error('Error al quitar el fondo.')
    }
  } catch (e) {
    console.error(e)
    toast.error('Error al restaurar el fondo.')
  }
}

const mainContainerStyle = computed(() => {
  if (route.path.startsWith('/dashboard') && auth.currentUser?.fondo_dashboard) {
    return {
      backgroundImage: `url(${auth.currentUser.fondo_dashboard})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundAttachment: 'fixed',
      backgroundRepeat: 'no-repeat'
    }
  }
  return {}
})

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

const showPasswordForm = ref(false)

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

watch(isDesktopSidebarCollapsed, (collapsed) => {
  if (collapsed) {
    isCerrosDropdownOpen.value = false
  }
})


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
      class="bg-white/80 dark:bg-mako-800/60 border-r border-mako-200 dark:border-white/5 backdrop-blur-xl shrink-0 hidden md:flex flex-col sticky top-0 h-screen z-20 transition-[width,background-color,border-color] duration-300 ease-in-out"
      :class="isDesktopSidebarCollapsed ? 'w-20' : 'w-64'"
      style="will-change: width;"
    >
      <div class="min-h-[73px] py-3 flex items-center border-b border-transparent overflow-hidden px-6 relative transition-all duration-300 justify-center">
        <!-- Logo colapsado (Netzona solo) -->
        <div 
          class="absolute inset-0 flex items-center justify-center transition-all duration-300"
          :class="isDesktopSidebarCollapsed ? 'opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none'"
        >
          <img src="/netzona_logo.png" alt="Netzona Logo" class="h-8 w-auto object-contain shrink-0" />
        </div>
        <!-- Logo expandido (con/sin empresa) -->
        <div 
          class="w-full flex items-center transition-all duration-300"
          :class="isDesktopSidebarCollapsed ? 'opacity-0 scale-95 pointer-events-none translate-x-4' : 'opacity-100 scale-100 translate-x-0'"
        >
          <!-- Con Logo de Empresa -->
          <div v-if="auth.currentUser?.empresa_logo" class="w-full flex flex-col items-center py-1">
            <img :src="auth.currentUser.empresa_logo" alt="Logo Empresa" class="h-10 max-w-[85%] object-contain shrink-0" />
            <div class="flex items-center gap-1 text-[9px] font-bold text-mako-400 dark:text-mako-400 uppercase tracking-widest leading-none select-none mt-1">
              <span>Powered by</span>
              <img src="/netzona_logo.png" alt="Netzona" class="h-3.5 w-auto object-contain shrink-0" />
              <span class="text-primary font-extrabold text-[10px] tracking-normal">Netzona</span>
            </div>
          </div>
          <!-- Sin Logo de Empresa (Por defecto) -->
          <div v-else class="flex items-center">
            <img src="/netzona_logo.png" alt="Netzona Logo" class="h-8 w-auto object-contain shrink-0" />
            <span class="font-bold text-lg tracking-tight text-mako-900 dark:text-white whitespace-nowrap ml-2">
              Telemetrics
            </span>
          </div>
        </div>
      </div>

      <nav class="flex-1 p-4 space-y-2 overflow-y-auto overflow-x-hidden">
        <!-- Colapsable de Cerros (Sitios) -->
        <div>
          <button
            @click="isCerrosDropdownOpen = !isCerrosDropdownOpen"
            class="w-full flex items-center justify-between py-3 rounded-2xl transition-all duration-300 text-mako-600 dark:text-mako-300 hover:bg-mako-100 dark:hover:bg-white/5"
            :class="isDesktopSidebarCollapsed ? 'px-[14px]' : 'px-4'"
            :title="isDesktopSidebarCollapsed ? 'Cerros' : ''"
          >
            <div class="flex items-center">
              <svg class="w-5 h-5 shrink-0 transition-transform duration-300" :class="isCerrosDropdownOpen ? 'text-primary' : 'text-mako-600 dark:text-mako-300'" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m8 3 4 8 5-5 5 15H2L8 3z" />
              </svg>
              <span class="whitespace-nowrap overflow-hidden transition-all duration-300 font-semibold text-sm"
                    :class="isDesktopSidebarCollapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[200px] opacity-100 ml-3'">
                Sitios
              </span>
            </div>
            
            <svg 
              v-if="!isDesktopSidebarCollapsed"
              class="w-4 h-4 text-mako-400 transition-transform duration-300 shrink-0" 
              :class="{ 'rotate-180': isCerrosDropdownOpen }" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
            </svg>
          </button>
          
          <div 
            v-show="isCerrosDropdownOpen" 
            class="mt-1 space-y-1 transition-all duration-300"
            :class="isDesktopSidebarCollapsed ? 'pl-0' : 'pl-4'"
          >
            <router-link
              v-for="cerro in telemetrics.cerros"
              :key="cerro.id"
              :to="'/dashboard/cerro/' + cerro.id"
              class="flex items-center py-2.5 rounded-xl transition-all duration-300 text-mako-600 dark:text-mako-300 hover:bg-mako-100 dark:hover:bg-white/5"
              :class="isDesktopSidebarCollapsed ? 'px-[14px] justify-center' : 'px-4'"
              active-class="!text-primary font-bold"
              :title="isDesktopSidebarCollapsed ? cerro.name : ''"
            >
              <!-- Punto para sub-item cuando está expandido -->
              <span v-if="!isDesktopSidebarCollapsed" class="w-1.5 h-1.5 rounded-full bg-current mr-2.5 opacity-60"></span>
              
              <svg v-else class="w-4 h-4 shrink-0 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m8 3 4 8 5-5 5 15H2L8 3z" />
              </svg>
              
              <span class="whitespace-nowrap overflow-hidden text-xs transition-all duration-300"
                    :class="isDesktopSidebarCollapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[200px] opacity-100'">
                {{ cerro.name }}
              </span>
            </router-link>
          </div>
        </div>

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
          active-class="!text-primary font-semibold"
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
          to="/estructura"
          class="flex items-center py-3 rounded-2xl transition-all duration-300 text-mako-600 dark:text-mako-300 hover:bg-mako-100 dark:hover:bg-white/5"
          :class="isDesktopSidebarCollapsed ? 'px-[14px]' : 'px-4'"
          active-class="!text-primary font-semibold"
          :title="isDesktopSidebarCollapsed ? 'Estructura del Sistema' : ''"
        >
          <svg class="w-5 h-5 shrink-0 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
          </svg>
          <span class="whitespace-nowrap overflow-hidden transition-all duration-300"
                :class="isDesktopSidebarCollapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[200px] opacity-100 ml-3'">
            Estructura
          </span>
        </router-link>

        <router-link
          v-if="showTecnicoLink"
          to="/tecnico"
          class="flex items-center py-3 rounded-2xl transition-all duration-300 text-mako-600 dark:text-mako-300 hover:bg-mako-100 dark:hover:bg-white/5"
          :class="isDesktopSidebarCollapsed ? 'px-[14px]' : 'px-4'"
          active-class="!text-primary font-semibold"
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
      <div class="min-h-[73px] py-2 px-6 flex items-center justify-between border-b border-transparent">
        <div v-if="auth.currentUser?.empresa_logo" class="flex flex-col items-start gap-1 py-1">
          <img :src="auth.currentUser.empresa_logo" alt="Logo Empresa" class="h-10 max-w-[160px] object-contain shrink-0" />
          <div class="flex items-center gap-1 text-[9px] font-bold text-mako-400 dark:text-mako-400 uppercase tracking-widest leading-none select-none">
            <span>Powered by</span>
            <img src="/netzona_logo.png" alt="Netzona" class="h-3.5 w-auto object-contain shrink-0" />
            <span class="text-primary font-extrabold text-[10px] tracking-normal">Netzona</span>
          </div>
        </div>
        <div v-else class="flex items-center gap-2">
          <img src="/netzona_logo.png" alt="Netzona Logo" class="h-8 w-auto object-contain shrink-0" />
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

      <nav class="flex-1 p-4 space-y-2 overflow-y-auto">
        <!-- Colapsable de Cerros (Sitios) -->
        <div>
          <button
            @click="isCerrosDropdownOpen = !isCerrosDropdownOpen"
            class="w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-all duration-200 text-mako-600 dark:text-mako-300 hover:bg-mako-100 dark:hover:bg-white/5"
          >
            <div class="flex items-center gap-3">
              <svg class="w-5 h-5 shrink-0 transition-transform duration-300" :class="isCerrosDropdownOpen ? 'text-primary' : 'text-mako-600 dark:text-mako-300'" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m8 3 4 8 5-5 5 15H2L8 3z" />
              </svg>
              <span class="font-semibold text-sm">Sitios</span>
            </div>
            <svg
              class="w-4 h-4 text-mako-400 transition-transform duration-300"
              :class="{ 'rotate-180': isCerrosDropdownOpen }"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
            </svg>
          </button>
          
          <!-- Lista de Cerros colapsable -->
          <div v-show="isCerrosDropdownOpen" class="pl-4 mt-1 space-y-1">
            <router-link
              v-for="cerro in telemetrics.cerros"
              :key="cerro.id"
              :to="'/dashboard/cerro/' + cerro.id"
              @click="isSidebarOpen = false"
              class="flex items-center py-2.5 px-4 rounded-xl transition-all duration-200 text-mako-600 dark:text-mako-300 hover:bg-mako-100 dark:hover:bg-white/5 text-xs"
              active-class="!text-primary font-bold"
            >
              <span class="w-1.5 h-1.5 rounded-full bg-current mr-2.5 opacity-60"></span>
              {{ cerro.name }}
            </router-link>
          </div>
        </div>

        <div v-if="showAdminLink || showTecnicoLink" class="pt-4 pb-2 px-4">
          <span class="text-xs font-bold uppercase tracking-wider text-mako-400">Gestión</span>
        </div>

        <router-link
          v-if="showAdminLink"
          to="/admin"
          @click="isSidebarOpen = false"
          class="flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 text-mako-600 dark:text-mako-300 hover:bg-mako-100 dark:hover:bg-white/5"
          active-class="!text-primary font-semibold"
        >
          Administrar Personal
        </router-link>

        <router-link
          v-if="showTecnicoLink"
          to="/estructura"
          @click="isSidebarOpen = false"
          class="flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 text-mako-600 dark:text-mako-300 hover:bg-mako-100 dark:hover:bg-white/5"
          active-class="!text-primary font-semibold"
        >
          Estructura
        </router-link>

        <router-link
          v-if="showTecnicoLink"
          to="/tecnico"
          @click="isSidebarOpen = false"
          class="flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 text-mako-600 dark:text-mako-300 hover:bg-mako-100 dark:hover:bg-white/5"
          active-class="!text-primary font-semibold"
        >
          Dispositivos
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
        class="sticky top-0 z-30 px-6 py-4 border-b border-mako-200 dark:border-white/5 backdrop-blur-xl bg-white/80 dark:bg-mako-800/60 flex justify-between items-center transition-colors duration-300"
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
            <template v-if="auth.currentUser?.empresa_logo">
              <img :src="auth.currentUser.empresa_logo" alt="Logo Empresa" class="h-8 w-auto object-contain md:hidden" />
            </template>
            <template v-else>
              <img src="/netzona_logo.png" alt="Netzona Logo" class="h-8 w-auto object-contain md:hidden" />
              <span class="font-bold text-lg tracking-tight md:hidden">Telemetrics</span>
            </template>
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

      <main class="flex-1 p-6 relative" :style="mainContainerStyle">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" :key="route.fullPath + reloadKey" />
          </transition>
        </router-view>
      </main>
    </div>

    <!-- Modal de Configuración -->
    <div v-if="showSettings" class="fixed inset-0 bg-mako-950/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div class="bg-white dark:bg-mako-900 border border-mako-200 dark:border-white/5 rounded-3xl shadow-2xl w-full max-w-md p-6 relative">
        <button @click="showSettings = false" class="absolute top-5 right-5 p-2 rounded-full text-mako-400 hover:text-mako-900 hover:bg-mako-100 dark:hover:bg-white/10 transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
        
        <h2 class="text-xl font-semibold mb-6 text-mako-900 dark:text-white">Ajustes</h2>

        <div class="space-y-4 divide-y divide-mako-100 dark:divide-white/5">
          <!-- Seguridad (Collapsible) -->
          <div class="pt-2">
            <button @click="showPasswordForm = !showPasswordForm" class="w-full flex items-center justify-between outline-none group">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full bg-mako-100 dark:bg-white/5 flex items-center justify-center text-mako-600 dark:text-mako-300">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                </div>
                <div class="text-left">
                  <h3 class="font-medium text-sm text-mako-800 dark:text-mako-100 group-hover:text-primary transition-colors">Seguridad</h3>
                  <p class="text-[11px] text-mako-500">Actualiza tu contraseña de acceso</p>
                </div>
              </div>
              <svg class="w-4 h-4 text-mako-400 transition-transform duration-300" :class="{ 'rotate-180': showPasswordForm }" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
            </button>
            
            <div v-show="showPasswordForm" class="mt-4 animate-fade-in">
              <form @submit.prevent="handleChangePassword" class="space-y-2">
                <input
                  v-model="passwordActual"
                  type="password"
                  placeholder="Contraseña actual"
                  class="w-full px-4 py-2 text-xs rounded-xl bg-mako-50 dark:bg-mako-950/50 border border-transparent focus:border-primary focus:bg-white dark:focus:bg-mako-900 outline-none transition-all text-mako-900 dark:text-white placeholder-mako-400"
                  required
                />
                <input
                  v-model="passwordNueva"
                  type="password"
                  placeholder="Nueva contraseña"
                  class="w-full px-4 py-2 text-xs rounded-xl bg-mako-50 dark:bg-mako-950/50 border border-transparent focus:border-primary focus:bg-white dark:focus:bg-mako-900 outline-none transition-all text-mako-900 dark:text-white placeholder-mako-400"
                  required
                />
                <input
                  v-model="passwordNuevaConfirmacion"
                  type="password"
                  placeholder="Confirmar nueva contraseña"
                  class="w-full px-4 py-2 text-xs rounded-xl bg-mako-50 dark:bg-mako-950/50 border border-transparent focus:border-primary focus:bg-white dark:focus:bg-mako-900 outline-none transition-all text-mako-900 dark:text-white placeholder-mako-400"
                  required
                />

                <div v-if="changePasswordError || changePasswordSuccess" class="pt-1">
                  <p v-if="changePasswordError" class="text-red-500 text-[11px] font-medium text-center">
                    {{ changePasswordError }}
                  </p>
                  <p v-if="changePasswordSuccess" class="text-green-500 text-[11px] font-medium text-center">
                    {{ changePasswordSuccess }}
                  </p>
                </div>

                <div class="flex justify-end pt-2">
                  <button
                    type="submit"
                    :disabled="isChangingPassword"
                    class="px-4 py-2 bg-primary hover:bg-primary/90 text-white font-semibold text-[11px] rounded-xl shadow-md shadow-primary/20 transition-all disabled:opacity-50"
                  >
                    {{ isChangingPassword ? 'Guardando...' : 'Cambiar contraseña' }}
                  </button>
                </div>
              </form>
            </div>
          </div>

          <!-- Tema -->
          <div class="flex items-center justify-between pt-4">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <svg v-if="!isDark" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>
              </div>
              <div>
                <h3 class="font-medium text-sm text-mako-800 dark:text-mako-100">Apariencia</h3>
                <p class="text-[11px] text-mako-500">Tema actual: {{ isDark ? 'Oscuro' : 'Claro' }}</p>
              </div>
            </div>
            <button
              @click="toggleDark"
              class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 outline-none"
              :class="isDark ? 'bg-primary' : 'bg-mako-300 dark:bg-mako-700'"
            >
              <span class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300" :class="isDark ? 'translate-x-6' : 'translate-x-1'"></span>
            </button>
          </div>

          <!-- Fondo de Dashboard -->
          <div class="pt-4">
            <div class="flex flex-col gap-2">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                  </div>
                  <div>
                    <h3 class="font-medium text-sm text-mako-800 dark:text-mako-100">Fondo de Dashboard</h3>
                    <p class="text-[11px] text-mako-500">Tema personalizado (máx 2MB)</p>
                  </div>
                </div>
                
                <div class="flex items-center gap-2">
                  <button v-if="auth.currentUser?.fondo_dashboard" @click="handleRemoveBg" class="text-xs font-semibold text-red-500 hover:underline">Quitar</button>
                  <label class="cursor-pointer px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary font-bold text-[11px] rounded-xl transition-all">
                    <span>{{ isUploadingBg ? 'Subiendo...' : 'Subir' }}</span>
                    <input ref="bgFileInput" type="file" @change="handleUploadBg" accept="image/jpeg, image/jpg, image/webp" class="hidden" :disabled="isUploadingBg" />
                  </label>
                </div>
              </div>
              <div v-if="auth.currentUser?.fondo_dashboard" class="ml-11">
                <img :src="auth.currentUser.fondo_dashboard" alt="Vista previa del fondo" class="h-12 w-24 rounded-lg object-cover border border-mako-200 dark:border-mako-700" />
              </div>
            </div>
          </div>

          <!-- Restablecer Layout -->
          <div class="pt-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 shrink-0">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                </div>
                <div>
                  <h3 class="font-medium text-sm text-mako-800 dark:text-mako-100">Restaurar Diseño</h3>
                  <p class="text-[11px] text-mako-500 max-w-[180px]">Devuelve las tarjetas a su estado inicial.</p>
                </div>
              </div>
              
              <button @click="resetLayouts" :disabled="isResetting" class="px-4 py-2 bg-mako-100 hover:bg-red-500 dark:bg-white/5 dark:hover:bg-red-500 hover:text-white text-mako-700 dark:text-mako-300 font-medium text-[11px] rounded-xl transition-colors flex items-center gap-1.5 disabled:opacity-50">
                <svg v-if="isResetting" class="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Restaurar
              </button>
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
