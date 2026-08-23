# Política de Seguridad de KuriScribe

## 1. Versiones Soportadas

Actualmente proporcionamos actualizaciones de seguridad y corrección de vulnerabilidades para las siguientes versiones activas del proyecto:

| Versión | Soportada          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0.0 | :x:                |

---

## 2. Reporte Responsable de Vulnerabilidades

Si descubres una vulnerabilidad potencial o un problema de seguridad en KuriScribe (en el servidor Flask, la aplicación de escritorio Tauri, las políticas de contenido o la gestión de claves), te solicitamos que **no divulgues públicamente la información antes de permitir una corrección coordinada**.

### Procedimiento de Contacto

1. **Canal Oficial:** Envía un correo electrónico detallado a:
   📧 **`dalexander.lbravo@gmail.com`**
2. **Información a Incluir:**
   - Tipo de vulnerabilidad identificada (ej. Cross-Site Scripting, Path Traversal, Inyección, Exposición de Datos).
   - Pasos reproducibles detallados o código de prueba de concepto (PoC).
   - Componente y plataforma afectada (Web, Docker, Windows Desktop).
   - Evaluación del impacto estimado.

---

## 3. Proceso de Respuesta y Compromiso

- **Recepción y Acuse:** Confirmaremos la recepción del reporte en un plazo razonable tras su envío.
- **Validación y Mitigación:** Evaluaremos la reproducibilidad técnica y desarrollaremos una solución en una rama privada.
- **Publicación:** Una vez publicado el parche correctivo en la rama principal y generado el nuevo release, se te reconocerá en las notas de la versión (a menos que prefieras permanecer anónimo).

---

## 4. Alcance (Scope)

### Dentro del Alcance
- Código fuente en el repositorio oficial [`dalexander-lbravo/KuriScribe`](https://github.com/dalexander-lbravo/KuriScribe).
- Endpoints del servidor Flask (`server.py`) y deserialización de datos.
- Empaquetado y aislamiento en Tauri (`src-tauri`).
- Flujos de autenticación efímera con APIs de terceros.

### Fuera del Alcance
- Ataques de denegación de servicio distribuidos (DDoS) contra servicios de terceros (YouTube, Groq, Google).
- Vulnerabilidades inherentes a librerías de terceros upstream que ya cuentan con reportes públicos conocidos sin parche disponible.
- Ingeniería social contra los mantenedores o usuarios del proyecto.
