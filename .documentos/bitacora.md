# Bitácora de Desarrollo - Proyecto Netzona Frontend

## Registro de Cambios y Mejoras - 12 de Junio de 2026 (19:45)

### 1. Análisis Técnico del Backend
* Se realizó una revisión exhaustiva del repositorio del backend (`netzona-backend`) para mapear la API de telemetría, el flujo de autenticación, el esquema de preferencias de usuario y la ingesta de datos por MQTT.
* Las guías y reportes detallados fueron almacenados en la carpeta `.documentos/`.

### 2. Actualización de Marca / Logotipo
* Se configuró el logotipo oficial de Netzona (ubicado en `public/`) como el icono de la pestaña (`favicon`) en el archivo `index.html` para la correcta visualización de marca en el navegador.

### 3. Corrección de Consultas de Sensores Históricos (Consola 404)
* Se solucionaron los errores `404 (Not Found)` que ocurrían al iniciar sesión al consultar el historial de sensores inexistentes o no inicializados para el dispositivo de prueba (`DEV-NETZONA-001`).
* Se optimizó el flujo para consultar el último estado actual en lugar de historiales fallidos.

### 4. Persistencia de Posición y Tamaño de Widgets (Dashboard)
* Se resolvió un error `400 (Bad Request)` proveniente del backend al guardar el layout (`/api/cuentas/preferencias/`), debido a la falta del campo de altura (`h`) y otros campos de dimensiones en la carga de datos.
* Se implementó un mapeo robusto que extrae de manera dinámica los valores de posicionamiento (`x`, `y`, `w`, `h`) directamente desde el nodo de GridStack (`gridstackNode`) y del DOM (`gs-w`, `gs-h`).
* Los widgets estáticos y personalizados ahora se guardan y cargan correctamente tanto en la base de datos del backend como en el `localStorage` del cliente.

### 5. Bloqueo de Widgets en Dispositivos Móviles
* Se integró una validación para detectar si el usuario ingresa desde un dispositivo móvil (`window.innerWidth <= 768`).
* Se desactivó el arrastre (`disableDrag: isMobile`) y el cambio de tamaño (`disableResize: isMobile`) en las vistas `AgricolaView.vue` y `RadiocomunicacionesView.vue`. Esto previene que los usuarios muevan accidentalmente los elementos del panel táctil al hacer scroll con el dedo.

### 6. Depuración y Control de Calidad
* Se ejecutó el formateador y el linter del proyecto (`eslint`/`oxlint`) y se limpiaron importaciones no utilizadas (`themeColors`) y parámetros redundantes (`event`, `items` en callbacks de GridStack), asegurando la compatibilidad de compilación y limpieza del código.
* Se validó con éxito la compilación para producción (`npm run build`).
