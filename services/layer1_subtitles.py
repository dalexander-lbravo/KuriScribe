"""
Capa 1: Subtítulos Nativos y Oficiales de YouTube.
Consulta en cascada de baja latencia mediante YouTubeTranscriptApi, InnerTube API,
panel lateral get_transcript y yt-dlp.
"""

import os
import re
import json
import tempfile
import yt_dlp
from typing import Tuple, Optional, Dict, Any, List

from services.common_utils import (
    create_requests_session,
    DEFAULT_BROWSER_UA,
    ANDROID_USER_AGENT,
    IOS_USER_AGENT,
    LANGUAGE_NAMES,
    parse_transcript_data,
    parse_any_subtitle_payload,
    parse_innertube_get_transcript_response,
    translate_segments,
    get_configured_proxy_url,
)
from services.exceptions import Layer1SubtitleError, RateLimitOrBlockError

try:
    from youtube_transcript_api import (
        YouTubeTranscriptApi,
        TranscriptsDisabled,
        NoTranscriptFound,
        CouldNotRetrieveTranscript,
        YouTubeRequestFailed,
        IpBlocked,
        RequestBlocked,
        AgeRestricted,
        PoTokenRequired,
    )
except ImportError:
    from youtube_transcript_api import (
        YouTubeTranscriptApi,
        TranscriptsDisabled,
        NoTranscriptFound,
    )
    CouldNotRetrieveTranscript = Exception
    YouTubeRequestFailed = Exception
    IpBlocked = Exception
    RequestBlocked = Exception
    AgeRestricted = Exception
    PoTokenRequired = Exception

try:
    from youtube_transcript_api.proxies import GenericProxyConfig, WebshareProxyConfig
except ImportError:
    GenericProxyConfig = None
    WebshareProxyConfig = None

try:
    from curl_cffi import requests as curl_requests
    CURL_CFFI_AVAILABLE = True
except ImportError:
    CURL_CFFI_AVAILABLE = False
    curl_requests = None

def create_youtube_transcript_api_client():
    """Instancia YouTubeTranscriptApi con soporte para GenericProxyConfig o WebshareProxyConfig."""
    proxy_config = None
    if WebshareProxyConfig or GenericProxyConfig:
        ws_user = os.environ.get('WEBSHARE_PROXY_USERNAME')
        ws_pass = os.environ.get('WEBSHARE_PROXY_PASSWORD')
        if ws_user and ws_pass and WebshareProxyConfig:
            proxy_config = WebshareProxyConfig(
                proxy_username=ws_user,
                proxy_password=ws_pass
            )
        else:
            http_proxy = get_configured_proxy_url()
            if http_proxy and GenericProxyConfig:
                proxy_config = GenericProxyConfig(
                    http_url=http_proxy,
                    https_url=http_proxy
                )

    session = create_requests_session()
    try:
        if proxy_config:
            return YouTubeTranscriptApi(proxy_config=proxy_config, http_client=session)
        return YouTubeTranscriptApi(http_client=session)
    except Exception as e:
        print(f"[Aviso] Error al instanciar YouTubeTranscriptApi con sesión: {e}")
        try:
            return YouTubeTranscriptApi()
        except Exception:
            return YouTubeTranscriptApi

ytt_api = create_youtube_transcript_api_client()

def safe_list_transcripts(api_client, video_id: str):
    """Llama a list() o list_transcripts() según la versión disponible de youtube_transcript_api."""
    if api_client is not None:
        if hasattr(api_client, 'list') and callable(getattr(api_client, 'list')):
            return api_client.list(video_id)
        if hasattr(api_client, 'list_transcripts') and callable(getattr(api_client, 'list_transcripts')):
            return api_client.list_transcripts(video_id)

    if hasattr(YouTubeTranscriptApi, 'list') and callable(getattr(YouTubeTranscriptApi, 'list')):
        try:
            return YouTubeTranscriptApi().list(video_id)
        except TypeError:
            return YouTubeTranscriptApi.list(video_id)
    if hasattr(YouTubeTranscriptApi, 'list_transcripts') and callable(getattr(YouTubeTranscriptApi, 'list_transcripts')):
        return YouTubeTranscriptApi.list_transcripts(video_id)

    raise AttributeError("No se encontró un método de listado de subtítulos en youtube_transcript_api")

