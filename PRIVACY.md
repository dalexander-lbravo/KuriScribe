# Política de Privacidad y Términos de Uso

**Última actualización:** 22 de Agosto de 2026  
**Versión de la Política:** 1.1.0  

Esta política describe con total transparencia técnica el funcionamiento, tratamiento de datos y comunicaciones de red realizadas por **KuriScribe** en sus diferentes modalidades (Web, Docker y Escritorio Tauri).

---

## A. Datos Procesados

Para cumplir su función de transcripción y exportación, KuriScribe procesa únicamente los siguientes datos:

1. **Identificadores y Enlaces de Vídeo:** URLs públicas de YouTube o identificadores de 11 caracteres ingresados por el usuario para consultar subtítulos nativos o descargar el flujo de audio.
2. **Contenido Textual de Transcripciones:** Pistas de subtítulos obtenidas o generadas por modelos de inferencia, así como traducciones solicitadas.
3. **Parámetros de Configuración:** Nombre personalizado del archivo o paquete ZIP, idioma de destino seleccionado y preferencias de guardado.

---

## B. Datos Almacenados y Persistencia

1. **Cero Almacenamiento Persistente en Servidor:** KuriScribe no cuenta con bases de datos, perfiles de usuario ni registros de actividad vinculados a personas. Los textos transcritos nunca se guardan en el disco del servidor.
2. **Gestión de la Clave Groq API:**
   - **Comportamiento Predeterminado:** La clave se conserva exclusivamente en memoria volátil de la sesión activa (`sessionStorage`) y se descarta automáticamente al cerrar o recargar la pestaña.
   - **Opción Voluntaria:** El usuario puede marcar explícitamente la casilla *"Recordar en este navegador"* para guardar la clave en `localStorage` de su dispositivo.
   - **Eliminación Directa:** El usuario puede pulsar en *"Borrar clave"* en cualquier momento para purgarla de forma inmediata de todos los almacenamientos locales.

---

## C. Transmisión a Proveedores y Servicios Externos

Dependiendo de la acción ejecutada por el usuario, KuriScribe puede comunicarse con los siguientes servicios de terceros:

| Proveedor / Servicio | Cuándo se comunica | Información transmitida | Almacenamiento en KuriScribe |
| --------------------- | ------------------- | ----------------------- | ---------------------------- |
| **YouTube (Google LLC)** | Al procesar cualquier enlace | Identificador del vídeo / Petición de subtítulos o audio | No se almacena |
| **Groq Cloud (Groq, Inc.)** | Solo si las Capas 1 y 2 no logran procesar el vídeo y el usuario provee una clave API | Flujo de audio fragmentado y la clave de API como cabecera `Authorization` | No se almacena |
| **Google Translate** | Solo si el usuario solicita traducir una transcripción | Fragmentos de texto a traducir | No se almacena |

> Ningún dato es transmitido a servicios de analítica invasiva, rastreadores publicitarios ni plataformas de telemetría.

---

## D. Retención Temporal en Memoria (RAM)

1. **Caché en Memoria de Archivos ZIP:** Cuando se procesa un lote de transcripciones, el archivo `.zip` resultante se genera en la memoria RAM del servidor para permitir su descarga inmediata.
2. **Tiempo de Vida (TTL) y Purgado:**
   - Los archivos en RAM se eliminan automáticamente tras **30 minutos (1800 segundos)**.
   - Existe un límite global de **150 MB** y un máximo de **20 lotes simultáneos** en RAM; al superarse, los elementos más antiguos se purgan de inmediato.
   - Si el servidor se reinicia o el proceso se detiene, toda la memoria volátil se libera instantáneamente.

---

## E. Limitaciones de Precisión y Derechos de Contenido

1. **Precisión de Modelos Automáticos:** Las transcripciones automáticas generadas por IA (Whisper) o subtítulos generados por YouTube pueden contener errores ortográficos, discrepancias de segmentación o fallas en terminología especializada. Se recomienda revisar el texto antes de usarlo en contextos críticos.
2. **Responsabilidad sobre el Contenido:** El usuario es el único responsable de contar con los derechos, permisos o autorizaciones legítimas necesarias para procesar y almacenar el contenido de acuerdo con las leyes aplicables y los [Términos de Servicio de YouTube](https://www.youtube.com/t/terms).

---

## F. Política de Actualizaciones y Cambios

- Esta política puede actualizarse para reflejar nuevas características o mejoras de seguridad.
- Los cambios entrarán en vigor a partir de su publicación en el repositorio oficial.
- La versión vigente y su historial de modificaciones se encuentran públicamente disponibles en el archivo [`PRIVACY.md`](https://github.com/dalexander-lbravo/KuriScribe/blob/main/PRIVACY.md).
