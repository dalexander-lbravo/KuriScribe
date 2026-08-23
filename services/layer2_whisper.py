"""
Capa 2: Motor de Inferencia Local Autónomo con faster-whisper y fallback CLI whisper-ctranslate2.
Detecta dinámicamente aceleración GPU (CUDA) o CPU.
"""

import os
import sys
import json
import tempfile
import subprocess
from typing import Dict, Any, Tuple, Optional

from services.common_utils import LANGUAGE_NAMES, translate_segments
from services.audio_utils import download_lightweight_audio_for_video, cleanup_temp_dir
from services.exceptions import Layer2WhisperError, LocalWhisperEmptyError

_LOCAL_WHISPER_MODEL_CACHE = {}

def detect_whisper_hardware() -> Dict[str, str]:
    """
    Detecta dinámicamente si CUDA / GPU está disponible para CTranslate2 / Whisper.
    Devuelve dict con {'device': 'cuda' | 'cpu', 'compute_type': 'float16' | 'int8', 'model_size': 'base' | 'tiny', 'device_label': 'GPU (CUDA)' | 'CPU'}
    """
    has_cuda = False
    try:
        import ctranslate2
        if hasattr(ctranslate2, 'get_cuda_device_count') and ctranslate2.get_cuda_device_count() > 0:
            has_cuda = True
    except Exception:
        pass

    if not has_cuda:
        try:
            import torch
            if torch.cuda.is_available():
                has_cuda = True
        except Exception:
            pass

    if has_cuda:
        return {
            'device': 'cuda',
            'compute_type': os.environ.get('WHISPER_CUDA_COMPUTE_TYPE', 'float16'),
            'model_size': os.environ.get('WHISPER_LOCAL_MODEL', 'base'),
            'device_label': 'GPU (CUDA)',
        }
    else:
        return {
            'device': 'cpu',
            'compute_type': os.environ.get('WHISPER_CPU_COMPUTE_TYPE', 'int8'),
            'model_size': os.environ.get('WHISPER_LOCAL_MODEL', 'base'),
            'device_label': 'CPU',
        }

def get_or_load_local_whisper_model():
    """Obtiene el modelo WhisperModel (faster-whisper / ctranslate2) en memoria compartida."""
    hw = detect_whisper_hardware()
    cache_key = f"{hw['model_size']}_{hw['device']}_{hw['compute_type']}"
    if cache_key in _LOCAL_WHISPER_MODEL_CACHE:
        return _LOCAL_WHISPER_MODEL_CACHE[cache_key], hw

    from faster_whisper import WhisperModel
    cpu_threads = int(os.environ.get('WHISPER_CPU_THREADS', '4'))
    try:
        model = WhisperModel(
            hw['model_size'],
            device=hw['device'],
            compute_type=hw['compute_type'],
            cpu_threads=cpu_threads,
            num_workers=1
        )
        _LOCAL_WHISPER_MODEL_CACHE[cache_key] = model
        return model, hw
    except Exception as e:
        print(f"[Whisper Local] Error al instanciar WhisperModel ({cache_key}): {e}")
        fallback_compute = 'float32' if hw['device'] == 'cpu' else 'float16'
        model = WhisperModel(
            'tiny' if hw['device'] == 'cpu' else hw['model_size'],
            device=hw['device'],
            compute_type=fallback_compute
        )
        _LOCAL_WHISPER_MODEL_CACHE[cache_key] = model
        hw['compute_type'] = fallback_compute
        return model, hw

def transcribe_with_whisper_cli_fallback(audio_path: str, target_lang: str = 'auto') -> Optional[Dict[str, Any]]:
    """Fallback invocando whisper-ctranslate2 mediante CLI/subprocess (whisper-ctranslate2, uvx o python -m)."""
    hw = detect_whisper_hardware()
    cli_commands = [
        ["whisper-ctranslate2"],
        ["uvx", "whisper-ctranslate2"],
        [sys.executable, "-m", "whisper_ctranslate2.whisper_ctranslate2"],
    ]

    for base_cmd in cli_commands:
        try:
            with tempfile.TemporaryDirectory() as out_dir:
                cmd = list(base_cmd) + [
                    audio_path,
                    "--model", hw['model_size'],
                    "--device", hw['device'],
                    "--compute_type", hw['compute_type'],
                    "--output_dir", out_dir,
                    "--output_format", "json",
                ]
                if target_lang and target_lang not in ('auto', 'original'):
                    cmd.extend(["--language", target_lang])

                proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=300)
                json_files = [f for f in os.listdir(out_dir) if f.endswith('.json')]
                if json_files:
                    with open(os.path.join(out_dir, json_files[0]), 'r', encoding='utf-8') as jf:
                        data = json.load(jf)
                    segments = []
                    for s in data.get('segments', []):
                        text = (s.get('text') or '').strip()
                        if text:
                            segments.append({
                                'start': round(float(s.get('start', 0)), 2),
                                'duration': round(float(s.get('end', 0) - s.get('start', 0)), 2),
                                'text': text,
                            })
                    full_text = data.get('text', '').strip() or ' '.join(s['text'] for s in segments)
                    if full_text:
                        return {
                            'fullText': full_text,
                            'segments': segments,
                            'language': data.get('language', 'auto'),
                            'device': hw['device'],
                            'deviceLabel': hw['device_label'],
                            'model': hw['model_size'],
                        }
        except Exception as cli_err:
            print(f"[Whisper CLI Fallback {base_cmd[0]}] Aviso: {cli_err}")
            continue

    return None