def safe_fetch_transcript(api_client, video_id: str, languages: Optional[List[str]] = None):
    """Llama a fetch() o get_transcript() según la versión disponible de youtube_transcript_api."""
    kwargs = {'languages': languages} if languages else {}
    if api_client is not None:
        if hasattr(api_client, 'fetch') and callable(getattr(api_client, 'fetch')):
            return api_client.fetch(video_id, **kwargs)
        if hasattr(api_client, 'get_transcript') and callable(getattr(api_client, 'get_transcript')):
            return api_client.get_transcript(video_id, **kwargs)

    if hasattr(YouTubeTranscriptApi, 'fetch') and callable(getattr(YouTubeTranscriptApi, 'fetch')):
        try:
            return YouTubeTranscriptApi().fetch(video_id, **kwargs)
        except TypeError:
            return YouTubeTranscriptApi.fetch(video_id, **kwargs)
    if hasattr(YouTubeTranscriptApi, 'get_transcript') and callable(getattr(YouTubeTranscriptApi, 'get_transcript')):
        return YouTubeTranscriptApi.get_transcript(video_id, **kwargs)

    raise AttributeError("No se encontró un método de obtención de subtítulos en youtube_transcript_api")

def extract_subtitles_via_get_transcript(video_id: str, target_lang: str = 'auto', session=None) -> Optional[Tuple[List[Dict[str, Any]], str, str, bool]]:
    """Capa 1C: Extracción de transcripción desde el endpoint youtubei/v1/get_transcript."""
    if session is None:
        session = create_requests_session()

    headers = {
        'User-Agent': DEFAULT_BROWSER_UA,
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json',
        'Origin': 'https://www.youtube.com',
        'Referer': f'https://www.youtube.com/watch?v={video_id}',
        'X-YouTube-Client-Name': '1',
        'X-YouTube-Client-Version': '2.20260820.08.00',
    }

    client_ctx = {
        'client': {
            'hl': 'en' if target_lang in ('auto', 'original') else target_lang,
            'gl': 'US',
            'clientName': 'WEB',
            'clientVersion': '2.20260820.08.00',
            'utcOffsetMinutes': 0,
        }
    }

    try:
        next_url = 'https://www.youtube.com/youtubei/v1/next?prettyPrint=false'
        r_next = session.post(next_url, json={'context': client_ctx, 'videoId': video_id}, headers=headers, timeout=10)
        if r_next.status_code != 200:
            return None

        data_next = r_next.json()
        params = None

        panels = data_next.get('engagementPanels', [])
        for panel in panels:
            p_renderer = panel.get('engagementPanelSectionListRenderer', {})
            p_id = p_renderer.get('panelIdentifier') or p_renderer.get('targetId') or ''
            if 'transcript' in str(p_id):
                content = p_renderer.get('content', {})
                cont = content.get('continuationItemRenderer', {})
                endpoint = cont.get('continuationEndpoint', {}).get('getTranscriptEndpoint', {})
                if endpoint.get('params'):
                    params = endpoint['params']
                    break

        if not params:
            raw_str = json.dumps(data_next)
            m = re.search(r'"getTranscriptEndpoint":\s*\{\s*"params":\s*"([^"]+)"', raw_str)
            if m:
                params = m.group(1)

        if not params:
            return None

        trans_url = 'https://www.youtube.com/youtubei/v1/get_transcript?prettyPrint=false'
        r_trans = session.post(trans_url, json={'context': client_ctx, 'params': params}, headers=headers, timeout=10)
        if r_trans.status_code != 200:
            return None

        data_trans = r_trans.json()
        segments, full_text = parse_innertube_get_transcript_response(data_trans)
        if segments and full_text and len(full_text) > 10:
            detected_code = 'auto'
            if target_lang and target_lang not in ('auto', 'original'):
                try:
                    translated_segs = translate_segments(segments, target_lang)
                    translated_text = ' '.join(s.get('text', '') for s in translated_segs if s.get('text'))
                    segments = translated_segs
                    full_text = translated_text
                    detected_code = target_lang
                except Exception as trans_e:
                    print(f"[{video_id}] Error al traducir bloques de get_transcript: {trans_e}")

            return (segments, full_text, detected_code, True)

    except Exception as e:
        print(f"[{video_id}] Error en extract_subtitles_via_get_transcript: {e}")

    return None

