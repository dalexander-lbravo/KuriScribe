"""
Utilidades comunes para el procesamiento de texto, saneamiento, validación,
parcheo de subtítulos multiformato y traducción.
"""

import os
import re
import html
import json
import time
import requests
import http.cookiejar
from typing import List, Dict, Tuple, Optional, Any
from deep_translator import GoogleTranslator

DEFAULT_BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36"
ANDROID_USER_AGENT = "com.google.android.youtube/20.10.38 (Linux; U; Android 14; en_US; Pixel 8 Pro; Build/AP1A.240405.002)"
IOS_USER_AGENT = "com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3 like Mac OS X; en_US)"

LANGUAGE_NAMES = {
    'es': 'Español',
    'en': 'Inglés',
    'fr': 'Francés',
    'de': 'Alemán',
    'it': 'Italiano',
    'pt': 'Portugués',
    'ja': 'Japonés',
    'zh-CN': 'Chino (Simplificado)',
    'ru': 'Ruso',
    'ar': 'Árabe',
    'hi': 'Hindi',
    'ko': 'Coreano',
    'nl': 'Holandés',
    'tr': 'Turco',
    'pl': 'Polaco',
    'sv': 'Sueco',
    'vi': 'Vietnamita',
    'id': 'Indonesio',
    'uk': 'Ucraniano',
    'el': 'Griego',
    'cs': 'Checo',
    'ro': 'Rumano',
    'hu': 'Húngaro',
    'da': 'Danés',
    'fi': 'Finés',
    'no': 'Noruego',
    'th': 'Tailandés',
}

def sanitize_filename(name: str) -> str:
    """Sanea el nombre de archivo y previene ataques de salto de directorio (Path Traversal / Zip Slip)."""
    if not name:
        return 'transcripcion'
    name = str(name).strip()
    name = re.sub(r'[\x00-\x1f\x7f]', '', name)
    if name.lower().endswith('.txt'):
        name = name[:-4]
    while '..' in name:
        name = name.replace('..', '')
    name = name.replace('/', '').replace('\\', '')
    name = re.sub(r'[\\/*?:"<>|~`$!#&]', '', name)
    name = re.sub(r'\s+', '_', name).strip('._-')
    return name[:80] or 'transcripcion'

def extract_video_id(url_or_id: Optional[str]) -> Optional[str]:
    """Extrae y valida el identificador de exactamente 11 caracteres de un vídeo de YouTube."""
    if not url_or_id:
        return None
    url_or_id = str(url_or_id).strip()

    if re.fullmatch(r'^[a-zA-Z0-9_-]{11}$', url_or_id):
        return url_or_id

    regex = r'(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts|live)\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[?&#\/\s]|$)'
    match = re.search(regex, url_or_id)
    if match:
        vid = match.group(1)
        if re.fullmatch(r'^[a-zA-Z0-9_-]{11}$', vid):
            return vid

    return None

def is_valid_uuid(val: str) -> bool:
    """Comprueba si una cadena cumple el formato UUIDv4."""
    if not val or not isinstance(val, str):
        return False
    return bool(re.match(r'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$', val.lower()))

def get_configured_proxy_url() -> Optional[str]:
    """Retorna la URL del proxy HTTP/HTTPS si está configurada en las variables de entorno."""
    return (
        os.environ.get('YOUTUBE_HTTPS_PROXY')
        or os.environ.get('YOUTUBE_PROXY')
        or os.environ.get('HTTPS_PROXY')
        or os.environ.get('HTTP_PROXY')
        or os.environ.get('https_proxy')
        or os.environ.get('http_proxy')
    )

def create_requests_session() -> requests.Session:
    """Crea una sesión requests configurada con User-Agent realista, cookies y proxies opcionales."""
    session = requests.Session()
    session.headers.update({
        "User-Agent": DEFAULT_BROWSER_UA,
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9,es;q=0.8",
        "Accept-Encoding": "gzip, deflate",
    })
    
    proxy_url = get_configured_proxy_url()
    if proxy_url:
        session.proxies = {
            'http': proxy_url,
            'https': proxy_url
        }

    cookies_file = os.environ.get('YOUTUBE_COOKIES_FILE')
    if cookies_file and os.path.exists(cookies_file):
        try:
            cj = http.cookiejar.MozillaCookieJar(cookies_file)
            cj.load(ignore_discard=True, ignore_expires=True)
            session.cookies.update(cj)
        except Exception as e:
            print(f"[Aviso] No se pudieron cargar cookies desde {cookies_file}: {e}")

    return session

