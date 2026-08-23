"""
Servidor Flask de KuriScribe.

Provee la API REST y los flujos Server-Sent Events (SSE) para:
- Transcripción individual y por lotes (concurrente) de vídeos de YouTube.
- Detección de hardware y gestión de aceleración local (CUDA/CPU).
- Traducción dinámica multilingüe de transcripciones y segmentos.
- Generación y descarga en memoria de archivos ZIP comprimidos.
- Integración nativa de diálogos del sistema operativo en modo de escritorio.
"""

import os
import re
import io
import sys
import time
import json
import uuid
import random
import zipfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from flask import Flask, request, jsonify, send_file, Response, stream_with_context
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

from services.common_utils import (
    sanitize_filename,
    extract_video_id,
    is_valid_uuid,
    translate_text,
    translate_segments,
    LANGUAGE_NAMES,
)
from services.layer1_subtitles import fetch_layer1_subtitles
from services.layer2_whisper import (
    fetch_layer2_local_whisper,
    detect_whisper_hardware,
)
from services.layer3_groq import transcribe_with_groq_whisper

# Rutas base con soporte para ejecutables congelados (PyInstaller sys._MEIPASS)
if getattr(sys, 'frozen', False) and hasattr(sys, '_MEIPASS'):
    BASE_DIR = sys._MEIPASS
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

DIST_DIR = os.path.join(BASE_DIR, 'dist')

app = Flask(__name__, static_folder=DIST_DIR if os.path.exists(DIST_DIR) else None)
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024  # Límite de 10 MB por petición

# Detección estricta de entorno de escritorio (Tauri / desktop.py / Binario congelado)
IS_DESKTOP_MODE = (
    getattr(sys, 'frozen', False)
    or os.environ.get('DESKTOP_MODE', '').lower() in ('true', '1', 'yes')
    or os.environ.get('TAURI_ENV', '').lower() in ('true', '1', 'yes')
)


# -----------------------------------------------------------------------------
# Configuración de CORS Restringido
# -----------------------------------------------------------------------------
ALLOWED_ORIGINS = [
    origin.strip() for origin in os.environ.get(
        'ALLOWED_ORIGINS',
        'http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000,https://kuri-scribe-app.vercel.app,tauri://localhost,http://tauri.localhost'
    ).split(',') if origin.strip()
]

CORS(app, resources={r"/api/*": {"origins": ALLOWED_ORIGINS}}, supports_credentials=True)

# -----------------------------------------------------------------------------
# Rate Limiting (Protección contra abuso DoS / Saturación de API)
# -----------------------------------------------------------------------------
RATELIMIT_STORAGE = os.environ.get('RATELIMIT_STORAGE_URI', 'memory://')

# En entorno local/escritorio o cuando se desactiva explícitamente, se utilizan cuotas muy amplias para no bloquear al usuario
is_rate_limit_disabled = IS_DESKTOP_MODE or os.environ.get('DISABLE_RATE_LIMIT', '').lower() in ('true', '1', 'yes')
default_limits = ["10000 per hour", "2000 per minute"] if is_rate_limit_disabled else ["300 per hour", "60 per minute"]

limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=default_limits,
    storage_uri=RATELIMIT_STORAGE,
)

@app.errorhandler(429)
def handle_ratelimit_exceeded(e):
    """Manejador global para 429 RateLimitExceeded para devolver siempre JSON estructurado en lugar de HTML crudo."""
    return jsonify({
        'error': 'Has alcanzado el límite temporal de peticiones al servidor. Por favor, espera unos momentos antes de reintentar.',
        'errorType': 'RATE_LIMIT_EXCEEDED'
    }), 429

@app.after_request
def add_security_headers(response):
    """Agrega cabeceras de seguridad estrictas a todas las respuestas."""
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    response.headers['Permissions-Policy'] = 'camera=(), microphone=(), geolocation=(), payment=()'
    
    # CSP restrictiva sin permisos innecesarios ni orígenes no utilizados
    response.headers['Content-Security-Policy'] = (
        "default-src 'self'; "
        "script-src 'self'; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "img-src 'self' data: https: asset: tauri: blob:; "
        "media-src 'self' https://d8j0ntlcm91z4.cloudfront.net https: blob: data:; "
        "font-src 'self' https://fonts.gstatic.com data:; "
        "connect-src 'self' http://localhost:* http://127.0.0.1:* https://api.groq.com https://*.youtube.com https://*.googlevideo.com https://translate.googleapis.com; "
        "frame-ancestors 'none'; "
        "base-uri 'self'; "
        "form-action 'self';"
    )

    # HSTS habilitado condicionalmente en HTTPS / Producción
    if request.is_secure or os.environ.get('ENABLE_HSTS', 'false').lower() in ('true', '1', 'yes'):
        response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'

    return response


# Almacenamiento en memoria para archivos ZIP con límites de seguridad
ZIP_CACHE = {}
MAX_ZIP_BYTES = 50 * 1024 * 1024          # 50 MB por archivo ZIP individual
MAX_TOTAL_CACHE_BYTES = 150 * 1024 * 1024  # 150 MB máximo total en RAM
MAX_ZIP_CACHE_ENTRIES = 20                 # Máximo de lotes retenidos
ZIP_TTL_SECONDS = 1800                     # 30 minutos de retención

