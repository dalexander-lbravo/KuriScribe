# Modelo de Seguridad y Amenazas de KuriScribe

**Fecha de Revisión:** Agosto de 2026  
**Documento Técnico:** SM-1.0.0  

---

## 1. Activos Protegidos

1. **Credenciales y Secretos del Usuario:** Claves de API de Groq Cloud proporcionadas voluntariamente para inferencia Whisper.
2. **Privacidad del Contenido:** Textos transcritos y audios descargados efímeramente.
3. **Integridad del Sistema de Archivos Local:** Protección del disco del usuario frente a escrituras no autorizadas o saltos de directorio.
4. **Disponibilidad del Servicio:** Resistencia frente a peticiones concurrentes masivas o abusos que agoten la memoria RAM del servidor.

---

## 2. Superficie de Ataque y Amenazas Consideradas

| Vector / Amenaza | Riesgo Identificado | Mitigación Implementada |
| ---------------- | ------------------- | ------------------------ |
| **Path Traversal & Zip Slip** | Intento de guardar archivos con nombres como `../../etc/passwd` o dentro de carpetas restringidas del sistema. | Función `sanitize_filename` con sanitización iterativa de `..`, eliminación de barras `/` `\\`, bytes nulos `\x00` y límite de 80 caracteres. |
| **Clickjacking** | Incrustación del frontend en un `iframe` malicioso para inducir clics involuntarios. | Cabecera `X-Frame-Options: DENY` y directiva `frame-ancestors 'none'` en Content Security Policy. |
| **Agotamiento de Memoria (DoS en ZIP)** | Peticiones masivas para saturar la memoria RAM con archivos ZIP grandes. | Límite individual de 50 MB por ZIP, tope de 150 MB en caché global de RAM, límite de 50 vídeos por lote (`MAX_BATCH_SIZE`) y purgado automático con TTL de 30 minutos. |
| **Abuso de Cuota / Inundación de Peticiones** | Saturación de endpoints de transcripción y traducción. | Rate Limiting con `Flask-Limiter` por IP con backend configurable en memoria o Redis (`RATELIMIT_STORAGE_URI`). |
| **Filtración de Secretos o Rutas en Logs** | Exposición de trazas internas del sistema operativo o tokens de API en respuestas de error. | Captura global de excepciones (`handle_global_exception`), saneamiento de mensajes de error devueltos al cliente y supresión de rutas absolutas en respuestas nativas. |
| **Cross-Origin Resource Sharing (CORS)** | Peticiones no autorizadas desde sitios web de terceros arbitrarios. | Lista blanca explícita de orígenes permitidos (`ALLOWED_ORIGINS`) sin comodín `*`. |
| **Aislamiento en Escritorio (Tauri)** | Ejecución de diálogos `Tkinter` fuera del entorno de escritorio del usuario. | Detección estricta de `IS_DESKTOP_MODE`. En entornos web o Docker, los endpoints nativos devuelven `403 Forbidden`. |

---

## 3. Amenazas Fuera del Alcance

- **Compromiso Físico o Malware en el Dispositivo Local:** Si la máquina del usuario está infectada con keyloggers o malware de nivel kernel, la memoria del proceso local o el almacenamiento del navegador podrían verse comprometidos.
- **Interrupciones o Cambios de API en Terceros:** Cambios en la arquitectura de YouTube, Groq Cloud o Google Translate que afecten temporalmente la extracción.

---

## 4. Matriz de Riesgos Residuales

| Riesgo Residual | Nivel | Justificación y Manejo |
| --------------- | ----- | ----------------------- |
| **Dependencia de la biblioteca yt-dlp** | Bajo-Medio | yt-dlp se actualiza frecuentemente para adaptarse a los cambios de YouTube. El proyecto mantiene rangos compatibles en `requirements.txt`. |
| **Ejecutable sin firma digital EV** | Bajo | Los binarios para Windows son compilados abiertamente con NSIS/Tauri y distribuidos con sumas de verificación SHA-256 en GitHub Releases. |
| **Rate Limiter local en memoria** | Bajo | Adecuado para instancias individuales. Para despliegues multi-instancia en Docker Swarm/Kubernetes, se debe configurar la variable `RATELIMIT_STORAGE_URI=redis://...`. |

---

## 5. Directrices para Auditorías Externas

El código fuente completo es auditable de forma independiente en [GitHub](https://github.com/dalexander-lbravo/KuriScribe). Cualquier investigador de seguridad puede verificar los controles, ejecutar la suite de pruebas unitarias (`python -m unittest discover -s tests`) y revisar los pipelines de CI/CD.
