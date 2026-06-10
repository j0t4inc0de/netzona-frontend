# Guía para el Backend: Seguridad y Jerarquías de Roles (Tenancy)

Este documento instruye al desarrollador del backend en Django sobre cómo debe filtrar la información en las peticiones `GET` dependiendo de quién esté autenticado, previniendo así filtraciones de datos entre empresas o trabajadores no autorizados.

## 1. El Concepto de Multitenancy y Roles
Tu aplicación maneja 3 tipos de roles:
1. **Técnico Netzona (`tecnico`)**: El súper administrador. Puede ver a **todas** las Empresas, todos los Sitios y todos los Dispositivos del mundo.
2. **Cliente Administrador (`admin`)**: El dueño o gerente de una Empresa en específico. Puede ver **todos** los sitios y dispositivos de **su propia Empresa**, pero jamás los de otras empresas.
3. **Cliente Trabajador (`trabajador`)**: El operario de terreno. Pertenece a una Empresa pero **sólo puede ver los Sitios específicos** que el `admin` le ha autorizado explícitamente a través del panel.

## 2. Implementación de los Filtros en los Endpoints GET

Cuando el Frontend haga llamadas de tipo lista (ej: `GET /api/empresas/sitios/`), es OBLIGATORIO que Django Rest Framework no haga un simple `Sitio.objects.all()`. Debes sobrescribir el método `get_queryset` de cada ViewSet según el usuario.

### Ejemplo de Filtro para Sitios (`SitioViewSet`)
```python
from rest_framework import viewsets
from empresas.models import Sitio

class SitioViewSet(viewsets.ModelViewSet):
    # ... serializers y permissions ...

    def get_queryset(self):
        user = self.request.user
        
        # 1. Si es técnico Netzona, ve todo el sistema
        if user.rol == 'tecnico':
            return Sitio.objects.all()
            
        # 2. Si es Admin de un cliente, ve solo los sitios de su Empresa
        elif user.rol == 'admin':
            return Sitio.objects.filter(empresa=user.empresa_id)
            
        # 3. Si es un Trabajador, ve ÚNICAMENTE los sitios vinculados a su cuenta
        elif user.rol == 'trabajador':
            # Asumiendo que existe una relación ManyToMany Usuario<->Sitio para accesos
            # que se llena cuando el admin hace PUT /api/cuentas/usuarios/<id>/ con permisos_ids
            return Sitio.objects.filter(usuarios_con_acceso=user)
        
        # Si el usuario no tiene rol o es inválido
        return Sitio.objects.none()
```

### 3. Validación de Creación (POST) y Edición (PUT/DELETE)

No solo debes proteger lo que **ven** (GET), sino también lo que pueden **hacer**.

**Si el Frontend intenta hacer `POST /api/dispositivos/equipos/`:**
- **Técnicos**: Pueden crear el equipo asociado a la empresa que ellos quieran pasándole el ID.
- **Admin / Trabajador**: JAMÁS deberían tener permiso de ejecutar este endpoint. Debes protegerlo con un `PermissionClass` personalizado en DRF que bloquee la llamada si el rol no es `tecnico`.

**Si el Frontend intenta hacer `PUT /api/cuentas/usuarios/<id>/` (Editar permisos de trabajador):**
- **Admin**: Solo puede editar usuarios (trabajadores) que pertenezcan a su **misma Empresa**.
- En la vista debes validar:
```python
def update(self, request, *args, **kwargs):
    user_to_edit = self.get_object()
    
    if request.user.rol == 'admin' and user_to_edit.empresa_id != request.user.empresa_id:
        return Response({"error": "No puedes modificar trabajadores de otra empresa"}, status=403)
        
    return super().update(request, *args, **kwargs)
```

## Resumen para el Backend
1. Jamás confíes en que el frontend no pedirá un ID de otra empresa.
2. Cada `get_queryset` de `DispositivoViewSet`, `SitioViewSet` y `UsuarioViewSet` debe estar condicionado por un `if user.rol == ...`.
3. Un Trabajador jamás debe recibir datos (en `dashboard` o `historial`) de un nodo cuyo Sitio no esté dentro de su lista blanca de permisos (`permisos_ids`).
