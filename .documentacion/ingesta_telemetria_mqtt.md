# Guía para el Backend: Ingesta de Telemetría (MQTT -> Django)

Este documento instruye al desarrollador de Django sobre cómo suscribirse al broker MQTT (ej. Mosquitto, RabbitMQ) para escuchar los datos reales de los sensores físicos e insertarlos en la base de datos, logrando así que el frontend pueda mostrarlos a través del *Long Polling*.

## 1. El Problema a Resolver
El Frontend actualmente consulta el endpoint `GET /api/dispositivos/<serial>/estado-actual/` cada 5 segundos buscando el último valor medido. 
Para que ese valor cambie, Django debe estar escuchando continuamente los tópicos MQTT donde publican los Nodos, extraer el Payload (usualmente en JSON), actualizar el registro del "Estado Actual" y añadir una fila al historial.

## 2. Implementación de un MQTT Worker (Listener)
Dado que Django maneja peticiones HTTP síncronas, la mejor forma de escuchar MQTT es crear un script independiente o un **Management Command** de Django que corra en segundo plano (`python manage.py run_mqtt_listener`).

### Recomendación de Librería:
Deberías instalar la librería estándar de Python para MQTT:
`pip install paho-mqtt`

### Ejemplo de Script (Worker MQTT)
```python
# ubicacion sugerida: dispositivos/management/commands/run_mqtt_listener.py
import json
import paho.mqtt.client as mqtt
from django.core.management.base import BaseCommand
from dispositivos.models import Dispositivo, DispositivoSensor
# asume que tienes un modelo para historial, por ejemplo:
# from telemetria.models import HistorialSensor 

class Command(BaseCommand):
    help = 'Inicia el listener de MQTT para guardar telemetría'

    def on_connect(self, client, userdata, flags, rc):
        self.stdout.write(self.style.SUCCESS(f"Conectado a MQTT Broker (rc={rc})"))
        # Suscribirse al tópico comodín de todos los dispositivos
        client.subscribe("telemetrics/v1/+/+/+/+/telemetria")

    def on_message(self, client, userdata, msg):
        try:
            payload = json.loads(msg.payload.decode())
            # topic_parts = msg.topic.split('/') 
            # ej topic: telemetrics/v1/empresaA/sitioB/zonaC/SN-RF-101/telemetria
            # serial = topic_parts[5]
            
            # 1. Extraer serial desde el payload o el tópico
            serial = payload.get('serial')
            
            # 2. Buscar dispositivo en la BD
            dispositivo = Dispositivo.objects.filter(serial=serial).first()
            if not dispositivo:
                return # Dispositivo no registrado

            # 3. Guardar las métricas
            # El payload usualmente vendrá como: {"TEMPERATURA": 24.5, "HUMEDAD": 60, "BATERIA": 95}
            for codigo_sensor, valor in payload.items():
                if codigo_sensor == 'serial': continue
                
                # Opcional: Validar que el dispositivo tenga asociado este sensor
                sensor = DispositivoSensor.objects.filter(dispositivo=dispositivo, tipo_sensor__codigo=codigo_sensor).first()
                
                if sensor:
                    # ---> AQUI SE GUARDA EL DATO EN TU BASE DE DATOS
                    # HistorialSensor.objects.create(dispositivo_sensor=sensor, valor=valor)
                    pass

        except Exception as e:
            self.stderr.write(self.style.ERROR(f"Error procesando mensaje: {e}"))

    def handle(self, *args, **options):
        client = mqtt.Client()
        client.on_connect = self.on_connect
        client.on_message = self.on_message

        # Configurar auth si el broker lo requiere
        # client.username_pw_set("user", "pass")
        
        # Conectar al broker de Mosquitto
        client.connect("localhost", 1883, 60)
        
        self.stdout.write("Escuchando mensajes MQTT...")
        client.loop_forever()
```

## 3. ¿Cómo exponer esto al Frontend?
Una vez que el Worker de arriba esté guardando el historial continuamente en la base de datos, asegúrate de que tu vista DRF `estado_actual_dispositivo` (que responde a `GET /api/dispositivos/<serial>/estado-actual/`) vaya a la base de datos, busque el **último** registro insertado por este worker para cada código de sensor, y devuelva la estructura JSON esperada por el Frontend.