def extract_subtitles_via_innertube(video_id: str, target_lang: str = 'auto') -> Optional[Tuple[List[Dict[str, Any]], str, str, bool]]:
    """Capa 1B: Extracción directa de subtítulos usando InnerTube con rotación de clientes (Android, Web, iOS)."""
    clients_to_try = [
        {
            'name': 'ANDROID',
            'clientName': 'ANDROID',
            'clientVersion': '20.10.38',
            'clientHeader': '3',
            'ua': ANDROID_USER_AGENT,
            'extra': {'clientFormFactor': 'SMALL_FORM_FACTOR', 'androidSdkVersion': 34, 'osName': 'Android', 'osVersion': '14', 'platform': 'MOBILE'}
        },
        {
            'name': 'IOS',
            'clientName': 'IOS',
            'clientVersion': '20.10.4',
            'clientHeader': '5',
            'ua': IOS_USER_AGENT,
            'extra': {'deviceMake': 'Apple', 'deviceModel': 'iPhone16,2', 'osName': 'iPhone', 'osVersion': '18.3.0.22D5054f', 'platform': 'MOBILE'}
        },
        {
            'name': 'WEB',
            'clientName': 'WEB',
            'clientVersion': '2.20260820.08.00',
            'clientHeader': '1',
            'ua': DEFAULT_BROWSER_UA,
            'extra': {}
        }
    ]

    session = create_requests_session()

    for c in clients_to_try:
        try:
            player_url = "https://www.youtube.com/youtubei/v1/player?prettyPrint=false"
            payload = {
                "context": {
                    "client": {
                        "hl": "en",
                        "gl": "US",
                        "clientName": c['clientName'],
                        "clientVersion": c['clientVersion'],
                        "utcOffsetMinutes": 0,
                        **c['extra']
                    },
                    "request": {"useSsl": True}
                },
                "videoId": video_id
            }

            headers = {
                "Content-Type": "application/json",
                "Accept": "application/json",
                "User-Agent": c['ua'],
                "X-YouTube-Client-Name": c['clientHeader'],
                "X-YouTube-Client-Version": c['clientVersion'],
            }

            if c['name'] == 'WEB':
                headers['Origin'] = 'https://www.youtube.com'
                headers['Referer'] = f'https://www.youtube.com/watch?v={video_id}'

            res = session.post(player_url, json=payload, headers=headers, timeout=10)
            if res.status_code != 200:
                continue

            data = res.json()
            playability = data.get('playabilityStatus', {})
            p_status = playability.get('status')
            if p_status and p_status not in ('OK', None):
                continue

            captions = data.get('captions', {}).get('playerCaptionsTracklistRenderer', {})
            caption_tracks = captions.get('captionTracks', [])

            if not caption_tracks:
                continue

            preferred_langs = ['es', 'es-419', 'es-ES', 'en', 'en-US']
            if target_lang and target_lang not in ('auto', 'original'):
                preferred_langs.insert(0, target_lang)

            chosen_track = None
            for lang in preferred_langs:
                for track in caption_tracks:
                    if track.get('languageCode') == lang and track.get('kind') != 'asr':
                        chosen_track = track
                        break
                if chosen_track:
                    break

            if not chosen_track:
                for track in caption_tracks:
                    if track.get('kind') != 'asr':
                        chosen_track = track
                        break

            if not chosen_track:
                for lang in preferred_langs:
                    for track in caption_tracks:
                        if track.get('languageCode') == lang:
                            chosen_track = track
                            break
                    if chosen_track:
                        break

            if not chosen_track and caption_tracks:
                chosen_track = caption_tracks[0]

            if not chosen_track or not chosen_track.get('baseUrl'):
                continue

            base_track_url = chosen_track['baseUrl']
            detected_lang = chosen_track.get('languageCode', 'auto')
            is_gen = chosen_track.get('kind') == 'asr'

            urls_to_try = [
                base_track_url,
                f"{base_track_url}{'&' if '?' in base_track_url else '?'}fmt=json3",
                f"{base_track_url}{'&' if '?' in base_track_url else '?'}fmt=vtt",
                f"{base_track_url}{'&' if '?' in base_track_url else '?'}fmt=srv3",
            ]

            for u in urls_to_try:
                sub_text = None
                if CURL_CFFI_AVAILABLE and curl_requests:
                    try:
                        cr = curl_requests.get(u, headers={"User-Agent": DEFAULT_BROWSER_UA, "Referer": f"https://www.youtube.com/watch?v={video_id}"}, impersonate="chrome124", timeout=8)
                        if cr.status_code == 200 and cr.text:
                            sub_text = cr.text
                    except Exception:
                        pass

                if not sub_text:
                    try:
                        sr = session.get(u, headers={"User-Agent": DEFAULT_BROWSER_UA, "Referer": f"https://www.youtube.com/watch?v={video_id}"}, timeout=8)
                        if sr.status_code == 200 and sr.text:
                            sub_text = sr.text
                    except Exception:
                        pass

                if sub_text:
                    parsed = parse_any_subtitle_payload(sub_text)
                    if parsed[0] and parsed[1] and len(parsed[1]) > 10:
                        return (parsed[0], parsed[1], detected_lang, is_gen)

        except Exception as e:
            print(f"[{video_id}] Aviso en cliente InnerTube {c['name']}: {e}")
            continue

    return None

