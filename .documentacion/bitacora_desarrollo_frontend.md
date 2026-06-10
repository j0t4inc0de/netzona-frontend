# Bitácora de Desarrollo - Frontend Netzona

Este documento es un registro histórico de los últimos avances, refactorizaciones e implementaciones realizadas en el Frontend de Netzona para alinearlo a un estándar "Enterprise" y conectarlo adecuadamente con la arquitectura de la API en Django.

## 1. Pulido de Interfaz (UI/UX)
- **Notificaciones (Toasts) con `vue-sonner`:** Se eliminaron todas las alertas feas nativas del navegador (`alert()`). Ahora toda la aplicación usa notificaciones flotantes premium, con íconos de colores (éxito, error, carga) y animaciones fluidas.
- **Confirmaciones en Línea (Inline Confirmations):** Se reemplazó la confirmación de reinicio nativa (`confirm()`) por una animación suave y reactiva directamente en el menú de ajustes, evitando problemas de diseño y ventanas emergentes bloqueantes.
- **Esqueletos de Carga (Skeleton Loaders):** Se agregaron animaciones en pulso a los tableros `AgricolaView` y `RadiocomunicacionesView` mientras se espera la respuesta del servidor, mejorando drásticamente la percepción de velocidad (UX).
- **Prevención de Doble Clic:** Los botones de guardado (como el de Restaurar Dashboard) ahora cambian a un estado de "Cargando..." y se bloquean automáticamente para evitar que el usuario envíe múltiples peticiones por accidente. Se integró también un `AbortController` (timeout de 3s) por si el backend no responde a tiempo.

## 2. Ajustes Generales y Modo Oscuro
- **Menú de Configuraciones (Settings Modal):** Se agregó un botón general (engranaje) en la barra de navegación superior.
- **Tema Oscuro Persistente:** Posibilidad de cambiar entre modo claro y oscuro. Su estado puede sincronizarse fácilmente con la API backend si se desea.
- **Persistencia de Sesiones "Mock":** Se actualizó el archivo `stores/auth.js` para persistir temporalmente el "rol" del usuario de pruebas (`mock_role`) en el LocalStorage. Esto evita que la sesión se cierre por error cuando los desarrolladores recargan la página con F5.

## 3. Resolución de Errores Críticos (Bugfixes)
- **Condición de Carrera en GridStack:** Se descubrió y reparó un error donde las tarjetas de GridStack se superponían (solapaban) en el dashboard. El error era causado porque GridStack intentaba inicializarse mientras Vue aún estaba mostrando los Esqueletos de Carga. Se resolvió integrando `nextTick()` y vigilantes de la variable `isLoading`.
- **Reinicio de Componentes sin Refrescar la Página:** El botón de "Restaurar Diseño" antes usaba `window.location.reload()`, lo cual cerraba la sesión. Ahora usa una estrategia reactiva de Vue cambiando un `reloadKey` del `<router-view>`, permitiendo recargar solo los componentes necesarios sin reiniciar la memoria del navegador.

## 4. Conexión Estricta a los Modelos de Django
- **Refactorización Masiva de `TecnicoView.vue`:**
  - El formulario de registro de nodos pasó de usar selectores fijos a consultar en tiempo real las APIs de Django.
  - **Selectores en Cascada:** Al elegir Empresa -> Carga sus Sitios -> Carga sus Zonas. Replicando exactamente la integridad referencial del backend.
  - **Consultas Reales:** Se integró la extracción de `GET /api/dispositivos/tipos/` para poblar la lista de Tipos de Dispositivo reales (y no "agrícola / telecom" quemados en código).
  - **Validaciones Regex:** El campo `Serial` exige la regla nativa de Python `^[A-Za-z0-9_-]+$`, mostrando error en pantalla antes de enviar la petición.
  - **Población de la Tabla Central:** Se apuntó a `GET /api/dispositivos/equipos/` para mostrar todos los nodos creados por el backend y renderizar su `mqtt_topic`.

## 5. Mejoras Estéticas y Modo Oscuro Dinámico
- **Fondo Animado (Aurora Drift):** Implementación de un fondo dinámico con CSS en la pantalla de Login, empleando colores corporativos (`#0a4ee5` y `#03b1ed`) con micro-animaciones en bucle para una experiencia premium.
- **Loader Global Unificado:** Creación del componente `AppLoader.vue`, reemplazando todas las cargas en bloque de la app por un spinner flotante con efecto *backdrop-blur*, reduciendo la cantidad de esqueletos de carga repetidos.
- **Formulario de Cambio de Contraseña:** Se integró en la parte superior del Modal de Configuraciones un formulario fluido con sus validaciones de longitud y coincidencia. Se simula una petición POST a `/cuentas/cambiar-password/` con un loader y alertas de éxito.
- **Color Primario Dinámico en Dark Mode:** Refactorización de Tailwind (`tailwind.config.js` y `tailwind.css`) usando variables CSS con sintaxis robusta `rgba()`. Ahora, todos los elementos azules (`bg-primary`, `text-primary`) pasan automáticamente de un azul vibrante (`#0C4CE4`) a un azul apastelado (`#6D92F8`) cuando el usuario activa el modo oscuro.
- **Reactividad en ApexCharts:** Los gráficos de los tableros no detectaban el cambio de tema en tiempo real al usar Canvas Javascript puro. Se inyectó `useDark()` de `@vueuse/core` en las Vistas y Widgets, logrando que los ejes, fondos y líneas de datos muten de color instantáneamente sin recargar la página.

## 6. Próximos Pasos Recomendados
1. **Gestión de Sensores (`DispositivoSensor`):** Crear una ventana que permita asignar o desactivar distintos Tipos de Sensor a un Equipo particular directamente en la Vista del Técnico.
2. **Conectar Telemetría (Dashboards):** Hacer que el almacén global `telemetrics.js` consuma los datos de los endpoints `/estado-actual/` y `/historial/` en vez de usar datos simulados.
3. **Filtros Temporales en Gráficos:** Poner un selector desplegable encima de ApexCharts (Ej: Últimas 24h) y habilitar la función de descargar los datos del gráfico como `.csv`.
