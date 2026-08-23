import unittest
import json
import os
import sys
import time
from unittest.mock import patch, MagicMock

# Asegurar que el directorio raíz esté en sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from server import (
    app,
    sanitize_filename,
    extract_video_id,
    is_valid_uuid,
    clean_expired_cache,
    ZIP_CACHE,
    MAX_BATCH_SIZE,
    parse_input_items
)

class KuriScribeServerComprehensiveTest(unittest.TestCase):
    def setUp(self):
        self.app = app.test_client()
        self.app.testing = True

    # -------------------------------------------------------------------------
    # 1. Pruebas de Salud y Cabeceras de Seguridad (CSP, Clickjacking, HSTS)
    # -------------------------------------------------------------------------
    def test_health_check(self):
        """Verifica que el endpoint /api/health responda 200 OK y JSON estructurado."""
        response = self.app.get('/api/health')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data.get('status'), 'ok')
        self.assertIn('service', data)
        self.assertIn('hardware', data)

    def test_hardware_status_endpoint(self):
        """Verifica que /api/hardware-status responda con dispositivo detectado."""
        response = self.app.get('/api/hardware-status')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIn('device', data)
        self.assertIn('deviceLabel', data)
        self.assertIn('computeType', data)

    def test_security_headers_and_clickjacking_protection(self):
        """Verifica protección contra Clickjacking (DENY + frame-ancestors) y cabeceras estrictas."""
        response = self.app.get('/api/health')
        self.assertEqual(response.headers.get('X-Content-Type-Options'), 'nosniff')
        self.assertEqual(response.headers.get('X-Frame-Options'), 'DENY')
        self.assertEqual(response.headers.get('Referrer-Policy'), 'strict-origin-when-cross-origin')
        
        csp = response.headers.get('Content-Security-Policy', '')
        self.assertIn("frame-ancestors 'none'", csp)
        self.assertIn("default-src 'self'", csp)

    # -------------------------------------------------------------------------
    # 2. Pruebas de Validación de Entradas y Protección contra Path Traversal / Zip Slip
    # -------------------------------------------------------------------------
    def test_sanitize_filename_path_traversal(self):
        """Verifica neutralización de secuencias de salto de directorio relativas y absolutas."""
        self.assertEqual(sanitize_filename('../../etc/passwd'), 'etcpasswd')
        self.assertEqual(sanitize_filename('..\\..\\windows\\system32'), 'windowssystem32')
        self.assertEqual(sanitize_filename('....//....//secret.txt'), 'secret')
        self.assertEqual(sanitize_filename('/root/admin/config.ini'), 'rootadminconfig.ini')

    def test_sanitize_filename_null_bytes_and_special_chars(self):
        """Verifica eliminación de bytes nulos, caracteres de control y caracteres inválidos."""
        self.assertEqual(sanitize_filename('archivo\x00malicioso.txt'), 'archivomalicioso')
        self.assertEqual(sanitize_filename('clase: modulo #1 * final?.txt'), 'clase_modulo_1_final')
        self.assertEqual(sanitize_filename('~`$!#&|<>:"*?'), 'transcripcion')
        self.assertEqual(sanitize_filename('   '), 'transcripcion')
        self.assertEqual(sanitize_filename(''), 'transcripcion')

    def test_sanitize_filename_length_and_unicode(self):
        """Verifica truncamiento de nombres excesivamente largos y soporte para Unicode seguro."""
        long_name = 'a' * 300
        sanitized = sanitize_filename(long_name)
        self.assertLessEqual(len(sanitized), 80)
        self.assertEqual(sanitized, 'a' * 80)

        unicode_name = 'Transcripción_Español_Matemáticas_2026'
        self.assertEqual(sanitize_filename(unicode_name), unicode_name)

    def test_extract_video_id_variations(self):
        """Verifica extracción estricta y segura de IDs de YouTube válidos (11 caracteres)."""
        self.assertEqual(extract_video_id('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ')
        self.assertEqual(extract_video_id('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ')
        self.assertEqual(extract_video_id('https://www.youtube.com/shorts/dQw4w9WgXcQ'), 'dQw4w9WgXcQ')
        self.assertEqual(extract_video_id('https://www.youtube.com/embed/dQw4w9WgXcQ'), 'dQw4w9WgXcQ')
        self.assertEqual(extract_video_id('dQw4w9WgXcQ'), 'dQw4w9WgXcQ')
        
        # Casos inválidos
        self.assertIsNone(extract_video_id(''))
        self.assertIsNone(extract_video_id(None))
        self.assertIsNone(extract_video_id('https://google.com'))
        self.assertIsNone(extract_video_id('https://youtube.com/watch?v=invalid_short_id'))
        self.assertIsNone(extract_video_id('dQw4w9WgXcQ_TOO_LONG'))

    def test_is_valid_uuid(self):
        """Verifica la validación de formato UUIDv4."""
        self.assertTrue(is_valid_uuid('c9bf9e57-1685-4c89-bafb-ff5af830be8a'))
        self.assertTrue(is_valid_uuid('C9BF9E57-1685-4C89-BAFB-FF5AF830BE8A'))
        self.assertFalse(is_valid_uuid('../../etc/passwd'))
        self.assertFalse(is_valid_uuid('not-a-uuid'))
        self.assertFalse(is_valid_uuid(''))
        self.assertFalse(is_valid_uuid(None))

    def test_parse_input_items_batch_limit(self):
        """Verifica que el procesamiento de listas acote la cantidad máxima de vídeos a MAX_BATCH_SIZE."""
        urls_list = [f'https://www.youtube.com/watch?v=dQw4w9WgXc{i:02d}' for i in range(70)]
        parsed = parse_input_items(urls_list)
        self.assertLessEqual(len(parsed), MAX_BATCH_SIZE)

    # -------------------------------------------------------------------------
    # 3. Pruebas de Control de Memoria y Caché de ZIP
    # -------------------------------------------------------------------------
    def test_clean_expired_cache(self):
        """Verifica que clean_expired_cache elimine entradas antiguas y limite memoria."""
        ZIP_CACHE.clear()
        
        # Insertar entrada caducada (hace más de 2 horas)
        ZIP_CACHE['expired-id'] = {
            'filename': 'antiguo.zip',
            'data': b'test',
            'created': time.time() - 7200
        }
        # Insertar entrada reciente
        ZIP_CACHE['recent-id'] = {
            'filename': 'nuevo.zip',
            'data': b'test',
            'created': time.time()
        }
        
        clean_expired_cache()
        self.assertNotIn('expired-id', ZIP_CACHE)
        self.assertIn('recent-id', ZIP_CACHE)
        ZIP_CACHE.clear()

    # -------------------------------------------------------------------------
    # 4. Pruebas de Respuestas y Manejo de Errores en Endpoints
    # -------------------------------------------------------------------------
    def test_transcribe_missing_url_returns_400(self):
        """Verifica que /api/transcribe sin URL retorne 400 estructurado."""
        response = self.app.post('/api/transcribe', data=json.dumps({}), content_type='application/json')
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertIn('error', data)

    def test_transcribe_invalid_url_returns_400(self):
        """Verifica que /api/transcribe con URL malformada retorne 400."""
        response = self.app.post(
            '/api/transcribe',
            data=json.dumps({'url': 'https://sitio-invalido.com/no-video'}),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertIn('error', data)

    def test_translate_missing_params_returns_400(self):
        """Verifica que /api/translate sin texto ni segmentos retorne 400."""
        response = self.app.post('/api/translate', data=json.dumps({}), content_type='application/json')
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertIn('error', data)

    def test_download_zip_invalid_and_nonexistent(self):
        """Verifica que descargar ZIP con ID inválido retorne 400 y no encontrado retorne 404."""
        bad_res = self.app.get('/api/download-zip/not-a-uuid')
        self.assertEqual(bad_res.status_code, 400)

        not_found_res = self.app.get('/api/download-zip/00000000-0000-0000-0000-000000000000')
        self.assertEqual(not_found_res.status_code, 404)

    # -------------------------------------------------------------------------
    # 5. Pruebas del Flujo Estricto de 3 Capas (Capa 1 -> Capa 2 -> Capa 3)
    # -------------------------------------------------------------------------
    def test_layer1_native_subtitles_success_flow_no_groq_needed(self):
        """Verifica que si Capa 1 tiene éxito, se devuelva 200 OK sin invocar Capa 2 ni Groq."""
        with patch('server.fetch_layer1_subtitles') as mock_l1, \
             patch('server.fetch_layer2_local_whisper') as mock_l2, \
             patch('server.transcribe_with_groq_whisper') as mock_l3:

            mock_l1.return_value = ({
                'videoId': 'dQw4w9WgXcQ',
                'videoUrl': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                'videoTitle': 'Video_dQw4w9WgXcQ',
                'fullText': 'Texto de prueba obtenido nativamente en Capa 1.',
                'segments': [{'start': 0.0, 'duration': 4.0, 'text': 'Texto de prueba'}],
                'method': 'youtube-native',
                'methodLabel': 'Subtítulos Nativos de YouTube (API)',
                'language': 'es'
            }, None, None)

            response = self.app.post(
                '/api/transcribe',
                data=json.dumps({'url': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'}),
                content_type='application/json'
            )
            self.assertEqual(response.status_code, 200)
            data = json.loads(response.data)
            self.assertEqual(data.get('method'), 'youtube-native')
            self.assertIn('Texto de prueba obtenido nativamente en Capa 1.', data.get('fullText', ''))
            mock_l2.assert_not_called()
            mock_l3.assert_not_called()

    def test_layer1_fails_layer2_local_whisper_success_no_groq(self):
        """Verifica que si Capa 1 falla, Capa 2 (Whisper Local) procese el texto sin invocar Groq Cloud."""
        with patch('server.fetch_layer1_subtitles') as mock_l1, \
             patch('server.fetch_layer2_local_whisper') as mock_l2, \
             patch('server.transcribe_with_groq_whisper') as mock_l3:

            # Capa 1 falla
            mock_l1.return_value = (None, 'SUBTITLES_NOT_FOUND', 'No transcript found')
            # Capa 2 resuelve mediante faster-whisper local
            mock_l2.return_value = ({
                'videoId': 'dQw4w9WgXcQ',
                'videoUrl': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                'videoTitle': 'Video_dQw4w9WgXcQ',
                'fullText': 'Texto de subtítulos extraído con éxito por Whisper Local en Capa 2.',
                'segments': [{'start': 0.0, 'duration': 5.0, 'text': 'Texto de subtítulos extraído'}],
                'method': 'whisper-local',
                'methodLabel': 'Whisper Local (CPU • Español)',
                'language': 'es',
                'device': 'cpu',
                'deviceLabel': 'CPU',
            }, None, None)

            response = self.app.post(
                '/api/transcribe',
                data=json.dumps({'url': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'}),
                content_type='application/json'
            )
            self.assertEqual(response.status_code, 200)
            data = json.loads(response.data)
            self.assertEqual(data.get('method'), 'whisper-local')
            self.assertIn('Capa 2', data.get('fullText', ''))
            mock_l2.assert_called_once()
            # Groq NO debe ser invocado porque no se pasó clave y Capa 2 resolvió el audio
            mock_l3.assert_not_called()

    def test_layer1_and_layer2_fail_layer3_groq_success(self):
        """Verifica que si Capa 1 y Capa 2 fallan, se ejecute Capa 3 con Groq Whisper Turbo."""
        with patch('server.fetch_layer1_subtitles') as mock_l1, \
             patch('server.fetch_layer2_local_whisper') as mock_l2, \
             patch('server.transcribe_with_groq_whisper') as mock_l3:

            mock_l1.return_value = (None, 'RATE_LIMIT_OR_BLOCK', 'HTTP 429')
            mock_l2.return_value = (None, 'LOCAL_WHISPER_ERROR', 'Whisper error')
            mock_l3.return_value = {
                'videoId': 'dQw4w9WgXcQ',
                'videoUrl': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                'videoTitle': 'Video_dQw4w9WgXcQ',
                'fullText': 'Transcripción generada por Groq Whisper Turbo en Capa 3.',
                'segments': [{'start': 0.0, 'duration': 3.0, 'text': 'Transcripción generada'}],
                'method': 'groq-whisper-turbo',
                'methodLabel': 'Groq Cloud (Whisper Turbo • Español)',
                'language': 'es'
            }

            response = self.app.post(
                '/api/transcribe',
                data=json.dumps({'url': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'groqApiKey': 'gsk_test_mock_12345678901234567890'}),
                content_type='application/json'
            )
            self.assertEqual(response.status_code, 200)
            data = json.loads(response.data)
            self.assertEqual(data.get('method'), 'groq-whisper-turbo')
            mock_l3.assert_called_once()

    def test_no_subtitles_and_no_local_and_no_groq_returns_groq_key_required(self):
        """Verifica que si Capa 1 y 2 fallan y no hay Groq API key, retorne 400 con GROQ_KEY_REQUIRED."""
        with patch('server.fetch_layer1_subtitles') as mock_l1, \
             patch('server.fetch_layer2_local_whisper') as mock_l2, \
             patch.dict(os.environ, {'ALLOW_SERVER_KEY_FALLBACK': 'false', 'GROQ_API_KEY': ''}):
            mock_l1.return_value = (None, 'NO_TRANSCRIPT_AVAILABLE', 'Sin subtítulos')
            mock_l2.return_value = (None, 'LOCAL_WHISPER_EMPTY', 'Vacio')

            response = self.app.post(
                '/api/transcribe',
                data=json.dumps({'url': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'}),
                content_type='application/json'
            )
            self.assertEqual(response.status_code, 400)
            data = json.loads(response.data)
            self.assertEqual(data.get('errorType'), 'GROQ_KEY_REQUIRED')

    def test_transcribe_batch_concurrent_and_zip_creation(self):
        """Verifica que el procesamiento en lote cree correctamente un archivo ZIP descargable."""
        with patch('server.fetch_layer1_subtitles') as mock_l1:
            mock_l1.return_value = ({
                'videoId': 'dQw4w9WgXcQ',
                'videoUrl': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                'videoTitle': 'Video_Batch_Test',
                'fullText': 'Texto para lote de pruebas.',
                'segments': [{'start': 0.0, 'duration': 2.0, 'text': 'Texto para lote'}],
                'method': 'youtube-native',
                'methodLabel': 'Subtítulos Nativos de YouTube',
                'language': 'es'
            }, None, None)

            response = self.app.post(
                '/api/transcribe-batch',
                data=json.dumps({
                    'items': [{'url': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'customName': 'clase_01'}],
                    'zipName': 'lote_prueba.zip'
                }),
                content_type='application/json'
            )
            self.assertEqual(response.status_code, 200)
            data = json.loads(response.data)
            self.assertEqual(data.get('totalCount'), 1)
            self.assertEqual(data.get('successCount'), 1)
            self.assertIn('downloadUrl', data)
            self.assertTrue(data.get('zipFilename').endswith('.zip'))

            # Comprobar la descarga del ZIP generado
            batch_id = data.get('batchId')
            zip_res = self.app.get(f'/api/download-zip/{batch_id}')
            self.assertEqual(zip_res.status_code, 200)
            self.assertEqual(zip_res.mimetype, 'application/zip')

    def test_transcribe_batch_stream_events(self):
        """Verifica que el endpoint de streaming por lotes emita eventos SSE válidos y genere el ZIP sin NameError."""
        with patch('server.fetch_layer1_subtitles') as mock_l1:
            mock_l1.return_value = ({
                'videoId': 'dQw4w9WgXcQ',
                'videoUrl': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                'videoTitle': 'Video_Stream_Test',
                'fullText': 'Texto para streaming de lotes.',
                'segments': [{'start': 0.0, 'duration': 2.0, 'text': 'Texto'}],
                'method': 'youtube-native',
                'methodLabel': 'Subtítulos Nativos',
                'language': 'es'
            }, None, None)

            response = self.app.post(
                '/api/transcribe-batch-stream',
                data=json.dumps({
                    'items': [{'url': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'customName': 'stream_01'}],
                    'zipName': 'stream_lote.zip'
                }),
                content_type='application/json'
            )
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.mimetype, 'text/event-stream')
            content = response.data.decode('utf-8')
            self.assertIn('"type": "init"', content)
            self.assertIn('"type": "complete"', content)
            self.assertIn('stream_lote.zip', content)

if __name__ == '__main__':
    unittest.main()

