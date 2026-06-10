import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
      meta: { requiresAuth: false }
    },
    {
      path: '/dashboard',
      component: () => import('../layouts/DashboardLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          redirect: () => {
            const auth = useAuthStore()
            if (auth.userRole === 'tecnico') return '/tecnico'
            // Si es trabajador y sólo tiene acceso a cerro, o tiene primer acceso a cerro
            if (auth.userRole === 'trabajador' && !auth.accessibleItems.includes('predio-1') && auth.accessibleItems.includes('cerro-1')) {
              return '/dashboard/radiocomunicaciones'
            }
            return '/dashboard/agricola'
          }
        },
        {
          path: 'agricola',
          name: 'agricola',
          component: () => import('../views/AgricolaView.vue'),
        },
        {
          path: 'radiocomunicaciones',
          name: 'radiocomunicaciones',
          component: () => import('../views/RadiocomunicacionesView.vue'),
        }
      ]
    },
    {
      path: '/admin',
      component: () => import('../layouts/DashboardLayout.vue'),
      meta: { requiresAuth: true, allowedRoles: ['admin'] },
      children: [
        {
          path: '',
          name: 'admin',
          component: () => import('../views/AdminUsersView.vue')
        }
      ]
    },
    {
      path: '/tecnico',
      component: () => import('../layouts/DashboardLayout.vue'),
      meta: { requiresAuth: true, allowedRoles: ['tecnico'] },
      children: [
        {
          path: '',
          name: 'tecnico',
          component: () => import('../views/TecnicoView.vue')
        }
      ]
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/dashboard'
    }
  ],
})

router.beforeEach((to, from, next) => {
  const auth = useAuthStore()
  
  if (to.meta.requiresAuth !== false && !auth.isAuthenticated) {
    next('/login')
  } else if (to.path === '/login' && auth.isAuthenticated) {
    if (auth.userRole === 'tecnico') {
      next('/tecnico')
    } else {
      next('/dashboard')
    }
  } else if (to.meta.allowedRoles && !to.meta.allowedRoles.includes(auth.userRole)) {
    // Si no tiene rol permitido, redirigir a dashboard
    next('/dashboard')
  } else {
    next()
  }
})

export default router