# Parámetros de concurrencia
MAX_WORKERS = 4
MAX_BATCH_SIZE = 50

def clean_expired_cache():
    """Elimina archivos ZIP caducados o purga por volumen de memoria RAM."""
    now = time.time()
    for k in list(ZIP_CACHE.keys()):
        if now - ZIP_CACHE[k].get('created', 0) > ZIP_TTL_SECONDS:
            del ZIP_CACHE[k]
    
    if len(ZIP_CACHE) > MAX_ZIP_CACHE_ENTRIES:
        sorted_keys = sorted(ZIP_CACHE.keys(), key=lambda x: ZIP_CACHE[x].get('created', 0))
        for k in sorted_keys[:len(ZIP_CACHE) - MAX_ZIP_CACHE_ENTRIES]:
            if k in ZIP_CACHE:
                del ZIP_CACHE[k]

    total_bytes = sum(len(v.get('data', b'')) for v in ZIP_CACHE.values())
    if total_bytes > MAX_TOTAL_CACHE_BYTES:
        sorted_keys = sorted(ZIP_CACHE.keys(), key=lambda x: ZIP_CACHE[x].get('created', 0))
        for k in sorted_keys:
            if total_bytes <= MAX_TOTAL_CACHE_BYTES or k not in ZIP_CACHE:
                break
            total_bytes -= len(ZIP_CACHE[k].get('data', b''))
            del ZIP_CACHE[k]

def parse_input_items(raw_input):
    """Parsea entradas individuales, listas o listas de reproducción de YouTube."""
    if not raw_input:
        return []

    videos = []

    if isinstance(raw_input, list):
        for entry in raw_input[:MAX_BATCH_SIZE]:
            if isinstance(entry, dict):
                url = str(entry.get('url', ''))
                c_name = sanitize_filename(entry.get('customName', '')) if entry.get('customName') else None
                vid = extract_video_id(url)
                if vid:
                    videos.append({
                        'videoId': vid,
                        'url': f"https://www.youtube.com/watch?v={vid}",
                        'customName': c_name,
                        'title': c_name or f"Video_{vid}",
                    })
            elif isinstance(entry, str):
                vid = extract_video_id(entry)
                if vid:
                    videos.append({
                        'videoId': vid,
                        'url': f"https://www.youtube.com/watch?v={vid}",
                        'customName': None,
                        'title': f"Video_{vid}",
                    })
        return videos[:MAX_BATCH_SIZE]

    if isinstance(raw_input, str):
        raw_str = raw_input.strip()
        lines = [line.strip() for line in raw_str.splitlines() if line.strip()]

        if not lines and ',' in raw_str:
            lines = [part.strip() for part in raw_str.split(',') if part.strip()]

        if not lines and ' ' in raw_str and not raw_str.startswith(('http://', 'https://')):
            lines = [token.strip() for token in raw_str.split() if token.strip()]

        if not lines and raw_str:
            lines = [raw_str]

        seen = set()
        for line in lines[:MAX_BATCH_SIZE]:
            line = line.strip()
            if not line:
                continue
            
            c_name = None
            raw_url = line

            if '|' in line:
                parts = line.split('|', 1)
                raw_url = parts[0].strip()
                c_name = sanitize_filename(parts[1].strip())
            elif ';' in line and not line.startswith('http'):
                parts = line.split(';', 1)
                raw_url = parts[0].strip()
                c_name = sanitize_filename(parts[1].strip())

            if 'list=' in raw_url:
                try:
                    import yt_dlp
                    ydl_opts_playlist = {
                        'extract_flat': True,
                        'skip_download': True,
                        'quiet': True,
                        'no_warnings': True,
                    }
                    with yt_dlp.YoutubeDL(ydl_opts_playlist) as ydl:
                        p_info = ydl.extract_info(raw_url, download=False)
                        if 'entries' in p_info:
                            for e in p_info['entries'][:MAX_BATCH_SIZE]:
                                if len(videos) >= MAX_BATCH_SIZE:
                                    break
                                p_vid = e.get('id')
                                p_title = e.get('title')
                                if p_vid and p_vid not in seen:
                                    seen.add(p_vid)
                                    videos.append({
                                        'videoId': p_vid,
                                        'url': f"https://www.youtube.com/watch?v={p_vid}",
                                        'customName': None,
                                        'title': sanitize_filename(p_title) if p_title else f"Video_{p_vid}"
                                    })
                except Exception as pl_err:
                    print(f"Aviso al extraer lista de reproducción ({raw_url}): {pl_err}")

            vid = extract_video_id(raw_url)
            if vid and vid not in seen:
                seen.add(vid)
                videos.append({
                    'videoId': vid,
                    'url': f"https://www.youtube.com/watch?v={vid}",
                    'customName': c_name,
                    'title': c_name or f"Video_{vid}"
                })

    return videos[:MAX_BATCH_SIZE]

def generate_txt_content(item, index=None):
    """Genera únicamente el texto plano de la transcripción, sin metadata ni marcas de tiempo."""
    full_text = (item.get('fullText') or '').strip()
    if not full_text and item.get('segments'):
        full_text = ' '.join(s.get('text', '') for s in item['segments'] if s.get('text')).strip()
    return full_text

