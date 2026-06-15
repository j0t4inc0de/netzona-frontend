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
          name: 'dashboard-home',
          component: () => import('../views/DashboardHome.vue'),
        },
        {
          path: 'cerro/:id',
          name: 'cerro-view',
          component: () => import('../views/CerroView.vue'),
        }
      ]
    },
    {
      path: '/admin',
      component: () => import('../layouts/DashboardLayout.vue'),
      meta: { requiresAuth: true, allowedRoles: ['admin', 'tecnico'] },
      children: [
        {
          path: '',
          name: 'admin',
          component: () => import('../views/AdminUsersView.vue')
        }
      ]
    },
    {
      path: '/estructura',
      component: () => import('../layouts/DashboardLayout.vue'),
      meta: { requiresAuth: true, allowedRoles: ['tecnico'] },
      children: [
        {
          path: '',
          name: 'estructura',
          component: () => import('../views/EstructuraView.vue')
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
      path: '/password/recovery',
      name: 'password-recovery',
      component: () => import('../views/PasswordRecoveryView.vue'),
      meta: { requiresAuth: false }
    },
    {
      path: '/password/reset',
      name: 'password-reset',
      component: () => import('../views/PasswordResetView.vue'),
      meta: { requiresAuth: false }
    },
    {
      path: '/verificacion/confirmar',
      name: 'account-activation',
      component: () => import('../views/AccountActivationView.vue'),
      meta: { requiresAuth: false }
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/dashboard'
    }
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  
  if (to.meta.requiresAuth !== false && !auth.isAuthenticated) {
    return '/login'
  }
  if (to.path === '/login' && auth.isAuthenticated) {
    if (auth.userRole === 'tecnico') {
      return '/tecnico'
    }
    return '/dashboard'
  }
  if (to.meta.allowedRoles && !to.meta.allowedRoles.includes(auth.userRole)) {
    return '/dashboard'
  }
})

export default router
