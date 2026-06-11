<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter()

const username = ref('')
const password = ref('')
const showPassword = ref(false)
const errorMsg = ref('')

const handleLogin = async () => {
  errorMsg.value = ''
  if (!username.value) {
    errorMsg.value = 'Por favor ingrese su usuario.'
    return
  }

  const success = await auth.login(username.value, password.value)
  if (success) {
    redirectAfterLogin()
  } else {
    errorMsg.value = 'Credenciales inválidas o error de conexión.'
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
  <div class="min-h-screen w-full flex items-center justify-center bg-mako-950 text-mako-900 font-sans overflow-hidden relative">
    <!-- Fondo Animado Aurora Drift -->
    <div class="aurora-bg z-0"></div>

    <!-- Contenedor Principal Card -->
    <div
      class="w-full max-w-md p-8 bg-white/80 dark:bg-mako-900/80 backdrop-blur-2xl border border-white/60 dark:border-white/10 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.3)] relative z-10 mx-4 transition-all duration-500 hover:border-primary/50"
    >
      <!-- Logo o Título -->
      <div class="text-center mb-8 flex flex-col items-center justify-center">
        <img src="/netzona_logo.png" alt="Netzona Logo" class="h-16 w-auto object-contain mb-3 drop-shadow-md" />
        <h1 class="text-2xl font-bold tracking-tight text-mako-900 dark:text-white">TELEMETRICS</h1>
        <p class="text-[10px] text-mako-500 dark:text-mako-400 mt-1.5 uppercase tracking-widest font-bold">
          Plataforma de Monitoreo IoT
        </p>
      </div>

      <!-- Formulario -->
      <form @submit.prevent="handleLogin" class="space-y-5">
        <div>
          <label class="block text-xs uppercase font-bold tracking-wider text-mako-500 dark:text-mako-300 mb-2"
            >Usuario</label
          >
          <input
            v-model="username"
            type="text"
            placeholder="ej. juan@agrobio.cl"
            class="w-full px-5 py-3.5 rounded-2xl bg-white/50 dark:bg-mako-800/50 border border-mako-200 dark:border-mako-700 focus:border-primary focus:bg-white dark:focus:bg-mako-800 text-mako-900 dark:text-white placeholder-mako-400 outline-none transition-all duration-200"
          />
        </div>

        <div class="relative">
          <label class="block text-xs uppercase font-bold tracking-wider text-mako-500 dark:text-mako-300 mb-2"
            >Contraseña</label
          >
          <input
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            placeholder="••••••••"
            class="w-full px-5 py-3.5 pr-12 rounded-2xl bg-white/50 dark:bg-mako-800/50 border border-mako-200 dark:border-mako-700 focus:border-primary focus:bg-white dark:focus:bg-mako-800 text-mako-900 dark:text-white placeholder-mako-400 outline-none transition-all duration-200"
          />
          <button
            type="button"
            @click="showPassword = !showPassword"
            class="absolute right-4 top-[38px] text-mako-400 hover:text-primary transition-colors focus:outline-none"
            tabindex="-1"
          >
            <svg v-if="!showPassword" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
          </button>
        </div>

        <!-- Alerta de Error -->
        <p
          v-if="errorMsg"
          class="text-red-500 dark:text-red-400 text-xs font-semibold bg-red-500/10 border border-red-500/20 px-4 py-2.5 rounded-xl text-center"
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
.aurora-bg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: radial-gradient(
      ellipse at 20% 30%,
      rgba(10, 78, 229, 0.8) 0%,
      rgba(10, 78, 229, 0) 60%
    ),
    radial-gradient(
      ellipse at 80% 50%,
      rgba(3, 177, 237, 0.7) 0%,
      rgba(3, 177, 237, 0) 70%
    ),
    radial-gradient(
      ellipse at 50% 80%,
      rgba(10, 78, 229, 0.6) 0%,
      rgba(10, 78, 229, 0) 65%
    ),
    linear-gradient(135deg, #000000 0%, #0a0520 100%);
  background-blend-mode: overlay, screen, hard-light;
  overflow: hidden;
  animation: aurora-drift 25s infinite alternate ease-in-out;
}

.aurora-bg::before {
  content: "";
  position: absolute;
  width: 200%;
  height: 200%;
  top: -50%;
  left: -50%;
  background: repeating-linear-gradient(
      45deg,
      rgba(255, 255, 255, 0.02) 0px,
      rgba(255, 255, 255, 0.02) 1px,
      transparent 1px,
      transparent 40px
    ),
    repeating-linear-gradient(
      -45deg,
      rgba(255, 255, 255, 0.03) 0px,
      rgba(255, 255, 255, 0.03) 1px,
      transparent 1px,
      transparent 60px
    );
  animation: grid-shift 20s linear infinite;
  pointer-events: none;
}

.aurora-bg::after {
  content: "";
  position: absolute;
  width: 100%;
  height: 100%;
  background: radial-gradient(
    circle at center,
    transparent 70%,
    rgba(10, 5, 32, 0.9) 100%
  );
  animation: aurora-pulse 8s infinite alternate;
  pointer-events: none;
}

@keyframes aurora-drift {
  0% {
    background-position:
      0% 0%,
      0% 0%,
      0% 0%;
    filter: brightness(1);
  }
  50% {
    background-position:
      -10% -5%,
      5% 10%,
      0% 15%;
    filter: brightness(1.2);
  }
  100% {
    background-position:
      5% 10%,
      -10% -5%,
      15% 0%;
    filter: brightness(1);
  }
}

@keyframes grid-shift {
  0% {
    transform: translate(0, 0);
  }
  100% {
    transform: translate(-50%, -50%);
  }
}

@keyframes aurora-pulse {
  0% {
    opacity: 0.8;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(1.05);
  }
  100% {
    opacity: 0.8;
    transform: scale(1);
  }
}
</style>