# -----------------------------------------------------------------------------
def process_single_video_task(vid_info, groq_api_key, target_lang='auto', task_index=0, on_progress=None):
    """Tarea ejecutada por el hilo para transcribir un único vídeo con emisión de progreso por capas."""
    if task_index > 0:
        time.sleep(random.uniform(0.25, 0.6))

    vid = vid_info['videoId']
    custom_name = vid_info.get('customName')
    v_start = time.time()
    res_item = {
        'videoId': vid,
        'videoUrl': vid_info['url'],
        'videoTitle': custom_name or vid_info.get('title', f"Video_{vid}"),
        'customName': custom_name,
        'status': 'transcribing',
        'currentStep': 1,
        'stepMessage': 'Paso 1: Consultando subtítulos nativos de YouTube...',
    }

    if on_progress:
        on_progress(1, 'Paso 1: Consultando subtítulos nativos de YouTube...')

    try:
        allow_fallback = os.environ.get('ALLOW_SERVER_KEY_FALLBACK', 'true').lower() in ('true', '1', 'yes')
        has_groq_key = bool((groq_api_key or '').strip()) or (bool(os.environ.get('GROQ_API_KEY')) if allow_fallback else False)

        # Si el usuario cuenta con API Key de Groq, ejecutar DIRECTAMENTE la Capa 3 (Groq Cloud Whisper Turbo)
        if has_groq_key:
            res_item['currentStep'] = 3
            res_item['stepMessage'] = 'Paso 3: Procesando transcripción directa en la nube con Groq Cloud (Whisper Turbo)...'
            if on_progress:
                on_progress(3, 'Paso 3: Procesando transcripción directa en la nube con Groq Cloud (Whisper Turbo)...')

            try:
                groq_res = transcribe_with_groq_whisper(vid, groq_api_key, target_lang=target_lang)
                v_elapsed = round(time.time() - v_start, 2)
                groq_res['processingTimeSec'] = v_elapsed
                groq_res['status'] = 'completed'
                groq_res['currentStep'] = 3
                if custom_name:
                    groq_res['videoTitle'] = custom_name
                groq_res['customName'] = custom_name
                res_item.update(groq_res)
                return res_item
            except Exception as whisper_err:
                print(f"[{vid}] Error en Groq Whisper directo (intentando fallback local): {whisper_err}")

        # Si NO hay clave de Groq (modo local puro):
        # Capa 1: Subtítulos Nativos / Directos de YouTube
        res1, err_type1, err_msg1 = fetch_layer1_subtitles(vid, target_lang=target_lang)
        if res1 and len(res1.get('fullText', '')) > 10:
            v_elapsed = round(time.time() - v_start, 2)
            res1['processingTimeSec'] = v_elapsed
            res1['status'] = 'completed'
            res1['currentStep'] = 1
            if custom_name:
                res1['videoTitle'] = custom_name
            res1['customName'] = custom_name
            res_item.update(res1)
            return res_item

        # Capa 2: Whisper Local (CUDA float16 / CPU int8)
        hw = detect_whisper_hardware()
        res_item['currentStep'] = 2
        res_item['device'] = hw['device']
        res_item['deviceLabel'] = hw['device_label']
        res_item['stepMessage'] = 'Paso 2: Descargando audio e infiriendo con Whisper Local...'
        if on_progress:
            on_progress(2, 'Paso 2: Descargando audio e infiriendo con Whisper Local...', hw['device'])

        res2, err_type2, err_msg2 = fetch_layer2_local_whisper(vid, target_lang=target_lang)
        if res2 and len(res2.get('fullText', '')) > 10:
            v_elapsed = round(time.time() - v_start, 2)
            res2['processingTimeSec'] = v_elapsed
            res2['status'] = 'completed'
            res2['currentStep'] = 2
            if custom_name:
                res2['videoTitle'] = custom_name
            res2['customName'] = custom_name
            res_item.update(res2)
            return res_item

        # Si no se completó y no hay Groq API key, clasificar con mensaje informativo
        v_elapsed = round(time.time() - v_start, 2)
        res_item['status'] = 'error'
        res_item['processingTimeSec'] = v_elapsed
        res_item['error'] = 'No fue posible transcribir mediante subtítulos ni con el motor local. Configura tu clave gratuita de Groq API para transcribir el audio en la nube con Whisper Turbo.'
        res_item['errorType'] = 'GROQ_KEY_REQUIRED'
        return res_item

    except Exception as e:
        v_elapsed = round(time.time() - v_start, 2)
        res_item['status'] = 'error'
        res_item['error'] = str(e)
        res_item['errorType'] = 'UNEXPECTED_ERROR'
        res_item['processingTimeSec'] = v_elapsed
        return res_item

# -----------------------------------------------------------------------------
# Puntos de enlace de la API (Endpoints)
# -----------------------------------------------------------------------------

@app.route('/api/health', methods=['GET'])
def health_check():
    """Verifica el estado de salud del servicio, capacidad de trabajadores y hardware detectado."""
    hw = detect_whisper_hardware()
    return jsonify({
        'status': 'ok',
        'service': 'KuriScribe Secure Async Service',
        'max_workers': MAX_WORKERS,
        'hardware': hw,
        'time': time.time()
    })

