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
    <!-- Fondo Animado Aurora Drift -->
    <div class="container z-0"></div>

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

        <div>
          <label class="block text-xs uppercase font-bold tracking-wider text-mako-500 dark:text-mako-300 mb-2"
            >Contraseña</label
          >
          <input
            v-model="password"
            type="password"
            placeholder="••••••••"
            class="w-full px-5 py-3.5 rounded-2xl bg-white/50 dark:bg-mako-800/50 border border-mako-200 dark:border-mako-700 focus:border-primary focus:bg-white dark:focus:bg-mako-800 text-mako-900 dark:text-white placeholder-mako-400 outline-none transition-all duration-200"
          />
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
.container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: radial-gradient(
      ellipse at 20% 30%,
      rgba(138, 43, 226, 0.8) 0%,
      rgba(138, 43, 226, 0) 60%
    ),
    radial-gradient(
      ellipse at 80% 50%,
      rgba(0, 191, 255, 0.7) 0%,
      rgba(0, 191, 255, 0) 70%
    ),
    radial-gradient(
      ellipse at 50% 80%,
      rgba(50, 205, 50, 0.6) 0%,
      rgba(50, 205, 50, 0) 65%
    ),
    linear-gradient(135deg, #000000 0%, #0a0520 100%);
  background-blend-mode: overlay, screen, hard-light;
  overflow: hidden;
  animation: aurora-drift 25s infinite alternate ease-in-out;
}

.container::before {
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

.container::after {
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
    filter: hue-rotate(0deg) brightness(1);
  }
  50% {
    background-position:
      -10% -5%,
      5% 10%,
      0% 15%;
    filter: hue-rotate(30deg) brightness(1.2);
  }
  100% {
    background-position:
      5% 10%,
      -10% -5%,
      15% 0%;
    filter: hue-rotate(60deg) brightness(1);
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
