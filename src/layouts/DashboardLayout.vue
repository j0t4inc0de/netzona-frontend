<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useDark, useToggle } from '@vueuse/core'

const auth = useAuthStore()
const router = useRouter()
const isDark = useDark()
const toggleDarkBase = useToggle(isDark)

const toggleDark = () => {
  if (!document.startViewTransition) {
    toggleDarkBase()
    return
  }

  document.startViewTransition(() => {
    toggleDarkBase()
  })
}

const logout = () => {
  auth.logout()
  router.push('/login')
}

// Control del menú lateral en móviles
const isSidebarOpen = ref(false)
const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value
}

// Filtro de links visibles según rol/permisos
const showAgroLink = computed(() => {
  if (auth.userRole === 'tecnico' || auth.userRole === 'admin') return true
  // Si es trabajador, debe tener al menos un predio permitido
  return auth.accessibleItems.some((id) => id.startsWith('predio'))
})

const showRadioLink = computed(() => {
  if (auth.userRole === 'tecnico' || auth.userRole === 'admin') return true
  // Si es trabajador, debe tener al menos un cerro permitido
  return auth.accessibleItems.some((id) => id.startsWith('cerro'))
})

const showAdminLink = computed(() => auth.userRole === 'admin')
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
      class="w-64 bg-white/80 dark:bg-mako-950/60 border-r border-white/20 dark:border-white/5 backdrop-blur-xl shrink-0 hidden md:flex flex-col relative z-20 transition-colors duration-300"
    >
      <div class="p-6 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <img src="/netzona_logo.png" alt="Netzona Logo" class="h-10 w-auto object-contain" />
          <span class="font-bold text-xl tracking-tight text-mako-900 dark:text-white"
            >Telemetrics</span
          >
        </div>
      </div>

      <nav class="flex-1 p-4 space-y-2 overflow-y-auto">
        <router-link
          v-if="showAgroLink"
          to="/dashboard/agricola"
          class="flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 text-mako-600 dark:text-mako-300 hover:bg-mako-100 dark:hover:bg-white/5"
          active-class="!bg-primary/15 !text-primary font-semibold shadow-inner border border-primary/20"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707-.707M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Área Agrícola
        </router-link>

        <router-link
          v-if="showRadioLink"
          to="/dashboard/radiocomunicaciones"
          class="flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 text-mako-600 dark:text-mako-300 hover:bg-mako-100 dark:hover:bg-white/5"
          active-class="!bg-primary/15 !text-primary font-semibold shadow-inner border border-primary/20"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z"
            />
          </svg>
          Radiocomunicaciones
        </router-link>

        <div v-if="showAdminLink || showTecnicoLink" class="pt-4 pb-2 px-4">
          <span class="text-xs font-bold uppercase tracking-wider text-mako-400">Gestión</span>
        </div>

        <router-link
          v-if="showAdminLink"
          to="/admin"
          class="flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 text-mako-600 dark:text-mako-300 hover:bg-mako-100 dark:hover:bg-white/5"
          active-class="!bg-primary/15 !text-primary font-semibold shadow-inner border border-primary/20"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
          Administrar Personal
        </router-link>

        <router-link
          v-if="showTecnicoLink"
          to="/tecnico"
          class="flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 text-mako-600 dark:text-mako-300 hover:bg-mako-100 dark:hover:bg-white/5"
          active-class="!bg-primary/15 !text-primary font-semibold shadow-inner border border-primary/20"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
            />
          </svg>
          Instalación de Nodos
        </router-link>
      </nav>

      <!-- Panel inferior de perfil en sidebar -->
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

    <!-- MOBILE SIDEBAR / DRAWER -->
    <div
      v-if="isSidebarOpen"
      class="fixed inset-0 bg-mako-950/40 backdrop-blur-sm z-40 md:hidden"
      @click="toggleSidebar"
    ></div>

    <aside
      class="fixed top-0 bottom-0 left-0 w-64 bg-white dark:bg-mako-950 z-50 transition-transform duration-300 md:hidden flex flex-col"
      :class="isSidebarOpen ? 'translate-x-0' : '-translate-x-full'"
    >
      <div class="p-6 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <img src="/netzona_logo.png" alt="Netzona Logo" class="h-10 w-auto object-contain" />
          <span class="font-bold text-xl tracking-tight text-mako-900 dark:text-white"
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
        <!-- Re-use links -->
        <router-link
          v-if="showAgroLink"
          to="/dashboard/agricola"
          class="flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 text-mako-600 dark:text-mako-300 hover:bg-mako-100 dark:hover:bg-white/5"
          active-class="!bg-primary/15 !text-primary font-semibold shadow-inner border border-primary/20"
        >
          Área Agrícola
        </router-link>

        <router-link
          v-if="showRadioLink"
          to="/dashboard/radiocomunicaciones"
          class="flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 text-mako-600 dark:text-mako-300 hover:bg-mako-100 dark:hover:bg-white/5"
          active-class="!bg-primary/15 !text-primary font-semibold shadow-inner border border-primary/20"
        >
          Radiocomunicaciones
        </router-link>

        <div v-if="showAdminLink || showTecnicoLink" class="pt-4 pb-2 px-4">
          <span class="text-xs font-bold uppercase tracking-wider text-mako-400">Gestión</span>
        </div>

        <router-link
          v-if="showAdminLink"
          to="/admin"
          class="flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 text-mako-600 dark:text-mako-300 hover:bg-mako-100 dark:hover:bg-white/5"
          active-class="!bg-primary/15 !text-primary font-semibold shadow-inner border border-primary/20"
        >
          Administrar Personal
        </router-link>

        <router-link
          v-if="showTecnicoLink"
          to="/tecnico"
          class="flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 text-mako-600 dark:text-mako-300 hover:bg-mako-100 dark:hover:bg-white/5"
          active-class="!bg-primary/15 !text-primary font-semibold shadow-inner border border-primary/20"
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
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 6h16M4 12h16M4 18h16"
              />
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

          <!-- Perfil resumido de cabecera -->
          <div class="flex items-center gap-3">
            <span
              class="text-sm font-semibold leading-none text-mako-800 dark:text-mako-100 hidden md:inline-block"
            >
              {{ auth.currentUser?.name }}
            </span>
            <div
              class="w-8 h-8 rounded-full bg-mako-200 dark:bg-mako-800 flex items-center justify-center text-xs font-semibold"
            >
              {{ auth.currentUser?.name.charAt(0) }}
            </div>
          </div>
        </div>
      </header>

      <!-- VIEW CONTENT -->
      <main class="flex-1 p-6 relative">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>
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