def transcribe_with_local_whisper(audio_path: str, target_lang: str = 'auto', initial_lang: str = 'auto') -> Dict[str, Any]:
    """Transcribe un archivo de audio local con faster-whisper / ctranslate2 con segmentación robusta y preservación del idioma original."""
    try:
        model, hw = get_or_load_local_whisper_model()

        # Permitir que Whisper detecte automáticamente el idioma real del audio
        # para transcribir fielmente sin alucinaciones fonéticas si hay intros o idiomas mixtos
        language_param = initial_lang if initial_lang and initial_lang not in ('auto', 'original') else None

        segments_gen, info = model.transcribe(
            audio_path,
            language=language_param,
            task='transcribe',
            beam_size=1 if hw['device'] == 'cpu' else 5,
            vad_filter=False,
        )

        segments = []
        full_text_list = []
        for s in segments_gen:
            text = (s.text or '').strip()
            if text:
                segments.append({
                    'start': round(float(s.start), 2),
                    'duration': round(float(s.end - s.start), 2),
                    'text': text,
                })
                full_text_list.append(text)

        full_text = ' '.join(full_text_list)
        detected_lang = getattr(info, 'language', 'auto') or (initial_lang if initial_lang != 'auto' else 'auto')

        return {
            'fullText': full_text,
            'segments': segments,
            'language': detected_lang,
            'device': hw['device'],
            'deviceLabel': hw['device_label'],
            'model': hw['model_size'],
        }
    except Exception as e_trans:
        print(f"[Whisper Local] Error durante transcripción faster-whisper: {e_trans}")

    # Fallback con CLI
    cli_res = transcribe_with_whisper_cli_fallback(audio_path, target_lang='auto')
    if cli_res:
        return cli_res

    raise Layer2WhisperError("No se pudo obtener la transcripción del audio mediante el motor local.")

def fetch_layer2_local_whisper(video_id: str, target_lang: str = 'auto') -> Tuple[Optional[Dict[str, Any]], Optional[str], Optional[str]]:
    """
    Capa 2: Descarga de audio ligero (16kHz mono mp3) con yt-dlp + Inferencia Local con Whisper.
    Devuelve (result_dict, error_type, error_msg) o (None, error_type, error_msg).
    """
    temp_dir = None
    try:
        temp_dir = tempfile.mkdtemp()
        audio_path, video_title, video_lang = download_lightweight_audio_for_video(video_id, temp_dir)
        local_res = transcribe_with_local_whisper(audio_path, target_lang=target_lang, initial_lang=video_lang)

        full_text = local_res.get('fullText', '')
        segments = local_res.get('segments', [])
        detected_lang = local_res.get('language', 'auto')
        if detected_lang == 'auto' and video_lang != 'auto':
            detected_lang = video_lang
        device = local_res.get('device', 'cpu')
        device_label = local_res.get('deviceLabel', 'CPU')
        model_name = local_res.get('model', 'base')

        if full_text and len(full_text) > 10:
            if target_lang and target_lang not in ('auto', 'original'):
                try:
                    translated_segs = translate_segments(segments, target_lang)
                    full_text = ' '.join(s.get('text', '') for s in translated_segs if s.get('text'))
                    segments = translated_segs
                    detected_lang = target_lang
                except Exception as trans_e:
                    print(f"[{video_id}] Error al traducir salida de Whisper Local: {trans_e}")

            lang_name = LANGUAGE_NAMES.get(detected_lang, detected_lang.upper()) if detected_lang != 'auto' else 'Detectado'
            return ({
                'videoId': video_id,
                'videoUrl': f'https://www.youtube.com/watch?v={video_id}',
                'videoTitle': video_title,
                'fullText': full_text,
                'segments': segments,
                'method': 'whisper-local',
                'methodLabel': f'Whisper Local ({device_label} • {lang_name})',
                'language': detected_lang,
                'device': device,
                'deviceLabel': device_label,
                'model': model_name,
            }, None, None)

        return (None, 'LOCAL_WHISPER_EMPTY', 'La transcripción de audio local no produjo texto suficiente.')
    except Exception as e:
        print(f"[{video_id}] Error en Capa 2 Whisper Local: {e}")
        return (None, 'LOCAL_WHISPER_ERROR', str(e))
    finally:
        cleanup_temp_dir(temp_dir)
