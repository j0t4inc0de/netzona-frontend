<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter()

const username = ref('')
const password = ref('')
const errorMsg = ref('')

const handleLogin = () => {
  errorMsg.value = ''
  if (!username.value) {
    errorMsg.value = 'Por favor ingrese su usuario.'
    return
  }

  const success = auth.login(username.value, password.value)
  if (success) {
    redirectAfterLogin()
  } else {
    errorMsg.value = 'Credenciales inválidas (Pruebe con: juan / 1234)'
  }
}

const loginAsRole = (role) => {
  auth.loginAs(role)
  redirectAfterLogin()
}

const redirectAfterLogin = () => {
  if (auth.userRole === 'tecnico') {
    router.push('/tecnico')
  } else if (auth.userRole === 'admin') {
    router.push('/dashboard')
  } else {
    router.push('/dashboard')
  }
}
</script>

<template>
  <div
    class="min-h-screen flex items-center justify-center bg-mako-950 text-white font-sans overflow-hidden relative"
  >
    <!-- Efectos de Luces Dinámicas detrás del Login (Glassmorphism) -->
    <div class="absolute inset-0 overflow-hidden pointer-events-none z-0">
      <div
        class="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] rounded-full bg-primary/20 blur-[150px]"
      ></div>
      <div
        class="absolute -bottom-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[150px]"
      ></div>
    </div>

    <!-- Contenedor Principal Card -->
    <div
      class="w-full max-w-md p-8 bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] shadow-2xl relative z-10 mx-4 transition-all duration-500 hover:border-primary/20"
    >
      <!-- Logo o Título -->
      <div class="text-center mb-8 flex flex-col items-center justify-center">
        <img src="/netzona_logo.png" alt="Netzona Logo" class="h-16 w-auto object-contain mb-3" />
        <h1 class="text-2xl font-bold tracking-tight">TELEMETRICS</h1>
        <p class="text-[10px] text-mako-400 mt-1.5 uppercase tracking-widest font-bold">
          Plataforma de Monitoreo IoT
        </p>
      </div>

      <!-- Formulario -->
      <form @submit.prevent="handleLogin" class="space-y-5">
        <div>
          <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-2"
            >Usuario</label
          >
          <input
            v-model="username"
            type="text"
            placeholder="juan o nombre de rol"
            class="w-full px-5 py-3.5 rounded-2xl bg-mako-900/60 border border-white/10 focus:border-primary/50 text-white placeholder-mako-500 outline-none transition-all duration-200"
          />
        </div>

        <div>
          <label class="block text-xs uppercase font-bold tracking-wider text-mako-400 mb-2"
            >Contraseña</label
          >
          <input
            v-model="password"
            type="password"
            placeholder="••••••••"
            class="w-full px-5 py-3.5 rounded-2xl bg-mako-900/60 border border-white/10 focus:border-primary/50 text-white placeholder-mako-500 outline-none transition-all duration-200"
          />
        </div>

        <!-- Alerta de Error -->
        <p
          v-if="errorMsg"
          class="text-red-400 text-xs font-semibold bg-red-500/10 border border-red-500/20 px-4 py-2.5 rounded-xl text-center"
        >
          {{ errorMsg }}
        </p>

        <!-- Botón Ingresar -->
        <button
          type="submit"
          class="w-full py-4 rounded-2xl bg-primary text-white font-bold shadow-[0_0_20px_rgba(0,209,94,0.3)] hover:shadow-[0_0_25px_rgba(0,209,94,0.5)] transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0"
        >
          Iniciar Sesión
        </button>
      </form>

      <!-- Divisor para Simulador -->
      <div class="relative my-8">
        <div class="absolute inset-0 flex items-center">
          <div class="w-full border-t border-white/10"></div>
        </div>
        <div class="relative flex justify-center text-xs uppercase font-bold tracking-wider">
          <span class="bg-mako-950/80 px-3 text-mako-400"></span>
        </div>
      </div>

      <!-- Botones de Roles Rápidos -->
      <div class="grid grid-cols-3 gap-2">
        <button
          @click="loginAsRole('tecnico')"
          class="flex flex-col items-center justify-center p-3 rounded-xl border border-white/5 bg-white/5 hover:bg-primary/10 hover:border-primary/30 transition-all duration-200 text-center"
        >
          <svg
            class="w-5 h-5 text-primary mb-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
            />
          </svg>
          <span class="text-[10px] font-semibold leading-tight text-mako-300">Técnico Netzona</span>
        </button>

        <button
          @click="loginAsRole('admin')"
          class="flex flex-col items-center justify-center p-3 rounded-xl border border-white/5 bg-white/5 hover:bg-primary/10 hover:border-primary/30 transition-all duration-200 text-center"
        >
          <svg
            class="w-5 h-5 text-primary mb-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
          <span class="text-[10px] font-semibold leading-tight text-mako-300">Cliente Admin</span>
        </button>

        <button
          @click="loginAsRole('trabajador')"
          class="flex flex-col items-center justify-center p-3 rounded-xl border border-white/5 bg-white/5 hover:bg-primary/10 hover:border-primary/30 transition-all duration-200 text-center"
        >
          <svg
            class="w-5 h-5 text-primary mb-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
          <span class="text-[10px] font-semibold leading-tight text-mako-300">Cliente Worker</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Transición shimmer suave para el fondo */
@keyframes pulseGlow {
  0%,
  100% {
    opacity: 0.8;
  }
  50% {
    opacity: 1;
  }
}
</style>