@app.route('/api/hardware-status', methods=['GET'])
def hardware_status_endpoint():
    """Retorna la información del hardware detectado (CUDA/GPU vs CPU) para el frontend."""
    hw = detect_whisper_hardware()
    return jsonify({
        'device': hw['device'],
        'deviceLabel': hw['device_label'],
        'computeType': hw['compute_type'],
        'modelSize': hw['model_size'],
    })

@app.route('/api/parse-urls', methods=['POST'])
def parse_urls_endpoint():
    """Parsea una lista o bloque de texto con URLs de YouTube y devuelve la lista normalizada de vídeos."""
    data = request.get_json(silent=True) or {}
    raw_input = data.get('input', '') or data.get('urls', '')
    videos = parse_input_items(raw_input)
    return jsonify({'videos': videos, 'count': len(videos)})

@app.errorhandler(Exception)
def handle_global_exception(e):
    """Manejador global para registrar el error y devolver JSON estructurado sin filtrar trazas internas."""
    print(f"[Error no controlado en servidor]: {type(e).__name__}: {e}")
    if isinstance(e, ValueError):
        return jsonify({'error': str(e), 'errorType': 'INVALID_REQUEST'}), 400
    return jsonify({'error': 'Ocurrió un error inesperado al procesar la solicitud en el servidor.', 'errorType': 'INTERNAL_ERROR'}), 500

@app.route('/api/transcribe', methods=['POST'])
@limiter.limit("15 per minute")
def transcribe_single():
    """
    Endpoint síncrono para transcripción de un único vídeo mediante el sistema de 3 capas:
    1. Directo a Capa 3 (Groq Cloud) si se proporciona API Key.
    2. Capa 1 (Subtítulos Nativos) si no hay clave.
    3. Capa 2 (Whisper Local CUDA/CPU) como respaldo.
    """
    start_time = time.time()
    try:
        data = request.get_json(silent=True) or {}
        url_or_id = data.get('url')
        groq_api_key = data.get('groqApiKey')
        target_lang = data.get('targetLanguage', 'auto')

        if not url_or_id:
            return jsonify({'error': 'Debe proporcionar una URL o identificador de vídeo válido.', 'errorType': 'INVALID_REQUEST'}), 400

        video_id = extract_video_id(url_or_id)
        if not video_id:
            return jsonify({'error': 'El formato de la URL de YouTube no es válido.', 'errorType': 'INVALID_URL'}), 400

        allow_fallback = os.environ.get('ALLOW_SERVER_KEY_FALLBACK', 'true').lower() in ('true', '1', 'yes')
        has_groq_key = bool((groq_api_key or '').strip()) or (bool(os.environ.get('GROQ_API_KEY')) if allow_fallback else False)

        # Capa 3 DIRECTA: Si el usuario cuenta con API Key de Groq, ejecutar DIRECTAMENTE en la nube
        if has_groq_key:
            try:
                groq_result = transcribe_with_groq_whisper(video_id, groq_api_key, target_lang=target_lang)
                elapsed = round(time.time() - start_time, 2)
                groq_result['processingTimeSec'] = elapsed
                groq_result['currentStep'] = 3
                return jsonify(groq_result), 200
            except ValueError as val_err:
                return jsonify({'error': str(val_err), 'errorType': 'INVALID_API_KEY'}), 400
            except Exception as whisper_err:
                print(f"[{video_id}] Error en Groq Whisper directo (intentando fallback local): {whisper_err}")

        # Modo Local Puro (si no hay clave Groq):
        # Capa 1: Subtítulos nativos directos
        res1, err_type1, err_msg1 = fetch_layer1_subtitles(video_id, target_lang=target_lang)
        if res1 and len(res1.get('fullText', '')) > 10:
            elapsed = round(time.time() - start_time, 2)
            res1['processingTimeSec'] = elapsed
            res1['currentStep'] = 1
            return jsonify(res1), 200

        # Capa 2: Whisper Local (CUDA / CPU)
        res2, err_type2, err_msg2 = fetch_layer2_local_whisper(video_id, target_lang=target_lang)
        if res2 and len(res2.get('fullText', '')) > 10:
            elapsed = round(time.time() - start_time, 2)
            res2['processingTimeSec'] = elapsed
            res2['currentStep'] = 2
            return jsonify(res2), 200

        # Si no hay clave de Groq API y fallaron Capa 1 y 2, solicitar la clave al usuario
        elapsed = round(time.time() - start_time, 2)
        return jsonify({
            'error': 'No fue posible transcribir mediante subtítulos oficiales ni con el motor local. Configura tu API Key gratuita de Groq para transcribir el audio en la nube con Whisper Turbo.',
            'errorType': 'GROQ_KEY_REQUIRED',
            'processingTimeSec': elapsed
        }), 400

    except Exception as e:
        print(f"Error general en /api/transcribe: {e}")
        return jsonify({'error': 'Error interno al procesar la transcripción del vídeo.', 'errorType': 'INTERNAL_ERROR'}), 500

