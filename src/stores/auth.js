import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api, API_URL } from '../services/api'

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

    try {
      const res = await api('/cuentas/me/')
      if (res.ok) {
        const userData = await res.json()
        
        let role = 'trabajador'
        if (userData.is_superuser || (userData.group_names && userData.group_names.includes('admin_netzona'))) {
          role = 'tecnico'
        } else if (userData.group_names && userData.group_names.includes('cliente_empresa')) {
          role = 'admin'
        }

        let permissions = []
        if (role === 'trabajador') {
          try {
            const resAcc = await api(`/cuentas/accesos/?usuario=${userData.id}&activo=True`)
            if (resAcc.ok) {
              const dataAcc = await resAcc.json()
              const accList = dataAcc.results || dataAcc
              permissions = accList.map(a => a.sitio).filter(Boolean)
            }
          } catch (e) {
            console.error("Error fetching user accesses", e)
          }
        }

        currentUser.value = {
          id: userData.id,
          username: userData.email,
          name: `${userData.nombres || ''} ${userData.apellidos || ''}`.trim() || userData.email,
          role: role,
          empresa: userData.empresa,
          permissions: permissions,
          group_names: userData.group_names || [],
          groups: userData.groups || [],
          permission_codenames: userData.permission_codenames || [],
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
        body: JSON.stringify({ username, password })
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
