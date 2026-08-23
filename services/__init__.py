"""
Paquete de servicios para KuriScribe.

Proporciona la arquitectura modular de 3 capas para la transcripción inteligente
de vídeos de YouTube a texto:
- Capa 1: Subtítulos Nativos y Oficiales de YouTube (YouTubeTranscriptApi, InnerTube, yt-dlp).
- Capa 2: Motor de Inferencia Local Autónomo (faster-whisper con aceleración CUDA/CPU).
- Capa 3: Inferencia en la Nube mediante Groq Cloud API (Whisper Turbo).
- Módulos auxiliares: Procesamiento de audio, traducción automática, saneamiento y excepciones.
"""

from services.common_utils import (
    sanitize_filename,
    extract_video_id,
    is_valid_uuid,
    translate_text,
    translate_segments,
    LANGUAGE_NAMES,
)
from services.exceptions import (
    KuriScribeError,
    Layer1SubtitleError,
    RateLimitOrBlockError,
    Layer2WhisperError,
    LocalWhisperEmptyError,
    Layer3GroqError,
    GroqKeyRequiredError,
    AudioExtractionError,
)
from services.audio_utils import (
    download_lightweight_audio_for_video,
    cleanup_temp_dir,
    get_audio_duration_seconds,
)
from services.layer1_subtitles import fetch_layer1_subtitles
from services.layer2_whisper import (
    fetch_layer2_local_whisper,
    detect_whisper_hardware,
    transcribe_with_local_whisper,
)
from services.layer3_groq import transcribe_with_groq_whisper

__all__ = [
    "sanitize_filename",
    "extract_video_id",
    "is_valid_uuid",
    "translate_text",
    "translate_segments",
    "LANGUAGE_NAMES",
    "KuriScribeError",
    "Layer1SubtitleError",
    "RateLimitOrBlockError",
    "Layer2WhisperError",
    "LocalWhisperEmptyError",
    "Layer3GroqError",
    "GroqKeyRequiredError",
    "AudioExtractionError",
    "download_lightweight_audio_for_video",
    "cleanup_temp_dir",
    "get_audio_duration_seconds",
    "fetch_layer1_subtitles",
    "fetch_layer2_local_whisper",
    "detect_whisper_hardware",
    "transcribe_with_local_whisper",
    "transcribe_with_groq_whisper",
]