@app.route('/api/translate', methods=['POST'])
@limiter.limit("30 per minute")
def translate_endpoint():
    """Traduce texto o segmentos dinámicamente usando GoogleTranslator."""
    try:
        data = request.get_json(silent=True) or {}
        text = data.get('text', '')
        segments = data.get('segments', [])
        target_lang = data.get('target_lang') or data.get('targetLanguage') or 'es'

        if not text and not segments:
            return jsonify({'error': 'Debe proporcionar el campo "text" o "segments" para traducir.'}), 400

        if not target_lang or target_lang in ('auto', 'original'):
            return jsonify({
                'translated_text': text,
                'fullText': text,
                'segments': segments,
                'target_lang': target_lang,
                'languageName': 'Idioma Original'
            }), 200

        # Traducir segmentos y texto garantizando que intros o párrafos en otro idioma se traduzcan al 100%
        translated_segments = []
        if segments:
            translated_segments = translate_segments(segments, target_lang)
            translated_text = ' '.join(s.get('text', '') for s in translated_segments if s.get('text'))
        elif text:
            translated_text = translate_text(text, target_lang)
        else:
            translated_text = ''

        lang_label = LANGUAGE_NAMES.get(target_lang, target_lang.upper())

        return jsonify({
            'translated_text': translated_text,
            'fullText': translated_text,
            'segments': translated_segments,
            'target_lang': target_lang,
            'languageName': lang_label
        }), 200
    except Exception as e:
        print(f"Error en /api/translate: {e}")
        return jsonify({'error': 'Ocurrió un error al traducir la transcripción.'}), 500

@app.route('/api/transcribe-batch', methods=['POST'])
@limiter.limit("5 per minute")
def transcribe_batch_concurrent():
    start_time = time.time()
    try:
        data = request.get_json(silent=True) or {}
        raw_input = data.get('items') or data.get('input') or data.get('urls')
        target_lang = data.get('targetLanguage', 'auto')
        
        raw_zip_name = data.get('zipName') or 'transcripciones_kuriscribe.zip'
        custom_zip_name = sanitize_filename(raw_zip_name)
        if not custom_zip_name.endswith('.zip'):
            custom_zip_name += '.zip'

        groq_api_key = data.get('groqApiKey')
        videos = parse_input_items(raw_input)

        if not videos:
            return jsonify({'error': 'No se encontraron vídeos válidos en el lote ingresado.'}), 400

        results_map = {}

        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            future_to_index = {
                executor.submit(process_single_video_task, vid_info, groq_api_key, target_lang, idx): idx
                for idx, vid_info in enumerate(videos)
            }

            for future in as_completed(future_to_index):
                idx = future_to_index[future]
                try:
                    res_item = future.result()
                    results_map[idx] = res_item
                except Exception as exc:
                    vid_info = videos[idx]
                    print(f"Error procesando tarea de video en lote ({vid_info.get('videoId')}): {exc}")
                    results_map[idx] = {
                        'videoId': vid_info['videoId'],
                        'videoUrl': vid_info['url'],
                        'videoTitle': vid_info.get('customName') or vid_info.get('title', f"Video_{vid_info['videoId']}"),
                        'customName': vid_info.get('customName'),
                        'status': 'error',
                        'error': 'Error al procesar este video específico.'
                    }

        ordered_results = [results_map[i] for i in range(len(videos))]

        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for idx, item in enumerate(ordered_results, 1):
                chosen_name = item.get('customName') or f"{idx:02d}_{item.get('videoTitle') or 'transcripcion'}"
                file_safe_name = sanitize_filename(chosen_name)
                
                if item.get('status') == 'completed':
                    file_name_in_zip = f"{file_safe_name}.txt"
                    txt_content = generate_txt_content(item, idx)
                    zip_file.writestr(file_name_in_zip, txt_content.encode('utf-8'))
                else:
                    file_name_in_zip = f"{file_safe_name}_ERROR.txt"
                    clean_title = item.get('videoTitle') or item.get('customName') or f"Video {item.get('videoId', '')}"
                    clean_err = item.get('error', 'No se pudo procesar este contenido.')
                    err_content = f"Elemento: {clean_title}\nID de vídeo: {item.get('videoId', 'N/A')}\nEstado: No disponible\nMotivo: {clean_err}\n"
                    zip_file.writestr(file_name_in_zip, err_content.encode('utf-8'))

        zip_data = zip_buffer.getvalue()
        if len(zip_data) > MAX_ZIP_BYTES:
            return jsonify({'error': 'El archivo ZIP generado excede el límite de seguridad de memoria (50 MB). Reduzca la cantidad de vídeos del lote.'}), 413

        zip_buffer.seek(0)
        batch_id = str(uuid.uuid4())
        
        clean_expired_cache()
        ZIP_CACHE[batch_id] = {
            'filename': custom_zip_name,
            'data': zip_data,
            'created': time.time()
        }

        total_time = round(time.time() - start_time, 2)

        return jsonify({
            'batchId': batch_id,
            'zipFilename': custom_zip_name,
            'downloadUrl': f"/api/download-zip/{batch_id}",
            'results': ordered_results,
            'totalCount': len(ordered_results),
            'successCount': sum(1 for r in ordered_results if r.get('status') == 'completed'),
            'totalTimeSec': total_time,
        })
    except Exception as e:
        print(f"Error en /api/transcribe-batch: {e}")
        return jsonify({'error': 'Ocurrió un error al procesar el lote de transcripciones.'}), 500