def extract_subtitles_via_ytdlp(video_id: str, target_lang: str = 'auto') -> Optional[Tuple[List[Dict[str, Any]], str, str, bool]]:
    """Capa 1 (Respaldo final de subtítulos): Extracción mediante yt-dlp (.vtt / .json3)."""
    try:
        url = f"https://www.youtube.com/watch?v={video_id}"

        class QuietLogger:
            def debug(self, msg): pass
            def info(self, msg): pass
            def warning(self, msg): pass
            def error(self, msg): pass

        with tempfile.TemporaryDirectory() as temp_dir:
            preferred_langs = ['all']
            if target_lang and target_lang not in ('auto', 'original'):
                preferred_langs = [target_lang, f"{target_lang}.*", 'all']

            base_opts = {
                'skip_download': True,
                'writesubtitles': True,
                'writeautomaticsub': True,
                'subtitleslangs': preferred_langs,
                'subtitlesformat': 'vtt/json3/srv3/ttml/srt/best',
                'outtmpl': os.path.join(temp_dir, '%(id)s.%(ext)s'),
                'quiet': True,
                'no_warnings': True,
                'noprogress': True,
                'logger': QuietLogger(),
                'extractor_args': {'youtube': {'player_client': ['android']}}
            }

            proxy_url = get_configured_proxy_url()
            if proxy_url:
                base_opts['proxy'] = proxy_url

            cookies_file = os.environ.get('YOUTUBE_COOKIES_FILE')
            cookies_browser = os.environ.get('YOUTUBE_COOKIES_BROWSER')
            if cookies_file and os.path.exists(cookies_file):
                base_opts['cookiefile'] = cookies_file
            elif cookies_browser:
                base_opts['cookiesfrombrowser'] = (cookies_browser,)

            info = None
            try:
                with yt_dlp.YoutubeDL(base_opts) as ydl:
                    info = ydl.extract_info(url, download=True)
            except Exception as e_ytdlp_download:
                print(f"[{video_id}] Aviso al descargar subtítulos con yt-dlp: {e_ytdlp_download}")

            sub_files = [f for f in os.listdir(temp_dir) if not f.endswith('.temp') and not f.endswith('.part')]
            if sub_files:
                for f_name in sub_files:
                    f_path = os.path.join(temp_dir, f_name)
                    try:
                        with open(f_path, 'r', encoding='utf-8', errors='ignore') as fh:
                            content = fh.read()
                        parsed = parse_any_subtitle_payload(content)
                        if parsed[0] and parsed[1] and len(parsed[1]) > 10:
                            parts = f_name.split('.')
                            lang_code = parts[1] if len(parts) >= 3 else 'auto'
                            is_gen = 'auto' in f_name.lower() or 'asr' in f_name.lower()
                            return (parsed[0], parsed[1], lang_code, is_gen)
                    except Exception as parse_e:
                        print(f"[{video_id}] Error al parsear archivo de subtítulo {f_name}: {parse_e}")

        return None
    except Exception as e:
        print(f"[{video_id}] Error general en extract_subtitles_via_ytdlp: {e}")
        return None

