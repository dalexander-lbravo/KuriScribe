"""
Módulo de utilidades de audio para descarga ligera y limpieza segura de archivos temporales.
"""

import os
import shutil
import tempfile
import subprocess
import yt_dlp
from typing import Tuple, Optional
from services.common_utils import sanitize_filename, get_configured_proxy_url
from services.exceptions import AudioExtractionError

def cleanup_temp_dir(temp_dir: Optional[str]) -> None:
    """Elimina de forma segura un directorio temporal y su contenido."""
    if temp_dir and os.path.exists(temp_dir):
        try:
            shutil.rmtree(temp_dir, ignore_errors=True)
        except Exception as e:
            print(f"[Aviso] No se pudo eliminar el directorio temporal {temp_dir}: {e}")

def get_audio_duration_seconds(file_path: str) -> Optional[float]:
    """Obtiene la duración exacta en segundos de un archivo de audio mediante ffprobe."""
    try:
        cmd = [
            'ffprobe', '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            file_path
        ]
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True)
        return float(res.stdout.strip())
    except Exception:
        return None

def download_lightweight_audio_for_video(video_id: str, temp_dir: str) -> Tuple[str, str, str]:
    """
    Descarga el flujo de audio con yt-dlp extrayéndolo a 16kHz mono MP3
    para minimizar consumo de I/O y memoria, preservando el idioma original del audio.
    Devuelve (audio_path, video_title, detected_language).
    """
    output_template = os.path.join(temp_dir, "audio.%(ext)s")
    target_audio_file = os.path.join(temp_dir, "audio.mp3")

    ydl_opts = {
        'format': 'bestaudio[language=orig]/bestaudio[language=es]/bestaudio/best',
        'outtmpl': output_template,
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '48',
        }],
        'postprocessor_args': [
            '-ac', '1',
            '-ar', '16000',
        ],
        'quiet': True,
        'no_warnings': True,
        'noprogress': True,
    }

    proxy_url = get_configured_proxy_url()
    if proxy_url:
        ydl_opts['proxy'] = proxy_url

    cookies_file = os.environ.get('YOUTUBE_COOKIES_FILE')
    cookies_browser = os.environ.get('YOUTUBE_COOKIES_BROWSER')
    if cookies_file and os.path.exists(cookies_file):
        ydl_opts['cookiefile'] = cookies_file
    elif cookies_browser:
        ydl_opts['cookiesfrombrowser'] = (cookies_browser,)

    url = f"https://www.youtube.com/watch?v={video_id}"
    video_title = f"Video_{video_id}"
    detected_lang = 'auto'

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            if info:
                if info.get('title'):
                    video_title = sanitize_filename(info.get('title'))
                if info.get('language'):
                    detected_lang = str(info.get('language')).split('-')[0].lower()
                elif info.get('subtitles'):
                    sub_keys = list(info.get('subtitles', {}).keys())
                    for k in sub_keys:
                        if k.startswith('es'):
                            detected_lang = 'es'
                            break
                    if detected_lang == 'auto' and sub_keys:
                        detected_lang = sub_keys[0].split('-')[0].lower()
                elif info.get('automatic_captions'):
                    auto_keys = list(info.get('automatic_captions', {}).keys())
                    for k in auto_keys:
                        if k.startswith('es'):
                            detected_lang = 'es'
                            break
                    if detected_lang == 'auto' and auto_keys:
                        detected_lang = auto_keys[0].split('-')[0].lower()
    except Exception as e:
        print(f"[{video_id}] Error al descargar audio con yt-dlp: {e}")
        raise AudioExtractionError(f"Error al descargar audio del video: {e}")

    if not os.path.exists(target_audio_file):
        for f in os.listdir(temp_dir):
            if f.endswith(('.mp3', '.m4a', '.wav', '.opus', '.webm')):
                target_audio_file = os.path.join(temp_dir, f)
                break

    if not os.path.exists(target_audio_file):
        raise AudioExtractionError("No se pudo generar el archivo de audio ligero del vídeo.")

    return target_audio_file, video_title, detected_lang