@app.route('/api/transcribe-stream', methods=['POST'])
@limiter.limit("15 per minute")
def transcribe_stream_single():
    """Emite eventos en tiempo real (SSE) durante la transcripción individual por capas."""
    data = request.get_json(silent=True) or {}
    url_or_id = data.get('url')
    groq_api_key = data.get('groqApiKey')
    target_lang = data.get('targetLanguage', 'auto')

    def generate_single_events():
        if not url_or_id:
            yield f"data: {json.dumps({'type': 'error', 'error': 'Debe proporcionar una URL o identificador de vídeo válido.', 'errorType': 'INVALID_REQUEST'})}\n\n"
            return

        video_id = extract_video_id(url_or_id)
        if not video_id:
            yield f"data: {json.dumps({'type': 'error', 'error': 'El formato de la URL de YouTube no es válido.', 'errorType': 'INVALID_URL'})}\n\n"
            return

        start_time = time.time()
        allow_fallback = os.environ.get('ALLOW_SERVER_KEY_FALLBACK', 'true').lower() in ('true', '1', 'yes')
        has_groq_key = bool((groq_api_key or '').strip()) or (bool(os.environ.get('GROQ_API_KEY')) if allow_fallback else False)

        # Capa 3 DIRECTA: Si el usuario tiene API Key de Groq, ejecutar DIRECTAMENTE en la nube
        if has_groq_key:
            yield f"data: {json.dumps({'type': 'step', 'step': 3, 'message': 'Paso 3: Procesando transcripción directa en la nube con Groq Cloud (Whisper Turbo)...'})}\n\n"
            try:
                groq_result = transcribe_with_groq_whisper(video_id, groq_api_key, target_lang=target_lang)
                elapsed = round(time.time() - start_time, 2)
                groq_result['processingTimeSec'] = elapsed
                groq_result['currentStep'] = 3
                yield f"data: {json.dumps({'type': 'complete', 'result': groq_result})}\n\n"
                return
            except Exception as whisper_err:
                print(f"[{video_id}] Error en Groq Whisper directo (intentando fallback local): {whisper_err}")

        # Modo Local Puro (si no hay clave Groq):
        # Capa 1: Subtítulos nativos
        yield f"data: {json.dumps({'type': 'step', 'step': 1, 'message': 'Paso 1: Consultando subtítulos nativos de YouTube...'})}\n\n"
        try:
            res1, err_type1, err_msg1 = fetch_layer1_subtitles(video_id, target_lang=target_lang)
            if res1 and len(res1.get('fullText', '')) > 10:
                elapsed = round(time.time() - start_time, 2)
                res1['processingTimeSec'] = elapsed
                res1['currentStep'] = 1
                yield f"data: {json.dumps({'type': 'complete', 'result': res1})}\n\n"
                return
        except Exception as e1:
            print(f"[{video_id}] Error capa 1 stream: {e1}")

        # Capa 2: Whisper local
        hw = detect_whisper_hardware()
        yield f"data: {json.dumps({'type': 'step', 'step': 2, 'message': 'Paso 2: Descargando audio e infiriendo con Whisper Local...', 'device': hw['device'], 'deviceLabel': hw['device_label']})}\n\n"

        try:
            res2, err_type2, err_msg2 = fetch_layer2_local_whisper(video_id, target_lang=target_lang)
            if res2 and len(res2.get('fullText', '')) > 10:
                elapsed = round(time.time() - start_time, 2)
                res2['processingTimeSec'] = elapsed
                res2['currentStep'] = 2
                yield f"data: {json.dumps({'type': 'complete', 'result': res2})}\n\n"
                return
        except Exception as e2:
            print(f"[{video_id}] Error capa 2 stream: {e2}")

        # Error / Solicitud de clave
        elapsed = round(time.time() - start_time, 2)
        err_payload = {
            'type': 'error',
            'error': 'No fue posible transcribir mediante subtítulos oficiales ni con el motor local. Configura tu API Key gratuita de Groq para transcribir el audio en la nube con Whisper Turbo.',
            'errorType': 'GROQ_KEY_REQUIRED',
            'processingTimeSec': elapsed
        }
        yield f"data: {json.dumps(err_payload)}\n\n"

    return Response(
        stream_with_context(generate_single_events()),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no',
            'Connection': 'keep-alive',
        }
    )

