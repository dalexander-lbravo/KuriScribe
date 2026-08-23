# KuriScribe 🦔🎧

<div align="center">

![KuriScribe - Mascota oficial](src/assets/hedgehog.jpg)

**Plataforma web y de escritorio para la transcripción inteligente de vídeos de YouTube a texto, mediante subtítulos nativos y aceleración en la nube con Whisper Turbo.**

[![Demo Web](https://img.shields.io/badge/Demo_Web-Live-black?style=for-the-badge&logo=vercel&logoColor=white)](https://kuri-scribe-app.vercel.app/)
[![Desktop Release](https://img.shields.io/badge/Release-v1.0.0-0078D4?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/dalexander-lbravo/KuriScribe/releases/latest)
[![AI Engine](https://img.shields.io/badge/AI_Engine-Whisper_Turbo-F05A28?style=for-the-badge&logo=groq&logoColor=white)](https://groq.com)
[![Docker Container](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)
[![React](https://img.shields.io/badge/React-19.2-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![Tauri](https://img.shields.io/badge/Tauri-v2-24C8D8?style=for-the-badge&logo=tauri&logoColor=white)](https://tauri.app)
[![Powered by uv](https://img.shields.io/badge/Powered_by-uv-DE5FE9?style=for-the-badge&logo=astral)](https://github.com/astral-sh/uv)

*Desarrollado y creado por **[Alexander Luyo](https://github.com/dalexander-lbravo)** y **[Belén Tesore](https://github.com/Belen-Tesore)***

</div>

---

## 🌟 Características principales

- ⚡ **Capa 1 • Extracción nativa directa en 2s:** Obtención inmediata de subtítulos oficiales y pistas autogeneradas de YouTube sin consumo de recursos de cómputo.
- 🧠 **Capa 2 • Inferencia autónoma local con Whisper:** Motor integrado con `faster-whisper` y `ctranslate2` con detección automática de GPU NVIDIA (CUDA) o CPU optimizada en int8/float16.
- ☁️ **Capa 3 • Aceleración en la nube con Whisper Turbo:** Conexión con *Whisper Large V3 Turbo* en Groq Cloud a velocidad ultrarrápida para transcribir audios complejos mediante API Key gratuita.
- 📦 **Procesamiento por lotes y listas de reproducción:** Transcripción concurrente multihilo con soporte para listas de reproducción y emisión de eventos en tiempo real (*Server-Sent Events*).
- 🗂️ **Renombrado personalizado y empaquetado ZIP en RAM:** Asignación de nombres individuales a cada archivo y compresión `.zip` en memoria volátil sin persistencia en disco del servidor.
- 🖥️ **Multiplataforma y escritorio nativo:** Disponible como SPA Web moderna, contenedor Docker, comando CLI mediante NPX, ejecución con `uv` y aplicación nativa de escritorio compilada con Tauri v2.
- 🛡️ **Seguridad por diseño:** Validación estricta de entradas, mitigación de *Path Traversal* y *Zip Slip*, Content Security Policy restrictiva, protección contra Clickjacking (`X-Frame-Options: DENY`), y Rate Limiting configurable.

---

## 🚀 Formas de ejecución y despliegue

#### 💻 Opción 1: Descarga directa e instalación rápida (Solo Windows)

Si solo deseas usar la aplicación ejecutable `.exe` sin configurar un entorno de desarrollo, puedes descargarla e instalarla directamente desde la consola:

**Mediante PowerShell:**
```powershell
Invoke-WebRequest -Uri "https://github.com/dalexander-lbravo/KuriScribe/releases/latest/download/KuriScribe_1.0.0_x64-setup.exe" -OutFile "KuriScribe_Setup.exe" ; .\KuriScribe_Setup.exe
```

**Mediante cURL (PowerShell / CMD):**
```cmd
curl -L -o KuriScribe_Setup.exe "https://github.com/dalexander-lbravo/KuriScribe/releases/latest/download/KuriScribe_1.0.0_x64-setup.exe" && .\KuriScribe_Setup.exe
```

**Verificación de Integridad (SHA-256):**
```powershell
Get-FileHash .\KuriScribe_Setup.exe -Algorithm SHA256
```

> [!NOTE]
> **Aviso sobre la instalación en Windows (SmartScreen):**
> Debido a que KuriScribe es un proyecto de software libre e independiente, el ejecutable `.exe` no cuenta con una firma digital comercial de pago. Al ejecutarlo, Windows SmartScreen podría mostrar un aviso de *"Editor desconocido"*.
> - **Para instalar el ejecutable:** Haz clic en **"Más información"** y luego en **"Ejecutar de todas formas"**.
> - **Transparencia e integridad:** El código fuente está disponible públicamente para su inspección independiente en GitHub. Si prefieres omitir el instalador gráfico, puedes utilizar Docker, la versión web o compilarlo localmente con Tauri.

---

### Opción 2: Entorno de desarrollo local (Web)

#### 1. Clonar el repositorio
```powershell
git clone https://github.com/dalexander-lbravo/KuriScribe.git
cd KuriScribe
```

#### 2. Instalar dependencias del cliente y del entorno virtual con `uv`
```powershell
pnpm install
uv venv
uv pip install -r requirements.txt
```

#### 3. Iniciar el entorno en modo concurrente (Vite + Flask en .venv)
```powershell
pnpm dev
```
Accede desde tu navegador en: `http://localhost:5173`.

---

### Opción 3: Ejecución instantánea con `uv` (Sin instalar dependencias manualmente)

Si utilizas [`uv`](https://github.com/astral-sh/uv), puedes iniciar el backend al instante en un entorno virtual aislado administrado automáticamente:

#### Iniciar servidor backend
```powershell
uv run server.py
```

#### O iniciar en modo escritorio (abriendo el navegador)
```powershell
uv run desktop.py
```

---

### Opción 4: Ejecución mediante contenedor Docker

Si dispones de Docker instalado, puedes levantar la aplicación completa en un contenedor aislado:

#### Usando Docker Compose (Recomendado)
```powershell
docker compose up --build -d
```

#### Usando Docker CLI directamente
```bash
docker build -t kuriscribe . && docker run -d -p 3000:3000 --name kuriscribe-app kuriscribe
```

---

### Opción 5: Ejecución rápida mediante CLI / NPX

Si tienes Node.js instalado, puedes lanzar el servidor local de desarrollo directamente:

- **Ejecución directa vía NPX**:
  ```bash
  npx kuriscribe
  ```

- **Ejecución desde el repositorio local**:
  ```bash
  node ./bin/kuriscribe.js
  ```

---

### Opción 6: Aplicación de escritorio nativa (Tauri v2 + Rust)

Para compilar la aplicación de escritorio nativa en Windows:

#### Modo desarrollo con hot-reload
```powershell
pnpm tauri dev
```

#### Compilación del instalador ejecutable de Windows (.exe / .msi)
```powershell
pnpm tauri:build
```
El instalador compilado se generará en la ruta:
`src-tauri/target/release/bundle/nsis/KuriScribe_1.0.0_x64-setup.exe`

---

## 🔑 Configuración de Groq API (Opcional)

Para transcribir vídeos que **no disponen de subtítulos en YouTube**:

1. Obtén tu clave gratuita en [console.groq.com/keys](https://console.groq.com/keys) (no requiere tarjeta de crédito).
2. Introdúcela directamente en el modal **Groq Key** de la aplicación. Por defecto se conserva solo en memoria de sesión (`sessionStorage`), con la opción voluntaria de recordarla en `localStorage`.

---

## 🔒 Privacidad, Seguridad y Modelo de Amenazas

KuriScribe aplica el principio de minimización de datos:

- **Sin almacenamiento en servidor:** Ningún texto ni audio se almacena persistentemente en bases de datos.
- **Transmisión a Terceros:** La comunicación se limita a YouTube (subtítulos/audio), Groq Cloud (inferencia Whisper cuando se proporciona API Key) y Google Translate (traducción opcional).
- **Documentos Técnicos:**
  - [Política de Privacidad y Términos de Uso](PRIVACY.md)
  - [Política de Reporte de Seguridad](SECURITY.md)
  - [Modelo de Amenazas y Evaluación de Riesgos](docs/security-model.md)

---

## 👥 Créditos y autores

Proyecto conceptualizado, diseñado y programado por:

- **[Alexander Luyo](https://github.com/dalexander-lbravo)** — Arquitectura de software, backend en Flask, servicios de transcripción y seguridad.
- **[Belén Tesore](https://github.com/Belen-Tesore)** — Diseño visual, experiencia de usuario (UX/UI) y dirección de proyecto.

---

## 📄 Licencia

Este proyecto está distribuido bajo la licencia **MIT**. Consulta el archivo [LICENSE](LICENSE) para más información.
