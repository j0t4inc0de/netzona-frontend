<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { api } from '../services/api'
import { toast } from 'vue-sonner'

const router = useRouter()
const route = useRoute()

const uid = ref('')
const token = ref('')
const password = ref('')
const passwordConfirm = ref('')
const showPassword = ref(false)
const errorMsg = ref('')
const successMsg = ref('')
const isSubmitting = ref(false)

onMounted(() => {
  uid.value = route.query.uid || ''
  token.value = route.query.token || ''

  if (!uid.value || !token.value) {
    errorMsg.value = 'Enlace de restablecimiento inválido o incompleto.'
  }
})

const handleResetPassword = async () => {
  errorMsg.value = ''
  successMsg.value = ''

  if (!uid.value || !token.value) {
    errorMsg.value = 'Faltan parámetros de verificación.'
    return
  }

  if (password.value !== passwordConfirm.value) {
    errorMsg.value = 'Las contraseñas no coinciden.'
    return
  }

  isSubmitting.value = true
  try {
    const res = await api('/cuentas/password/restablecer/confirmar/', {
      method: 'POST',
      body: JSON.stringify({
        uid: uid.value,
        token: token.value,
        password_nueva: password.value,
        password_nueva_confirmacion: passwordConfirm.value
      })
    })

    if (res.ok) {
      successMsg.value = 'Contraseña restablecida correctamente. Redirigiendo...'
      toast.success('Contraseña actualizada con éxito.')
      setTimeout(() => {
        router.push('/login')
      }, 3000)
    } else {
      const errorData = await res.json().catch(() => ({}))
      errorMsg.value = errorData.password_nueva?.[0] || errorData.token?.[0] || 'Error al restablecer la contraseña. Verifique que el enlace sea válido.'
    }
  } catch {
    errorMsg.value = 'Error de conexión al restablecer la contraseña.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="min-h-screen w-full flex items-center justify-center bg-mako-950 text-mako-900 font-sans overflow-hidden relative">
    <div class="aurora-bg z-0"></div>

    <div
      class="w-full max-w-md p-8 bg-white/80 dark:bg-mako-900/80 backdrop-blur-2xl border border-white/60 dark:border-white/10 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.3)] relative z-10 mx-4 transition-all duration-500 hover:border-primary/50"
    >
      <div class="text-center mb-8 flex flex-col items-center justify-center">
        <img src="/netzona_logo.png" alt="Netzona Logo" class="h-16 w-auto object-contain mb-3 drop-shadow-md" />
        <h1 class="text-2xl font-bold tracking-tight text-mako-900 dark:text-white">Nueva Contraseña</h1>
        <p class="text-[10px] text-mako-500 dark:text-mako-400 mt-1.5 uppercase tracking-widest font-bold">
          Plataforma de Monitoreo IoT
        </p>
      </div>

      <form @submit.prevent="handleResetPassword" class="space-y-5">
        <div>
          <label class="block text-xs uppercase font-bold tracking-wider text-mako-500 dark:text-mako-300 mb-2"
            >Nueva Contraseña</label
          >
          <input
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            placeholder="••••••••"
            class="w-full px-5 py-3.5 rounded-2xl bg-white/50 dark:bg-mako-800/50 border border-mako-200 dark:border-mako-700 focus:border-primary focus:bg-white dark:focus:bg-mako-800 text-mako-900 dark:text-white placeholder-mako-400 outline-none transition-all duration-200"
            required
            :disabled="!uid || !token"
          />
        </div>

        <div>
          <label class="block text-xs uppercase font-bold tracking-wider text-mako-500 dark:text-mako-300 mb-2"
            >Confirmar Nueva Contraseña</label
          >
          <input
            v-model="passwordConfirm"
            :type="showPassword ? 'text' : 'password'"
            placeholder="••••••••"
            class="w-full px-5 py-3.5 rounded-2xl bg-white/50 dark:bg-mako-800/50 border border-mako-200 dark:border-mako-700 focus:border-primary focus:bg-white dark:focus:bg-mako-800 text-mako-900 dark:text-white placeholder-mako-400 outline-none transition-all duration-200"
            required
            :disabled="!uid || !token"
          />
        </div>

        <div class="flex items-center gap-2">
          <input type="checkbox" id="show-pass" v-model="showPassword" class="rounded text-primary focus:ring-primary h-4 w-4" />
          <label for="show-pass" class="text-xs text-mako-500 dark:text-mako-300 cursor-pointer selection:bg-transparent">Mostrar contraseñas</label>
        </div>

        <p v-if="errorMsg" class="text-red-500 dark:text-red-400 text-xs font-semibold bg-red-500/10 border border-red-500/20 px-4 py-2.5 rounded-xl text-center">
          {{ errorMsg }}
        </p>

        <p v-if="successMsg" class="text-green-600 dark:text-green-400 text-xs font-semibold bg-green-500/10 border border-green-500/20 px-4 py-2.5 rounded-xl text-center">
          {{ successMsg }}
        </p>

        <button
          type="submit"
          :disabled="isSubmitting || !uid || !token"
          class="w-full py-4 rounded-2xl bg-primary text-white font-bold shadow-[0_0_20px_rgba(0,209,94,0.3)] hover:shadow-[0_0_25px_rgba(0,209,94,0.5)] transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ isSubmitting ? 'Guardando...' : 'Cambiar Contraseña' }}
        </button>

        <div class="text-center mt-4">
          <button type="button" @click="router.push('/login')" class="text-xs font-bold text-primary hover:underline bg-transparent border-none outline-none cursor-pointer">
            Volver al Inicio de Sesión
          </button>
        </div>
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
    background-position: 0% 0%, 0% 0%, 0% 0%;
    filter: brightness(1);
  }
  50% {
    background-position: -10% -5%, 5% 10%, 0% 15%;
    filter: brightness(1.2);
  }
  100% {
    background-position: 5% 10%, -10% -5%, 15% 0%;
    filter: brightness(1);
  }
}

@keyframes grid-shift {
  0% { transform: translate(0, 0); }
  100% { transform: translate(-50%, -50%); }
}

@keyframes aurora-pulse {
  0% { opacity: 0.8; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.05); }
  100% { opacity: 0.8; transform: scale(1); }
}
</style>
