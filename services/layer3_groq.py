"""
Capa 3: Inferencia en la Nube mediante Groq Cloud API (Whisper Turbo).
Se invoca como respaldo final cuando las Capas 1 y 2 fallan o a petición explícita.
"""

import os
import re
import math
import subprocess
import tempfile
import yt_dlp
from typing import Dict, Any, Optional
from groq import Groq

from services.common_utils import (
    sanitize_filename,
    LANGUAGE_NAMES,
    translate_segments,
    get_configured_proxy_url,
)
from services.audio_utils import cleanup_temp_dir, get_audio_duration_seconds
from services.exceptions import Layer3GroqError, GroqKeyRequiredError

def transcribe_with_groq_whisper(video_id: str, groq_api_key: Optional[str] = None, target_lang: str = 'auto') -> Dict[str, Any]:
    """Descarga el flujo de audio con yt-dlp y procesa la inferencia en Groq Cloud directamente."""
    allow_fallback = os.environ.get('ALLOW_SERVER_KEY_FALLBACK', 'true').lower() in ('true', '1', 'yes')
    api_key = (groq_api_key or '').strip() or (os.environ.get('GROQ_API_KEY') if allow_fallback else None)

    if not api_key:
        raise GroqKeyRequiredError("Este vídeo no dispone de subtítulos nativos en YouTube ni fue posible transcribir localmente. Por favor configure su clave de Groq API para transcribirlo con Whisper Turbo.")

    api_key = str(api_key).strip()
    if not re.match(r'^[a-zA-Z0-9_\-\.]{15,100}$', api_key):
        raise Layer3GroqError("El formato de la clave Groq API ingresada no es válido.", "INVALID_GROQ_KEY")

    client = Groq(api_key=api_key)
    temp_dir = None

    try:
        temp_dir = tempfile.mkdtemp()
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
        detected_video_lang = None

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            if info:
                if info.get('title'):
                    video_title = sanitize_filename(info.get('title'))
                if info.get('language'):
                    detected_video_lang = str(info.get('language')).split('-')[0].lower()

        if not os.path.exists(target_audio_file):
            for f in os.listdir(temp_dir):
                if f.endswith(('.mp3', '.m4a', '.wav', '.opus', '.webm')):
                    target_audio_file = os.path.join(temp_dir, f)
                    break

        if not os.path.exists(target_audio_file):
            raise Layer3GroqError("No se pudo descargar el archivo de audio del vídeo para transcripción.")

        file_size_bytes = os.path.getsize(target_audio_file)
        max_groq_bytes = 24 * 1024 * 1024

        # Transcribir en el idioma nativo del audio para evitar alucinaciones fonéticas con intros o videos extranjeros
        groq_lang = detected_video_lang if detected_video_lang and detected_video_lang not in ('auto', 'original') else None

        if file_size_bytes <= max_groq_bytes:
            with open(target_audio_file, "rb") as file_handle:
                transcription = client.audio.transcriptions.create(
                    file=(os.path.basename(target_audio_file), file_handle.read()),
                    model="whisper-large-v3-turbo",
                    response_format="verbose_json",
                    language=groq_lang
                )

            segments = []
            if hasattr(transcription, 'segments') and transcription.segments:
                for s in transcription.segments:
                    text = (s.get('text') if isinstance(s, dict) else getattr(s, 'text', '') or '').strip()
                    if text:
                        start_time = float(s.get('start') if isinstance(s, dict) else getattr(s, 'start', 0.0))
                        end_time = float(s.get('end') if isinstance(s, dict) else getattr(s, 'end', 0.0))
                        segments.append({
                            'start': round(start_time, 2),
                            'duration': round(max(0.0, end_time - start_time), 2),
                            'text': text
                        })

            full_text = getattr(transcription, 'text', '') or ' '.join(s['text'] for s in segments)
            detected_lang = getattr(transcription, 'language', 'auto') or 'auto'

            if target_lang and target_lang not in ('auto', 'original'):
                try:
                    translated_segs = translate_segments(segments, target_lang)
                    full_text = ' '.join(s.get('text', '') for s in translated_segs if s.get('text'))
                    segments = translated_segs
                    detected_lang = target_lang
                except Exception as trans_e:
                    print(f"[{video_id}] Error al traducir salida de Groq Whisper: {trans_e}")

            lang_name = LANGUAGE_NAMES.get(detected_lang, detected_lang.upper()) if detected_lang != 'auto' else 'Detectado'

            return {
                'videoId': video_id,
                'videoUrl': url,
                'videoTitle': video_title,
                'fullText': full_text,
                'segments': segments,
                'method': 'groq-whisper-turbo',
                'methodLabel': f'Groq Whisper Turbo ({lang_name})',
                'language': detected_lang
            }
        else:
            # División de audio para archivos de gran duración
            total_duration = get_audio_duration_seconds(target_audio_file)
            if not total_duration or total_duration <= 0:
                total_duration = (file_size_bytes / (48 * 1024 / 8))

            chunk_duration_sec = 600
            num_chunks = math.ceil(total_duration / chunk_duration_sec)
            all_segments = []
            full_text_list = []
            detected_languages = []

            for i in range(num_chunks):
                start_offset = i * chunk_duration_sec
                chunk_file = os.path.join(temp_dir, f"chunk_{i}.mp3")

                cmd = [
                    'ffmpeg', '-y',
                    '-ss', str(start_offset),
                    '-t', str(chunk_duration_sec),
                    '-i', target_audio_file,
                    '-c', 'copy',
                    chunk_file
                ]
                subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

                if os.path.exists(chunk_file) and os.path.getsize(chunk_file) > 1000:
                    with open(chunk_file, "rb") as chunk_fh:
                        transcription_chunk = client.audio.transcriptions.create(
                            file=(os.path.basename(chunk_file), chunk_fh.read()),
                            model="whisper-large-v3-turbo",
                            response_format="verbose_json",
                            language=groq_lang
                        )

                    c_lang = getattr(transcription_chunk, 'language', None)
                    if c_lang:
                        detected_languages.append(c_lang)

                    if hasattr(transcription_chunk, 'segments') and transcription_chunk.segments:
                        for s in transcription_chunk.segments:
                            text = (s.get('text') if isinstance(s, dict) else getattr(s, 'text', '') or '').strip()
                            if text:
                                s_start = float(s.get('start') if isinstance(s, dict) else getattr(s, 'start', 0.0))
                                s_end = float(s.get('end') if isinstance(s, dict) else getattr(s, 'end', 0.0))
                                abs_start = round(start_offset + s_start, 2)
                                abs_dur = round(max(0.0, s_end - s_start), 2)
                                all_segments.append({
                                    'start': abs_start,
                                    'duration': abs_dur,
                                    'text': text
                                })
                                full_text_list.append(text)
                    else:
                        c_text = (getattr(transcription_chunk, 'text', '') or '').strip()
                        if c_text:
                            all_segments.append({
                                'start': round(float(start_offset), 2),
                                'duration': round(float(chunk_duration_sec), 2),
                                'text': c_text
                            })
                            full_text_list.append(c_text)

            final_lang = detected_languages[0] if detected_languages else 'auto'
            full_text = ' '.join(full_text_list)

            if target_lang and target_lang not in ('auto', 'original'):
                try:
                    translated_segs = translate_segments(all_segments, target_lang)
                    full_text = ' '.join(s.get('text', '') for s in translated_segs if s.get('text'))
                    all_segments = translated_segs
                    final_lang = target_lang
                except Exception as trans_e:
                    print(f"[{video_id}] Error al traducir segmentos fragmentados de Groq: {trans_e}")

            lang_name = LANGUAGE_NAMES.get(final_lang, final_lang.upper()) if final_lang != 'auto' else 'Detectado'

            return {
                'videoId': video_id,
                'videoUrl': url,
                'videoTitle': video_title,
                'fullText': full_text,
                'segments': all_segments,
                'method': 'groq-whisper-turbo',
                'methodLabel': f'Groq Whisper Turbo ({lang_name}) [Fragmentado]',
                'language': final_lang
            }
    except Exception as e:
        print(f"[{video_id}] Error en transcribe_with_groq_whisper: {e}")
        raise Layer3GroqError(f"Error al procesar en Groq Cloud: {e}")
    finally:
        cleanup_temp_dir(temp_dir)