@app.route('/api/transcribe-batch-stream', methods=['POST'])
@limiter.limit("5 per minute")
def transcribe_batch_stream():
    """Emite eventos en tiempo real (SSE) durante la transcripción concurrente, incluyendo transición de capas."""
    data = request.get_json(silent=True) or {}
    raw_input = data.get('items') or data.get('input') or data.get('urls')
    target_lang = data.get('targetLanguage', 'auto')
    
    raw_zip_name = data.get('zipName') or 'transcripciones_kuriscribe.zip'
    custom_zip_name = sanitize_filename(raw_zip_name)
    if not custom_zip_name.endswith('.zip'):
        custom_zip_name += '.zip'

    groq_api_key = data.get('groqApiKey')
    videos = parse_input_items(raw_input)

    def generate_events():
        if not videos:
            yield f"data: {json.dumps({'type': 'error', 'message': 'No se encontraron vídeos válidos.'})}\n\n"
            return

        start_time = time.time()
        yield f"data: {json.dumps({'type': 'init', 'totalVideos': len(videos), 'videos': videos})}\n\n"

        import queue
        event_queue = queue.Queue()
        active_tasks = len(videos)

        def run_video_task(vid_info, idx):
            def progress_cb(step_num, step_msg, dev=None):
                event_queue.put({
                    'type': 'video_step',
                    'index': idx,
                    'step': step_num,
                    'stepMessage': step_msg,
                    'device': dev,
                    'videoId': vid_info['videoId']
                })

            try:
                res = process_single_video_task(vid_info, groq_api_key, target_lang, idx, on_progress=progress_cb)
                event_queue.put({'type': 'video_done', 'index': idx, 'item': res})
            except Exception as exc:
                print(f"Error procesando video en stream ({vid_info.get('videoId')}): {exc}")
                res = {
                    'videoId': vid_info['videoId'],
                    'videoUrl': vid_info['url'],
                    'videoTitle': vid_info.get('customName') or vid_info.get('title', f"Video_{vid_info['videoId']}"),
                    'customName': vid_info.get('customName'),
                    'status': 'error',
                    'error': 'Error al procesar este video.',
                    'processingTimeSec': 0
                }
                event_queue.put({'type': 'video_done', 'index': idx, 'item': res})

        results_map = {}
        completed_count = 0

        # Lanzar hilos en background
        executor = ThreadPoolExecutor(max_workers=MAX_WORKERS)
        for idx, vid_info in enumerate(videos):
            executor.submit(run_video_task, vid_info, idx)

        while completed_count < active_tasks:
            try:
                ev = event_queue.get(timeout=0.1)
                yield f"data: {json.dumps(ev)}\n\n"
                if ev.get('type') == 'video_done':
                    results_map[ev['index']] = ev['item']
                    completed_count += 1
            except queue.Empty:
                continue

        executor.shutdown(wait=True)

        ordered_results = [results_map[i] for i in range(len(videos))]

        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for idx, item in enumerate(ordered_results, 1):
                chosen_name = item.get('customName') or f"{idx:02d}_{item.get('videoTitle') or 'transcripcion'}"
                file_safe_name = sanitize_filename(chosen_name)
                
                if item.get('status') == 'completed':
                    file_name_in_zip = f"{file_safe_name}.txt"
                    txt_content = generate_txt_content(item, idx)
                    zip_file.writestr(file_name_in_zip, txt_content.encode('utf-8'))
                else:
                    file_name_in_zip = f"{file_safe_name}_ERROR.txt"
                    clean_title = item.get('videoTitle') or item.get('customName') or f"Video {item.get('videoId', '')}"
                    clean_err = item.get('error', 'No se pudo procesar este contenido.')
                    err_content = f"Elemento: {clean_title}\nID de vídeo: {item.get('videoId', 'N/A')}\nEstado: No disponible\nMotivo: {clean_err}\n"
                    zip_file.writestr(file_name_in_zip, err_content.encode('utf-8'))

        zip_data = zip_buffer.getvalue()
        if len(zip_data) > MAX_ZIP_BYTES:
            yield f"data: {json.dumps({'type': 'error', 'message': 'El archivo ZIP excede el límite de memoria (50 MB). Reduzca la cantidad de vídeos.'})}\n\n"
            return

        zip_buffer.seek(0)
        batch_id = str(uuid.uuid4())
        
        clean_expired_cache()
        ZIP_CACHE[batch_id] = {
            'filename': custom_zip_name,
            'data': zip_data,
            'created': time.time()
        }

        total_time = round(time.time() - start_time, 2)
        final_payload = {
            'type': 'complete',
            'batchId': batch_id,
            'zipFilename': custom_zip_name,
            'downloadUrl': f"/api/download-zip/{batch_id}",
            'results': ordered_results,
            'totalCount': len(ordered_results),
            'successCount': sum(1 for r in ordered_results if r.get('status') == 'completed'),
            'totalTimeSec': total_time,
        }
        yield f"data: {json.dumps(final_payload)}\n\n"

    resp = Response(generate_events(), mimetype='text/event-stream')
    resp.headers['Cache-Control'] = 'no-cache'
    resp.headers['X-Accel-Buffering'] = 'no'
    resp.headers['Connection'] = 'keep-alive'
    return resp

@app.route('/api/download-zip/<batch_id>', methods=['GET'])
def download_zip_endpoint(batch_id):
    if not is_valid_uuid(batch_id):
        return jsonify({'error': 'Identificador de lote no válido.'}), 400

    clean_expired_cache()
    cached = ZIP_CACHE.get(batch_id)
    if not cached:
        return jsonify({'error': 'Archivo ZIP no encontrado o caducado.'}), 404

    return send_file(
        io.BytesIO(cached['data']),
        mimetype='application/zip',
        as_attachment=True,
        download_name=cached['filename']
    )

