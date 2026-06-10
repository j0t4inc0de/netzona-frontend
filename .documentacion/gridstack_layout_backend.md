# Guía para el Backend: Preferencias del Usuario (GridStack y Tema Oscuro)

Este documento está dirigido al desarrollador del backend (Django) para instruir la implementación del guardado de preferencias personalizadas del usuario. Esto incluye:
1. Posiciones y tamaños de las tarjetas del dashboard (GridStack) específicas por sitio.
2. Preferencia de Tema Oscuro/Claro (Dark Mode) global del usuario.

## Objetivo
Permitir que el usuario mueva y redimensione libremente sus tarjetas en el dashboard, y que elija su tema (claro/oscuro). Al iniciar sesión desde cualquier dispositivo, su tema preferido se aplicará automáticamente y las tarjetas aparecerán en las posiciones que las dejó.

## ¿Qué enviará el Frontend?

El Frontend se comunicará con un endpoint unificado de preferencias `PUT /api/cuentas/preferencias/`.

### 1. Guardar Tema Oscuro
Cuando el usuario apriete el botón de la "Luna/Sol", el frontend hará una petición `PUT` enviando únicamente la preferencia del tema:
```json
{
  "tema_oscuro": true
}
```

### 2. Guardar Layout de GridStack
Cuando el usuario mueva una tarjeta en un sitio específico, enviará:
```json
{
  "sitio_id": "uuid-del-sitio-o-cerro",
  "layout_dashboard": [
    { "widget_id": "uuid-del-widget-o-codigo", "x": 0, "y": 1, "w": 3, "h": 2 },
    { "widget_id": "uuid-de-otro-widget", "x": 3, "y": 1, "w": 6, "h": 3 }
  ]
}
```

## Tareas requeridas en Django

### 1. Crear el Modelo de Base de Datos
Debes crear un modelo en tu aplicación de Cuentas o Preferencias. Dado que el tema oscuro es global y el layout es por sitio, puedes estructurarlo así:

```python
from django.db import models
from cuentas.models import Usuario
from empresas.models import Sitio

class PreferenciaUsuario(models.Model):
    usuario = models.OneToOneField(Usuario, on_delete=models.CASCADE, related_name='preferencias')
    tema_oscuro = models.BooleanField(default=False)
    # Aquí puedes añadir más preferencias globales a futuro

class PreferenciaDashboard(models.Model):
    usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='layouts_dashboard')
    sitio = models.ForeignKey(Sitio, on_delete=models.CASCADE)
    layout_data = models.JSONField(default=list)

    class Meta:
        unique_together = ('usuario', 'sitio')
        db_table = 'preferencia_dashboard'
```

### 2. Crear el Endpoint (API)
Necesitas habilitar los métodos en DRF para leer (`GET`) y actualizar (`PUT`) estas preferencias.

#### Ejemplo de Vista en DRF:
```python
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

class PreferenciasUsuarioAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        sitio_id = request.query_params.get('sitio')
        
        # Obtener preferencias globales (Tema Oscuro)
        pref_global, _ = PreferenciaUsuario.objects.get_or_create(usuario=request.user)
        tema_oscuro = pref_global.tema_oscuro
        
        # Obtener layout si se pasó un sitio_id
        layout_data = []
        if sitio_id:
            pref_dash = PreferenciaDashboard.objects.filter(usuario=request.user, sitio_id=sitio_id).first()
            if pref_dash:
                layout_data = pref_dash.layout_data

        return Response({
            "tema_oscuro": tema_oscuro,
            "layout_dashboard": layout_data
        })

    def put(self, request):
        # 1. Actualizar Tema Oscuro si viene en el JSON
        if 'tema_oscuro' in request.data:
            pref_global, _ = PreferenciaUsuario.objects.get_or_create(usuario=request.user)
            pref_global.tema_oscuro = request.data['tema_oscuro']
            pref_global.save()

        # 2. Actualizar Layout si viene el sitio_id y el array de layout
        sitio_id = request.data.get('sitio_id')
        layout = request.data.get('layout_dashboard')
        
        if sitio_id and layout is not None:
            PreferenciaDashboard.objects.update_or_create(
                usuario=request.user, 
                sitio_id=sitio_id,
                defaults={'layout_data': layout}
            )
            
        return Response({"status": "Preferencias actualizadas con éxito"})
        
    def delete(self, request):
        # 3. Eliminar Preferencias de Layout (Botón Restaurar Diseño por defecto)
        # El frontend envía un DELETE para borrar las posiciones de todas las tarjetas de un usuario
        PreferenciaDashboard.objects.filter(usuario=request.user).delete()
        return Response({"status": "Layouts restaurados por defecto"})
```

### 3. Consideraciones Adicionales
- Si el frontend envía la petición `GET /api/cuentas/preferencias/?sitio=<uuid>` y recibe `layout_dashboard: []`, asumirá las posiciones por defecto de las tarjetas.
- El Frontend aplicará la clase `dark` en el tag `<html>` de Vue.js de manera automática cuando al iniciar sesión reciba `"tema_oscuro": true`.
