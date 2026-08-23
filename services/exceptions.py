"""
Módulo de excepciones personalizadas para KuriScribe.
Define la jerarquía de errores para cada capa del sistema de transcripción.
"""

class KuriScribeError(Exception):
    """Excepción base para todos los errores de la aplicación KuriScribe."""
    def __init__(self, message: str, error_type: str = "INTERNAL_ERROR"):
        super().__init__(message)
        self.message = message
        self.error_type = error_type

class Layer1SubtitleError(KuriScribeError):
    """Error al intentar obtener subtítulos nativos en la Capa 1."""
    def __init__(self, message: str = "No se pudieron obtener subtítulos nativos oficiales.", error_type: str = "SUBTITLES_NOT_FOUND"):
        super().__init__(message, error_type)

class RateLimitOrBlockError(Layer1SubtitleError):
    """YouTube limitó temporalmente o bloqueó la consulta de subtítulos (HTTP 429)."""
    def __init__(self, message: str = "YouTube limitó temporalmente esta consulta de subtítulos (HTTP 429).", error_type: str = "RATE_LIMIT_OR_BLOCK"):
        super().__init__(message, error_type)

class Layer2WhisperError(KuriScribeError):
    """Error durante la inferencia de audio local en la Capa 2."""
    def __init__(self, message: str = "Error en el motor local de Whisper.", error_type: str = "LOCAL_WHISPER_ERROR"):
        super().__init__(message, error_type)

class LocalWhisperEmptyError(Layer2WhisperError):
    """La inferencia de audio local no generó texto suficiente."""
    def __init__(self, message: str = "La transcripción de audio local no produjo texto suficiente.", error_type: str = "LOCAL_WHISPER_EMPTY"):
        super().__init__(message, error_type)

class Layer3GroqError(KuriScribeError):
    """Error durante la inferencia en la nube mediante Groq Cloud en la Capa 3."""
    def __init__(self, message: str = "Error al comunicarse con la API de Groq Cloud.", error_type: str = "GROQ_API_ERROR"):
        super().__init__(message, error_type)

class GroqKeyRequiredError(Layer3GroqError):
    """Se requiere una clave API válida de Groq para transcribir en la nube."""
    def __init__(self, message: str = "No fue posible transcribir mediante subtítulos oficiales ni con el motor local. Configura tu API Key gratuita de Groq.", error_type: str = "GROQ_KEY_REQUIRED"):
        super().__init__(message, error_type)

class AudioExtractionError(KuriScribeError):
    """Error durante la descarga o extracción del flujo de audio ligero con yt-dlp/ffmpeg."""
    def __init__(self, message: str = "No se pudo descargar el flujo de audio del video.", error_type: str = "AUDIO_DOWNLOAD_FAILED"):
        super().__init__(message, error_type)