# -----------------------------------------------------------------------------
# Endpoints de Diálogo Nativo (Disponibles exclusivamente en Modo Escritorio)
# -----------------------------------------------------------------------------
if IS_DESKTOP_MODE:
    @app.route('/api/save-zip-native', methods=['POST'])
    def save_zip_native_endpoint():
        """Abre un diálogo nativo del sistema para elegir dónde guardar el .ZIP y escribe el archivo directamente en disco."""
        try:
            data = request.get_json(silent=True) or {}
            items = data.get('items', [])
            zip_filename = data.get('zipFilename') or data.get('zipName') or 'transcripciones_kuriscribe.zip'
            
            if not zip_filename.endswith('.zip'):
                zip_filename += '.zip'

            if not items:
                return jsonify({'error': 'No hay elementos para exportar al archivo ZIP.'}), 400

            def ask_save_path():
                import tkinter as tk
                from tkinter import filedialog
                root = tk.Tk()
                root.withdraw()
                root.attributes('-topmost', True)
                root.focus_force()
                save_path = filedialog.asksaveasfilename(
                    parent=root,
                    title="Guardar archivo ZIP de transcripciones",
                    initialfile=zip_filename,
                    defaultextension=".zip",
                    filetypes=[("Archivos ZIP (*.zip)", "*.zip"), ("Todos los archivos (*.*)", "*.*")]
                )
                root.destroy()
                return save_path

            save_path = ask_save_path()

            if not save_path:
                return jsonify({
                    'success': False,
                    'cancelled': True,
                    'message': 'Guardado cancelado por el usuario.'
                }), 200

            with zipfile.ZipFile(save_path, 'w', zipfile.ZIP_DEFLATED) as zip_file:
                for idx, item in enumerate(items, 1):
                    base_name = (item.get('customName') or item.get('title') or item.get('videoTitle') or f"video_{idx}").strip()
                    if base_name.lower().endswith('.txt'):
                        base_name = base_name[:-4]
                    file_safe_name = sanitize_filename(base_name) or f"video_{idx}"
                    file_name_in_zip = f"{file_safe_name}.txt"

                    content = (item.get('fullText') or '').strip()
                    if not content and item.get('segments'):
                        content = ' '.join(seg.get('text', '') for seg in item['segments'] if seg.get('text')).strip()
                    if not content and item.get('error'):
                        content = f"Error: {item.get('error')}"

                    zip_file.writestr(file_name_in_zip, content.encode('utf-8'))

            return jsonify({
                'success': True,
                'savedPath': save_path,
                'filename': os.path.basename(save_path),
                'message': f'Archivo ZIP guardado exitosamente: {os.path.basename(save_path)}'
            }), 200
        except Exception as e:
            print(f"Error en /api/save-zip-native: {e}")
            return jsonify({'error': 'Error al guardar el archivo ZIP en el sistema.'}), 500

    @app.route('/api/save-txt-native', methods=['POST'])
    def save_txt_native_endpoint():
        """Abre un diálogo nativo del sistema operativo (Guardar como...) para elegir destino y guarda el .TXT directamente."""
        try:
            data = request.get_json(silent=True) or {}
            text = data.get('text', '')
            raw_filename = data.get('filename') or 'transcripcion.txt'
            
            filename = sanitize_filename(raw_filename) or 'transcripcion.txt'
            if not filename.endswith('.txt'):
                filename += '.txt'

            def ask_save_path_txt():
                import tkinter as tk
                from tkinter import filedialog
                root = tk.Tk()
                root.withdraw()
                root.attributes('-topmost', True)
                root.focus_force()
                save_path = filedialog.asksaveasfilename(
                    parent=root,
                    title="Guardar transcripción en .TXT",
                    initialfile=filename,
                    defaultextension=".txt",
                    filetypes=[("Archivos de texto (*.txt)", "*.txt"), ("Todos los archivos (*.*)", "*.*")]
                )
                root.destroy()
                return save_path

            save_path = ask_save_path_txt()

            if not save_path:
                return jsonify({
                    'success': False,
                    'cancelled': True,
                    'message': 'Guardado cancelado por el usuario.'
                }), 200

            with open(save_path, 'w', encoding='utf-8') as f:
                f.write(text)

            return jsonify({
                'success': True,
                'savedPath': save_path,
                'filename': os.path.basename(save_path),
                'message': f'Archivo TXT guardado exitosamente: {os.path.basename(save_path)}'
            }), 200
        except Exception as e:
            print(f"Error en /api/save-txt-native: {e}")
            return jsonify({'error': 'Error al guardar el archivo TXT en el sistema.'}), 500
else:
    @app.route('/api/save-zip-native', methods=['POST'])
    @app.route('/api/save-txt-native', methods=['POST'])
    def save_native_disabled():
        return jsonify({
            'error': 'Los diálogos de guardado nativo solo están disponibles en la versión de escritorio de KuriScribe.'
        }), 403

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"Iniciando servidor de KuriScribe en http://127.0.0.1:{port} (Modo Escritorio: {IS_DESKTOP_MODE})...")
    app.run(host='127.0.0.1', port=port, debug=False, threaded=True)