def is_valid_translation_text(text: str) -> bool:
    """Comprueba que la respuesta del traductor no sea una página de error o bloqueo."""
    if not text or not isinstance(text, str):
        return False
    text_s = text.strip()
    if not text_s:
        return False
    if text_s.startswith('Error ') or 'That’s an error' in text_s or '<html>' in text_s.lower() or 'Server Error' in text_s or 'MYMEMORY WARNING' in text_s:
        return False
    return True

def fast_translate_single_text(text: str, target_lang: str = 'es', session: Optional[requests.Session] = None) -> str:
    """Traduce un bloque de texto usando Google Translate con sesión configurada y fallback de alta velocidad."""
    if not text or not text.strip() or target_lang in ('auto', 'original'):
        return text

    target_lang = 'zh-CN' if target_lang.lower() in ('zh', 'zh-cn', 'chinese') else target_lang.lower()

    if session is None:
        session = create_requests_session()

    # 1. Endpoint móvil directo con User-Agent de navegador (ultra-rápido, ~0.3s)
    try:
        url = 'https://translate.google.com/m'
        params = {
            'sl': 'auto',
            'tl': target_lang,
            'q': text[:4500],
        }
        resp = session.get(url, params=params, timeout=6)
        if resp.status_code == 200:
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(resp.text, 'html.parser')
            res_div = soup.find('div', class_='result-container')
            if res_div:
                res_text = res_div.get_text(strip=True)
                if is_valid_translation_text(res_text):
                    return res_text
    except Exception:
        pass

    # 2. Fallback con deep_translator
    try:
        translator = GoogleTranslator(source='auto', target=target_lang)
        res = translator.translate(text[:4500])
        if is_valid_translation_text(res):
            return res
    except Exception:
        pass

    return text

def translate_text(text: str, target_lang: str = 'es') -> str:
    """Traduce bloques de texto completos preservando y traduciendo oraciones individuales (intros, citas y cuerpo)."""
    if not text or not text.strip() or target_lang in ('auto', 'original'):
        return text

    session = create_requests_session()
    paragraphs = [p.strip() for p in text.split('\n') if p.strip()]
    if not paragraphs:
        paragraphs = [text.strip()]

    translated_paragraphs = []
    for paragraph in paragraphs:
        if len(paragraph) > 250:
            # Dividir en oraciones individuales para asegurar que intros en otro idioma se traduzcan
            sentences = re.split(r'(?<=[.!?])\s+', paragraph)
            tr_sentences = [
                fast_translate_single_text(s.strip(), target_lang=target_lang, session=session)
                for s in sentences if s.strip()
            ]
            translated_paragraphs.append(' '.join(tr_sentences))
        else:
            tr = fast_translate_single_text(paragraph, target_lang=target_lang, session=session)
            translated_paragraphs.append(tr)

    return '\n'.join(translated_paragraphs) if translated_paragraphs else text

