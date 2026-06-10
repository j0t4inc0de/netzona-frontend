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
    class="min-h-screen flex items-center justify-center bg-mako-50 text-mako-900 font-sans overflow-hidden relative"
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
      class="w-full max-w-md p-8 bg-white/80 backdrop-blur-2xl border border-white/60 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.08)] relative z-10 mx-4 transition-all duration-500 hover:border-primary/20"
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
            placeholder="ej. juan@agrobio.cl"
            class="w-full px-5 py-3.5 rounded-2xl bg-mako-100/50 border border-mako-200 focus:border-primary focus:bg-white text-mako-900 placeholder-mako-400 outline-none transition-all duration-200"
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
            class="w-full px-5 py-3.5 rounded-2xl bg-mako-100/50 border border-mako-200 focus:border-primary focus:bg-white text-mako-900 placeholder-mako-400 outline-none transition-all duration-200"
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
