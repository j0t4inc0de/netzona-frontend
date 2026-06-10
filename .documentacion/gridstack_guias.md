# Guía de Resolución de Problemas: GridStack + Tailwind + ApexCharts

Este documento recopila las soluciones a problemas visuales comunes que ocurrieron al combinar la librería de cuadrícula **GridStack**, clases de utilidad de **Tailwind CSS** y gráficos dinámicos de **ApexCharts** en los Dashboards del sistema (tanto `AgricolaView.vue` como `RadiocomunicacionesView.vue`).

## 1. Problema de "Tarjetas chanchadas" (Colisión o solapamiento de tarjetas)
**Síntoma:** Al arrastrar elementos o al renderizar la vista, algunas tarjetas (como el Mapa o Comandos Remotos) parecen ser ligeramente más altas/anchas de lo que dicta la grilla de GridStack. Esto causa que choquen o "toquen" las tarjetas que están directamente debajo o a su lado, destruyendo la armonía visual del padding.

**Causa:**
Las tarjetas (`.grid-stack-item-content`) tenían asignadas las clases de Tailwind `h-full` (height: 100%) y `w-full` (width: 100%).
GridStack usa `position: absolute; top: 0; bottom: 0; left: 0; right: 0;` en este contenedor interno para permitir que herede las dimensiones de su celda pero dejando un espacio libre (los márgenes de separación definidos por la opción `margin: 16` al inicializar la grilla).
Al forzar `h-full` y `w-full`, CSS obligaba al contenedor interno a expandirse y ocupar el ancho/alto total incluyendo la zona del "margen", lo cual reventaba la separación visual diseñada por GridStack.

**Solución Documentada:**
**NUNCA usar `h-full` ni `w-full` directamente sobre un elemento `.grid-stack-item-content`.**
Ese elemento ya ocupa dinámicamente todo el espacio que le otorga la celda respetando los márgenes. Las clases que se le deben asignar son simplemente para el diseño interno (ej. `flex flex-col justify-between`, `bg-white`, `rounded-[2rem]`, etc.).

---

## 2. Problema de "Gráfico a la mitad" (ApexCharts no respeta el ancho/alto de GridStack)
**Síntoma:** Los gráficos históricos (`<apexchart>`) aparecen inicialmente comprimidos a la mitad del tamaño de la tarjeta. Sin embargo, si el usuario hace *resize* de la ventana del navegador (cambiar un poco el tamaño), el gráfico súbitamente "despierta" y toma el 100% de la tarjeta correctamente.

**Causa:**
GridStack usa JavaScript para calcular y asignar dinámicamente las dimensiones a los contenedores durante la fase de montado (`onMounted`). ApexCharts intenta renderizar su Canvas/SVG simultáneamente. Cuando ApexCharts pide las dimensiones de su contenedor padre, GridStack aún está animando/posicionando la celda, por lo que ApexCharts asume que el contenedor mide menos y se dibuja pequeño.

**Solución Documentada:**
Tras inicializar GridStack, se debe disparar programáticamente un evento de `resize` en la ventana global del navegador. ApexCharts (y también Leaflet) están programados para reaccionar a esto, obligándolos a re-calcular sus dimensiones una vez que GridStack terminó de moldear la celda.
Ejemplo de código:
```javascript
grid = GridStack.init({ cellHeight: '145px', margin: 16 })
setTimeout(() => {
  // Disparamos un evento de resize artificial para arreglar ApexCharts
  window.dispatchEvent(new Event('resize'))
}, 300)
```

---

## 3. Alturas Ideales y Estándar para Tarjetas
Tras múltiples iteraciones y validación visual, se han definido las siguientes reglas inamovibles de diseño para garantizar que todas las vistas se vean premium y espaciosas:

* **Tarjetas de KPI y Métricas Superiores (KpiCards):** Alto de 1 unidad (`gs-h="1"`). Al sumar el contenido, da el espacio exacto para el título, el valor y la unidad.
* **Tarjetas con Textos Descriptivos, Listas o Íconos Interactivos (Seguridad, Comandos Remotos, Clima, Mapa de Cerro, etc):** Alto de 2 unidades (`gs-h="2"`). *Excepción: El "Clima del Cerro" en Telecomunicaciones ahora utiliza `gs-h="3"` para hacer simetría con el Gráfico Histórico en la misma fila.*
* **Tarjetas de Gráficos Históricos (ApexCharts):** Alto de 3 unidades (`gs-h="3"`). El `cellHeight` es 145px, lo que otorga `(145 * 3) + 32 = 467px`. Esto brinda espacio suficiente para los ejes X/Y, tooltips compartidos interactivos, leyendas y márgenes estéticos sin achatar la línea de tendencia.
