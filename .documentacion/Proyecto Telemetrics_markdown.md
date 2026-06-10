## **Proyecto Telemetrics Netzona** 

Soluciones Tecnologicas Netzona Spa , es una empres de la región del Biobio la cual crea soluciones en distintos ámbitos de la tecnología, ofrecemos servicios de Hosting, accesorias, instalación de sistemas de CCTV, internet rural, entre otros servicios. 

Para esta ocacion el equipo de Netzona y su director técnico Christian Orellana, buscan el desarrollo de una plataforma para visualización de datos para sus clientes. Esta plataforma llamada Telemetrics. 

El objetivo principal de esta plataforma es la visualización de manera intuitiva de los datos generados por una gama de sensores en terreno. 

¿Que necesitamos? 

Una plataforma Dashboard que permita ver los datos en tiempo real, de manera sencilla para el usuario final, y escalable. 

Nuestros clientes son de distintos rubros, por lo cual nos gustaría generar interfaces o estilos de dashboard distintos y acorde a lo que se necesita. 

Caso 1: Cliente del área agrícola necesita monitoreo de sus sensores en un predio de X cantidad de hectáreas, la visualización que debe tener necesita un mapa del fundo (Mapa genérico o tipo 3d ), donde se indica que sensores tiene y en que punto en especifico con algún tipo de Target, ademas en la vista de la Dashboard debe ver los datos en tiempo real a modo de widgets. 

De manera opcional y dependiendo de la cantidad de predios que necesite, un listado en la zona lateral derecha donde indique que fundo esta viendo. 

Caso 2: Cliente del área de las Radiocomunicaciones, necesita monitorizar las repetidoras VHF, las cuales se encuentra generalmente en cerros a lo largo de la region, los datos que necesita son de voltajes, potencias, puerta abierta, en algunos casos un pulsador o switch que active algo de manera remota, ademas de tener datos del clima o pronósticos de la semana. Así como el caso 1 se necesita un menu lateral que cambie la dashboard dependiendo del cerro que esta viendo. Ademas de un pequeño mapa con la coordenada. 

## Usuarios 

El sistema debe contar principalmente con 3 tipos de usuarios: 

1-Usuario Técnico Netzona: Capacidad de agregar nuevos usuarios para clientes, agregar widget para lectura de sensores, el cliente contrata el servicio y el Tecnico luego de instalar los nodos, se los cargue al usuario. 

2-Cliente Admin: la dashboar que utiliza el cliente final, se le da una función admin para que 

agregue o elimine trabajadores que puedan ver la plataforma, por ejemplo, el trabajado 1 solo puede ver los datos de el predio A, y el trabajado 2 puede ver los datos tanto del Predio A como B, El Cliente admin puede ver todos libremente. Y crear los accesos a los trabajadores. 

3-Cliente Trabajador: Solo puede visualizar los paneles que el usuario Cliente Admin le otorga. 

Todo esto con el fin de mantener una jerarquizar y privacidad de los datos. 

¿Donde Montar todo el sistema? 

Actualmente Netzona cuenta con una Gama de servidores, para este proyecto se dara acceso a uno de esos servidores. Para instalar los servicios necesarios mediante Dockers o de manera directa, donde el equipo de Netzona se encargara de enturar los puertos y lo que se necesite por parte de los desarrolladores. 

Hoy en dia para hacer pruebas se tiene un Servicio MQTT con Mosquitto, el cual recibe los mensajes de los nodos y lo envía a Node-RED para crear un archivo JSON, y enviar a InfluxDB como base de datos que almacena los datos. 

Solicitamos a los desarrolladores la creación de un estándar para el envió de datos: 

Cada Nodo sera grabado con un Numero Serial y un Modelo, los cuales son los datos necesarios para agregar el nodo al dashboard del cliente.  Esto para Nodos con Wifi, o NB-iot 

En el caso de los módulos con Lora, Estos envían datos y sus credenciales mediante DEV UI, a un servicio dentro de nuestro servidor, el cual se encarga de anexar dichos nodos. Posteriormente el dato de ese sensor, da un salto a la dashboard, con su tópico asociado. 

El principal Objetivo es Estandarizar el envió y recepción de datos. 

El equipo de Netzona, solicita propuesta de implementación, las necesidades del desarrollador, retroalimentación y seguridad. 

PARTE 2: Mayo 25 de 2026 

Acorde a lo conversado en la reunión el equipo de desarrollo levantara el servidor con los servicios necesarios dentro de un Contenedor Dockers, con el objetivo de segmentar la red interna (ya que el servidor levantara otros servicios) 

Se deberá generar un pequeño reporte el cual debe contener lo siguiente: 

-Sistemas implementados 

-Direccionamiento IP y puertos utilizados 

-Credenciales de seguridad implementadas. 

-propuestas de mejora. 

El payload de los equipos conectados mediante redes Wifi /Nbiot sera el siguiente 

**==> picture [483 x 93] intentionally omitted <==**

Este se puede ajustar dentro de cada dispositivo creado, ademas para establecer la conexión debera ser con un Usuario y contraseña, para evitar que cualquier dispositivo se conecte. 

Como propuesta a futuro, que la plataforma de monitoreo o dashboard en su sección para técnicos, sea escalable para una APP para smatphones donde un técnico anexe nodos a usuarios específicos para agilizar el método. 

