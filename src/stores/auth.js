import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api, API_URL, parseJwt } from '../services/api'

export const useAuthStore = defineStore('auth', () => {
  const currentUser = ref(null)

  const isAuthenticated = computed(() => currentUser.value !== null)
  const userRole = computed(() => currentUser.value?.role || null)
  const accessibleItems = computed(() => currentUser.value?.permissions || [])

  // Cargar usuario desde local storage si existe el token
  const initializeAuth = async () => {
    const token = localStorage.getItem('access_token')
    if (token) {
      await fetchCurrentUser()
    }
  }

  const fetchCurrentUser = async () => {
    const token = localStorage.getItem('access_token')
    if (!token) return

    const payload = parseJwt(token)
    if (!payload || !payload.user_id) return

    try {
      const res = await api(`/cuentas/usuarios/${payload.user_id}/`)
      if (res.ok) {
        const userData = await res.json()
        
        let role = 'trabajador'
        if (userData.is_superuser || (userData.group_names && userData.group_names.includes('admin_netzona'))) {
          role = 'admin'
        } else if (userData.group_names && userData.group_names.includes('tecnico')) {
          role = 'tecnico'
        }

        currentUser.value = {
          id: userData.id,
          username: userData.email,
          name: `${userData.first_name || userData.nombres || ''} ${userData.last_name || userData.apellidos || ''}`.trim() || userData.email,
          role: role,
          permissions: userData.permission_codenames || userData.accesos_ids || [], // Provisional, conectar a /accesos/ si es necesario
        }
      } else {
        logout()
      }
    } catch (err) {
      console.error("Error fetching current user", err)
    }
  }

  // Login real con el backend
  const login = async (username, password) => {
    try {
      const response = await fetch(`${API_URL}/auth/token/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: username, password })
      })

      if (!response.ok) return false

      const data = await response.json()
      localStorage.setItem('access_token', data.access)
      localStorage.setItem('refresh_token', data.refresh)

      await fetchCurrentUser()
      return true
    } catch (err) {
      console.error('Login error:', err)
      return false
    }
  }

  const logout = () => {
    currentUser.value = null
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
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
    logout,
    hasPermission,
    initializeAuth,
  }
})