def translate_segments(segments: List[Dict[str, Any]], target_lang: str = 'es') -> List[Dict[str, Any]]:
    """Traduce segmentos de audio conservando marcas de tiempo exactas en paralelo de forma ultrarrápida."""
    if not segments or target_lang in ('auto', 'original'):
        return segments

    from concurrent.futures import ThreadPoolExecutor

    session = create_requests_session()

    def translate_one(seg_dict):
        orig_text = seg_dict.get('text', '')
        if not orig_text or not orig_text.strip():
            return seg_dict
        tr = fast_translate_single_text(orig_text, target_lang=target_lang, session=session)
        new_dict = dict(seg_dict)
        new_dict['text'] = tr if is_valid_translation_text(tr) else orig_text
        return new_dict

    try:
        max_workers = min(10, max(2, len(segments) // 4))
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            return list(executor.map(translate_one, segments))
    except Exception as e:
        print(f"Error al traducir segmentos concurrentemente: {e}")
        return segments

def extract_item_field(item: Any, field_name: str, default: Any = '') -> Any:
    """Extrae un campo de un elemento que puede ser diccionario o un objeto con atributos."""
    if isinstance(item, dict):
        return item.get(field_name, default)
    return getattr(item, field_name, default)

def parse_transcript_data(transcript_data: Any) -> Tuple[Optional[List[Dict[str, Any]]], Optional[str]]:
    """Parsea y valida los datos de transcripción soportando estructuras de diccionario, objetos FetchedTranscript y decodificación HTML."""
    if not transcript_data:
        return None, None

    items = transcript_data
    if hasattr(transcript_data, 'snippets'):
        items = transcript_data.snippets
    elif hasattr(transcript_data, 'to_raw_data') and callable(getattr(transcript_data, 'to_raw_data')):
        try:
            items = transcript_data.to_raw_data()
        except Exception:
            items = transcript_data

    segments = []
    full_text_parts = []
    for item in items:
        raw_val = extract_item_field(item, 'text', '') or ''
        text = html.unescape(str(raw_val)).strip()
        if not text:
            continue
        try:
            start = round(float(extract_item_field(item, 'start', 0)), 2)
            duration = round(float(extract_item_field(item, 'duration', 0)), 2)
        except (ValueError, TypeError):
            start = 0.0
            duration = 0.0

        segments.append({
            'start': start,
            'duration': duration,
            'text': text
        })
        full_text_parts.append(text)

    if not segments:
        return None, None
    return segments, ' '.join(full_text_parts)

def parse_timedtext_xml(xml_text: str) -> Tuple[Optional[List[Dict[str, Any]]], Optional[str]]:
    """Parsea respuestas de subtítulos en formato XML estándar de YouTube."""
    if not xml_text:
        return None, None
    segments = []
    full_text_parts = []
    pattern = r'<text\s+start="([^"]*)"(?:\s+dur="([^"]*)")?[^>]*>([\s\S]*?)<\/text>'
    for m in re.finditer(pattern, xml_text):
        raw = m.group(3)
        if not raw:
            continue
        clean_text = re.sub(r'<[^>]+>', '', raw)
        clean_text = html.unescape(clean_text).strip()
        if not clean_text:
            continue
        try:
            start = round(float(m.group(1)), 2)
            duration = round(float(m.group(2) or 0), 2)
        except (ValueError, TypeError):
            start = 0.0
            duration = 0.0
        segments.append({'start': start, 'duration': duration, 'text': clean_text})
        full_text_parts.append(clean_text)
    if not segments:
        return None, None
    return segments, ' '.join(full_text_parts)

def parse_timedtext_json3(json3_text: Any) -> Tuple[Optional[List[Dict[str, Any]]], Optional[str]]:
    """Parsea respuestas de subtítulos en formato json3 de YouTube."""
    if not json3_text:
        return None, None
    try:
        data = json.loads(json3_text) if isinstance(json3_text, str) else json3_text
        events = data.get('events', [])
        segments = []
        full_text_parts = []
        for ev in events:
            if 'segs' in ev:
                t_start = round(ev.get('tStartMs', 0) / 1000.0, 2)
                d_duration = round(ev.get('dDurationMs', 0) / 1000.0, 2)
                raw_s_text = "".join(s.get('utf8', '') for s in ev['segs'])
                text = html.unescape(raw_s_text).strip()
                if text and text != '\n':
                    segments.append({'start': t_start, 'duration': d_duration, 'text': text})
                    full_text_parts.append(text)
        if segments and full_text_parts:
            return segments, ' '.join(full_text_parts)
    except Exception:
        pass
    return None, None

def parse_timedtext_vtt(vtt_text: str) -> Tuple[Optional[List[Dict[str, Any]]], Optional[str]]:
    """Parsea subtítulos en formato WebVTT o SRT."""
    if not vtt_text:
        return None, None
    segments = []
    full_text_parts = []
    lines = vtt_text.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if '-->' in line:
            m = re.search(r'(?:(\d{1,2}):)?(\d{1,2}):(\d{2})[\.,](\d{3})\s*-->\s*(?:(\d{1,2}):)?(\d{1,2}):(\d{2})[\.,](\d{3})', line)
            start = 0.0
            duration = 0.0
            if m:
                h1 = int(m.group(1) or 0)
                m1 = int(m.group(2))
                s1 = int(m.group(3))
                ms1 = int(m.group(4))
                t1 = h1 * 3600 + m1 * 60 + s1 + ms1 / 1000.0

                h2 = int(m.group(5) or 0)
                m2 = int(m.group(6))
                s2 = int(m.group(7))
                ms2 = int(m.group(8))
                t2 = h2 * 3600 + m2 * 60 + s2 + ms2 / 1000.0

                start = round(t1, 2)
                duration = round(max(0.0, t2 - t1), 2)

            i += 1
            text_lines = []
            while i < len(lines) and lines[i].strip():
                clean_l = re.sub(r'<[^>]+>', '', lines[i].strip())
                clean_l = html.unescape(clean_l).strip()
                if clean_l and not clean_l.isdigit():
                    text_lines.append(clean_l)
                i += 1
            if text_lines:
                t_block = ' '.join(text_lines)
                segments.append({'start': start, 'duration': duration, 'text': t_block})
                full_text_parts.append(t_block)
        else:
            i += 1
    if segments and full_text_parts:
        return segments, ' '.join(full_text_parts)
    return None, None

def parse_any_subtitle_payload(payload: Any) -> Tuple[Optional[List[Dict[str, Any]]], Optional[str]]:
    """Detecta automáticamente el formato (json3, vtt, xml) y extrae los segmentos."""
    if not payload:
        return None, None
    payload_str = payload.decode('utf-8', errors='ignore') if isinstance(payload, bytes) else str(payload)
    stripped = payload_str.strip()
    if stripped.startswith('{') or 'events' in stripped:
        parsed = parse_timedtext_json3(stripped)
        if parsed[0]:
            return parsed
    if '-->' in stripped or stripped.startswith('WEBVTT'):
        parsed = parse_timedtext_vtt(stripped)
        if parsed[0]:
            return parsed
    if '<text' in stripped or '<transcript' in stripped:
        parsed = parse_timedtext_xml(stripped)
        if parsed[0]:
            return parsed
    return None, None

def parse_innertube_get_transcript_response(data: Any) -> Tuple[List[Dict[str, Any]], str]:
    """
    Parsea la respuesta JSON del endpoint youtubei/v1/get_transcript, extrayendo los segmentos
    de tiempo y texto de 'initialSegments', 'transcriptSegmentRenderer', 'cueGroups' o 'transcriptCueRenderer'.
    """
    if not data or not isinstance(data, dict):
        return [], ""

    segments = []
    full_text_list = []

    def extract_nodes(obj):
        found = []
        if isinstance(obj, dict):
            if 'transcriptSegmentRenderer' in obj:
                found.append(('segment', obj['transcriptSegmentRenderer']))
            elif 'transcriptCueGroupRenderer' in obj:
                found.append(('cueGroup', obj['transcriptCueGroupRenderer']))
            elif 'transcriptCueRenderer' in obj:
                found.append(('cue', obj['transcriptCueRenderer']))
            else:
                for v in obj.values():
                    found.extend(extract_nodes(v))
        elif isinstance(obj, list):
            for item in obj:
                found.extend(extract_nodes(item))
        return found

    nodes = extract_nodes(data)
    for node_type, node in nodes:
        if node_type == 'segment':
            runs = node.get('snippet', {}).get('runs', [])
            text = ''.join(r.get('text', '') for r in runs if isinstance(r, dict)).strip()
            if not text and 'simpleText' in node.get('snippet', {}):
                text = node['snippet']['simpleText'].strip()
            
            if not text:
                continue

            try:
                start_ms = float(node.get('startMs', 0))
                end_ms = float(node.get('endMs', start_ms))
                start_sec = round(start_ms / 1000.0, 2)
                dur_sec = round(max(0.0, (end_ms - start_ms) / 1000.0), 2)
            except (ValueError, TypeError):
                start_sec = 0.0
                dur_sec = 0.0

            clean_text = html.unescape(text)
            segments.append({
                'start': start_sec,
                'duration': dur_sec,
                'text': clean_text
            })
            full_text_list.append(clean_text)

        elif node_type == 'cueGroup':
            cues = node.get('cues', [])
            for cue_item in cues:
                cue = cue_item.get('transcriptCueRenderer', cue_item)
                runs = cue.get('cue', {}).get('runs', [])
                text = ''.join(r.get('text', '') for r in runs if isinstance(r, dict)).strip()
                if not text:
                    text = cue.get('cue', {}).get('simpleText', '').strip()
                if not text:
                    continue

                try:
                    start_ms = float(cue.get('startOffsetMs', 0))
                    dur_ms = float(cue.get('durationMs', 0))
                    start_sec = round(start_ms / 1000.0, 2)
                    dur_sec = round(dur_ms / 1000.0, 2)
                except (ValueError, TypeError):
                    start_sec = 0.0
                    dur_sec = 0.0

                clean_text = html.unescape(text)
                segments.append({
                    'start': start_sec,
                    'duration': dur_sec,
                    'text': clean_text
                })
                full_text_list.append(clean_text)

        elif node_type == 'cue':
            runs = node.get('cue', {}).get('runs', [])
            text = ''.join(r.get('text', '') for r in runs if isinstance(r, dict)).strip()
            if not text:
                text = node.get('cue', {}).get('simpleText', '').strip()
            if not text:
                continue

            try:
                start_ms = float(node.get('startOffsetMs', 0))
                dur_ms = float(node.get('durationMs', 0))
                start_sec = round(start_ms / 1000.0, 2)
                dur_sec = round(dur_ms / 1000.0, 2)
            except (ValueError, TypeError):
                start_sec = 0.0
                dur_sec = 0.0

            clean_text = html.unescape(text)
            segments.append({
                'start': start_sec,
                'duration': dur_sec,
                'text': clean_text
            })
            full_text_list.append(clean_text)

    full_text = ' '.join(full_text_list)
    return segments, full_text

