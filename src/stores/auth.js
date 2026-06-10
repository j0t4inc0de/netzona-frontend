import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  const currentUser = ref(null)

  const isAuthenticated = computed(() => currentUser.value !== null)
  const userRole = computed(() => currentUser.value?.role || null)
  const accessibleItems = computed(() => currentUser.value?.permissions || [])

  // Simulación de credenciales y roles para desarrollo
  const login = (username, password) => {
    // Si se pasa un rol en el nombre de usuario (ej: 'admin', 'tecnico', 'trabajador'), loguear directamente
    const lowerUser = username.toLowerCase()
    if (lowerUser === 'tecnico' || lowerUser === 'admin' || lowerUser === 'trabajador') {
      return loginAs(lowerUser)
    }

    // Login por defecto
    if (username === 'juan' && password === '1234') {
      currentUser.value = {
        id: 'admin-1',
        username: 'juan',
        name: 'Juan Erices',
        role: 'admin',
        permissions: ['predio-a', 'predio-b', 'cerro-1', 'cerro-2'],
      }
      return true
    }

    return false
  }

  const loginAs = (role) => {
    if (role === 'tecnico') {
      currentUser.value = {
        id: 'tech-1',
        username: 'netzona_tech',
        name: 'Soporte Netzona',
        role: 'tecnico',
        permissions: [],
      }
    } else if (role === 'admin') {
      currentUser.value = {
        id: 'admin-1',
        username: 'admin_cliente',
        name: 'Juan Erices (Admin)',
        role: 'admin',
        permissions: ['predio-1', 'predio-2', 'cerro-1', 'cerro-2'],
      }
    } else if (role === 'trabajador') {
      currentUser.value = {
        id: 'worker-1',
        username: 'trabajador_cliente',
        name: 'Pedro Díaz (Trabajador)',
        role: 'trabajador',
        permissions: ['predio-1', 'cerro-1'], // Acceso limitado por defecto
      }
    }
    return true
  }

  const logout = () => {
    currentUser.value = null
  }

  const hasPermission = (itemId) => {
    if (userRole.value === 'tecnico' || userRole.value === 'admin') return true
    return accessibleItems.value.includes(itemId)
  }

  return {
    currentUser,
    isAuthenticated,
    userRole,
    accessibleItems,
    login,
    loginAs,
    logout,
    hasPermission,
  }
})