def fetch_layer1_subtitles(video_id: str, target_lang: str = 'auto') -> Tuple[Optional[Dict[str, Any]], Optional[str], Optional[str]]:
    """
    Capa 1: Subtítulos Nativos / Directos (Rápido, en memoria).
    Devuelve (result_dict, error_type, error_msg) o (None, error_type, error_msg).
    """
    last_error_type = 'FETCH_ERROR'
    last_error_msg = None

    # 1. YouTubeTranscriptApi
    try:
        t_list = safe_list_transcripts(ytt_api, video_id)
        if t_list is not None:
            candidate = None
            if target_lang and target_lang not in ('auto', 'original'):
                try:
                    candidate = t_list.find_manually_created_transcript([target_lang, f"{target_lang}-*"])
                except Exception:
                    try:
                        candidate = t_list.find_generated_transcript([target_lang, f"{target_lang}-*"])
                    except Exception:
                        candidate = None

            if not candidate:
                try:
                    candidate = next(iter(t_list))
                except Exception:
                    candidate = None

            if candidate:
                detected_code = getattr(candidate, 'language_code', 'auto')
                detected_name = getattr(candidate, 'language', detected_code)
                is_gen = getattr(candidate, 'is_generated', False)
                label_type = 'Generados Automáticamente' if is_gen else 'Nativos'

                fetch_target = candidate
                if target_lang and target_lang not in ('auto', 'original') and detected_code != target_lang:
                    try:
                        if hasattr(candidate, 'is_translatable') and candidate.is_translatable:
                            fetch_target = candidate.translate(target_lang)
                            detected_name = f"{detected_name} → {LANGUAGE_NAMES.get(target_lang, target_lang.upper())}"
                            detected_code = target_lang
                    except Exception as tr_err:
                        print(f"[{video_id}] Traducción nativa no disponible ({tr_err}), usando original.")

                try:
                    raw_data = fetch_target.fetch()
                    segments, full_text = parse_transcript_data(raw_data)
                    if segments and full_text and len(full_text) > 10:
                        if target_lang and target_lang not in ('auto', 'original') and detected_code != target_lang:
                            try:
                                translated_segs = translate_segments(segments, target_lang)
                                translated_text = ' '.join(s.get('text', '') for s in translated_segs if s.get('text'))
                                segments = translated_segs
                                full_text = translated_text
                                detected_name = f"{detected_name} → {LANGUAGE_NAMES.get(target_lang, target_lang.upper())}"
                            except Exception as trans_e:
                                print(f"[{video_id}] Error al traducir subtítulos nativos: {trans_e}")

                        return ({
                            'videoId': video_id,
                            'videoUrl': f'https://www.youtube.com/watch?v={video_id}',
                            'videoTitle': f'Video_{video_id}',
                            'fullText': full_text,
                            'segments': segments,
                            'method': 'youtube-native',
                            'methodLabel': f'Subtítulos {label_type} de YouTube ({detected_name})',
                            'language': detected_code,
                        }, None, None)
                except Exception as e_fetch:
                    f_err_str = str(e_fetch).lower()
                    if isinstance(e_fetch, (IpBlocked, RequestBlocked, YouTubeRequestFailed, PoTokenRequired)) or '429' in f_err_str or 'too many requests' in f_err_str:
                        last_error_type = 'RATE_LIMIT_OR_BLOCK'
                        last_error_msg = 'YouTube limitó temporalmente o bloqueó esta consulta de subtítulos (HTTP 429 / Detección automatizada).'
    except Exception as e_list:
        err_str = str(e_list).lower()
        if isinstance(e_list, (IpBlocked, RequestBlocked, YouTubeRequestFailed, PoTokenRequired)) or '429' in err_str or 'too many requests' in err_str:
            last_error_type = 'RATE_LIMIT_OR_BLOCK'
            last_error_msg = 'YouTube limitó temporalmente o bloqueó esta consulta de subtítulos (HTTP 429 / Detección automatizada).'

    # 2. safe_fetch_transcript directo
    try:
        raw_direct = None
        try:
            if target_lang and target_lang not in ('auto', 'original'):
                raw_direct = safe_fetch_transcript(ytt_api, video_id, languages=[target_lang, f"{target_lang}-419", 'en', 'es', 'auto'])
            else:
                raw_direct = safe_fetch_transcript(ytt_api, video_id)
        except Exception:
            try:
                raw_direct = safe_fetch_transcript(ytt_api, video_id)
            except Exception:
                raw_direct = None

        if raw_direct:
            segments, full_text = parse_transcript_data(raw_direct)
            if segments and full_text and len(full_text) > 10:
                return ({
                    'videoId': video_id,
                    'videoUrl': f'https://www.youtube.com/watch?v={video_id}',
                    'videoTitle': f'Video_{video_id}',
                    'fullText': full_text,
                    'segments': segments,
                    'method': 'youtube-native',
                    'methodLabel': 'Subtítulos de YouTube (Directo)',
                    'language': 'auto',
                }, None, None)
    except Exception as e_dir:
        dir_err_str = str(e_dir).lower()
        if isinstance(e_dir, (IpBlocked, RequestBlocked, YouTubeRequestFailed, PoTokenRequired)) or '429' in dir_err_str or 'too many requests' in dir_err_str:
            last_error_type = 'RATE_LIMIT_OR_BLOCK'
            last_error_msg = 'YouTube limitó temporalmente o bloqueó esta consulta de subtítulos (HTTP 429 / Detección automatizada).'

    # 3. Panel lateral nativo youtubei/v1/get_transcript
    try:
        gt_sub = extract_subtitles_via_get_transcript(video_id, target_lang=target_lang)
        if gt_sub:
            gt_segs, gt_text, gt_lang, gt_gen = gt_sub
            if gt_segs and gt_text and len(gt_text) > 10:
                gt_label = 'Generados Automáticamente' if gt_gen else 'Nativos'
                gt_lang_name = LANGUAGE_NAMES.get(gt_lang, gt_lang.upper()) if gt_lang != 'auto' else 'Panel Lateral'
                return ({
                    'videoId': video_id,
                    'videoUrl': f'https://www.youtube.com/watch?v={video_id}',
                    'videoTitle': f'Video_{video_id}',
                    'fullText': gt_text,
                    'segments': gt_segs,
                    'method': 'youtube-native',
                    'methodLabel': f'Subtítulos {gt_label} de YouTube ({gt_lang_name})',
                    'language': gt_lang or 'auto',
                }, None, None)
    except Exception as e_gt:
        print(f"[{video_id}] Error en Capa 1 get_transcript: {e_gt}")

    # 4. InnerTube API Multi-cliente
    try:
        it_sub = extract_subtitles_via_innertube(video_id, target_lang=target_lang)
        if it_sub:
            it_segs, it_text, it_lang, it_gen = it_sub
            if it_segs and it_text and len(it_text) > 10:
                it_label = 'Generados Automáticamente' if it_gen else 'Nativos'
                it_lang_name = LANGUAGE_NAMES.get(it_lang, it_lang.upper()) if it_lang else 'Detectado'
                return ({
                    'videoId': video_id,
                    'videoUrl': f'https://www.youtube.com/watch?v={video_id}',
                    'videoTitle': f'Video_{video_id}',
                    'fullText': it_text,
                    'segments': it_segs,
                    'method': 'youtube-native',
                    'methodLabel': f'Subtítulos {it_label} de YouTube ({it_lang_name})',
                    'language': it_lang or 'auto',
                }, None, None)
    except Exception as e_it:
        print(f"[{video_id}] Error en Capa 1 InnerTube: {e_it}")

    # 5. yt-dlp subtítulos directos
    try:
        ytdlp_sub = extract_subtitles_via_ytdlp(video_id, target_lang=target_lang)
        if ytdlp_sub:
            y_segs, y_text, y_lang, y_gen = ytdlp_sub
            if y_segs and y_text and len(y_text) > 10:
                if target_lang and target_lang not in ('auto', 'original') and y_lang != target_lang:
                    try:
                        translated_segs = translate_segments(y_segs, target_lang)
                        translated_text = ' '.join(s.get('text', '') for s in translated_segs if s.get('text'))
                        y_segs = translated_segs
                        y_text = translated_text
                        y_lang = target_lang
                    except Exception as trans_e:
                        print(f"[{video_id}] Error al traducir subtítulos yt-dlp: {trans_e}")

                y_label = 'Generados Automáticamente' if y_gen else 'Nativos'
                y_lang_name = LANGUAGE_NAMES.get(y_lang, y_lang.upper()) if y_lang else 'Detectado'
                return ({
                    'videoId': video_id,
                    'videoUrl': f'https://www.youtube.com/watch?v={video_id}',
                    'videoTitle': f'Video_{video_id}',
                    'fullText': y_text,
                    'segments': y_segs,
                    'method': 'youtube-native',
                    'methodLabel': f'Subtítulos {y_label} de YouTube (yt-dlp • {y_lang_name})',
                    'language': y_lang or 'auto',
                }, None, None)
    except Exception as e_yt:
        print(f"[{video_id}] Error en Capa 1 yt-dlp subtítulos: {e_yt}")

    return (None, last_error_type, last_error_msg)
