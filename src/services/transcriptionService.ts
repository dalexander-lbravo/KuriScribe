import JSZip from 'jszip'
import saveAs from 'file-saver'

const isTauri =
  typeof window !== 'undefined' &&
  ('__TAURI_INTERNALS__' in window ||
    '__TAURI__' in window ||
    window.location.protocol === 'tauri:' ||
    window.location.protocol === 'asset:' ||
    window.location.origin.includes('tauri'))

export const API_BASE = isTauri ? 'http://127.0.0.1:5000' : ''

export interface HardwareStatus {
  device: 'cuda' | 'cpu'
  deviceLabel: string
  computeType: string
  modelSize: string
}

export async function fetchHardwareStatus(): Promise<HardwareStatus> {
  try {
    const res = await fetch(`${API_BASE}/api/hardware-status`)
    if (res.ok) {
      return await res.json()
    }
  } catch (err) {
    console.warn('No se pudo obtener el estado de hardware:', err)
  }
  return {
    device: 'cpu',
    deviceLabel: 'CPU',
    computeType: 'int8',
    modelSize: 'base',
  }
}

export interface TranscriptSegment {
  start: number
  duration?: number
  text: string
}

export interface TranscriptionResult {
  videoId: string
  videoTitle?: string
  videoUrl: string
  fullText: string
  segments: TranscriptSegment[]
  method: 'youtube-native' | 'whisper-local' | 'groq-whisper-turbo'
  methodLabel: string
  processingTimeSec: number
  language?: string
  status?: 'queued' | 'transcribing' | 'completed' | 'error'
  error?: string
  customName?: string
  device?: 'cuda' | 'cpu'
  deviceLabel?: string
  model?: string
}

export interface BatchItemState {
  videoId: string
  videoUrl: string
  title: string
  customName?: string
  status: 'queued' | 'transcribing' | 'completed' | 'error'
  methodLabel?: string
  processingTimeSec?: number
  fullText?: string
  segments?: TranscriptSegment[]
  error?: string
  device?: 'cuda' | 'cpu'
  deviceLabel?: string
  model?: string
  language?: string
  currentStep?: 1 | 2 | 3
  stepMessage?: string
}

export interface BatchInputItem {
  id: string
  url: string
  customName: string
}

export interface BatchResult {
  batchId: string
  zipFilename: string
  downloadUrl: string
  results: BatchItemState[]
  totalCount: number
  successCount: number
  totalTimeSec: number
}

export interface TranscriptionProgress {
  step: 1 | 2 | 3
  statusMessage: string
  detail?: string
  device?: 'cuda' | 'cpu'
  deviceLabel?: string
  currentVideoIndex?: number
  totalVideos?: number
  completedVideos?: number
  currentlyProcessingTitle?: string
}

/**
 * Extracts YouTube video ID from various YouTube URL formats.
 */
export function extractYouTubeVideoId(url: string): string | null {
  if (!url || typeof url !== 'string') return null

  const trimmed = url.trim()

  const regExp = /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?|shorts|live)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/i
  const match = trimmed.match(regExp)

  if (match && match[1]) {
    return match[1]
  }

  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed
  }

  return null
}

/**
 * Parses raw user input to detect multiple video URLs or Playlist URL.
 */
export function parseInputToVideos(rawInput: string): Array<{ videoId: string; url: string }> {
  if (!rawInput) return []

  const lines = rawInput.split('\n')
  const found: Array<{ videoId: string; url: string }> = []
  const seen = new Set<string>()

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const vid = extractYouTubeVideoId(trimmed)
    if (vid && !seen.has(vid)) {
      seen.add(vid)
      found.push({
        videoId: vid,
        url: trimmed.startsWith('http') ? trimmed : `https://www.youtube.com/watch?v=${vid}`,
      })
    }
  }

  return found
}

/**
 * Formats time in seconds to mm:ss or hh:mm:ss format.
 */
export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00'

  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)

  if (h > 0) {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export const TARGET_LANGUAGES: LanguageOption[] = [
  { code: 'auto', name: 'Idioma Original (Detección)' },
  { code: 'es', name: 'Español' },
  { code: 'en', name: 'Inglés' },
  { code: 'pt', name: 'Portugués' },
  { code: 'fr', name: 'Francés' },
  { code: 'de', name: 'Alemán' },
  { code: 'it', name: 'Italiano' },
  { code: 'ja', name: 'Japonés' },
  { code: 'zh', name: 'Chino' },
  { code: 'ru', name: 'Ruso' },
]

export const TRANSLATION_LANGUAGES = [
  { code: 'es', name: 'Español' },
  { code: 'en', name: 'Inglés' },
  { code: 'pt', name: 'Portugués' },
  { code: 'fr', name: 'Francés' },
  { code: 'de', name: 'Alemán' },
  { code: 'it', name: 'Italiano' },
  { code: 'ja', name: 'Japonés' },
  { code: 'zh-CN', name: 'Chino (Simplificado)' },
  { code: 'ru', name: 'Ruso' },
]

export interface LanguageOption {
  code: string
  name: string
}

export interface TranslateResult {
  fullText: string
  segments: TranscriptSegment[]
  targetLanguage: string
  languageName: string
}

/**
 * Translates transcription text and its segments into target language.
 */
export async function translateTranscription(
  text: string,
  segments: TranscriptSegment[] = [],
  targetLanguage: string = 'es',
  signal?: AbortSignal
): Promise<{ fullText: string; segments: TranscriptSegment[]; targetLanguage: string; languageName: string }> {
  if (!text && (!segments || segments.length === 0)) {
    throw new Error('No hay texto o segmentos disponibles para traducir.')
  }

  if (!targetLanguage || targetLanguage === 'auto' || targetLanguage === 'original') {
    return {
      fullText: text,
      segments: segments,
      targetLanguage: targetLanguage,
      languageName: 'Idioma Original',
    }
  }

  const response = await fetch(`${API_BASE}/api/translate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    signal,
    body: JSON.stringify({
      text,
      segments,
      target_lang: targetLanguage,
      targetLanguage,
    }),
  })

  let data: any = null
  try {
    data = await response.json()
  } catch {
    throw new Error('El servidor devolvió una respuesta inesperada al traducir.')
  }

  if (!response.ok || !data || data.error) {
    throw new Error(data?.error || 'Error al traducir la transcripción.')
  }

  return {
    fullText: data.translated_text || data.fullText || text,
    segments: data.segments || segments,
    targetLanguage: data.target_lang || data.targetLanguage || targetLanguage,
    languageName: data.languageName || targetLanguage.toUpperCase(),
  }
}

/**
 * Transcribes a single YouTube video with real-time SSE stream reporting layers transition.
 */
export async function transcribeYouTubeVideo(
  urlOrId: string,
  onProgress?: (progress: TranscriptionProgress) => void,
  groqApiKey?: string,
  targetLanguage: string = 'auto',
  signal?: AbortSignal
): Promise<TranscriptionResult> {
  const videoId = extractYouTubeVideoId(urlOrId)

  if (!videoId) {
    throw new Error('Por favor, ingresa un enlace o ID de video de YouTube válido.')
  }

  onProgress?.({
    step: 1,
    statusMessage: 'Paso 1: Consultando subtítulos nativos de YouTube...',
    detail: 'Consultando subtítulos oficiales y pistas de transcripción directa.',
  })

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 180000) // 180s timeout

  const handleExternalAbort = () => {
    clearTimeout(timeoutId)
    controller.abort()
  }

  if (signal) {
    if (signal.aborted) {
      clearTimeout(timeoutId)
      controller.abort()
    } else {
      signal.addEventListener('abort', handleExternalAbort, { once: true })
    }
  }

  try {
    const response = await fetch(`${API_BASE}/api/transcribe-stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        url: urlOrId,
        groqApiKey: groqApiKey || undefined,
        targetLanguage: targetLanguage || 'auto',
      }),
    })

    if (!response.ok || !response.body) {
      // Fallback a /api/transcribe estándar
      const fallbackRes = await fetch(`${API_BASE}/api/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          url: urlOrId,
          groqApiKey: groqApiKey || undefined,
          targetLanguage: targetLanguage || 'auto',
        }),
      })
      clearTimeout(timeoutId)
      const data = await fallbackRes.json()
      if (!fallbackRes.ok || data.error) {
        throw new Error(data.error || 'Error al procesar la transcripción.')
      }
      return data as TranscriptionResult
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let finalResult: TranscriptionResult | null = null

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const rawJson = line.slice(6).trim()
        if (!rawJson) continue

        try {
          const event = JSON.parse(rawJson)
          if (event.type === 'step') {
            const stepNum = (event.step === 2 ? 2 : event.step === 3 ? 3 : 1) as 1 | 2 | 3
            onProgress?.({
              step: stepNum,
              statusMessage: event.message || (
                stepNum === 1
                  ? 'Paso 1: Consultando subtítulos nativos de YouTube...'
                  : stepNum === 2
                  ? 'Paso 2: Descargando audio e infiriendo con Whisper Local...'
                  : 'Paso 3: Procesando transcripción en la nube mediante Groq Cloud...'
              ),
              device: event.device,
              deviceLabel: event.deviceLabel,
              detail: event.detail || (
                stepNum === 1
                  ? 'Consultando subtítulos oficiales y pistas de transcripción directa.'
                  : stepNum === 2
                  ? 'Extrayendo audio mono a 16kHz y ejecutando inferencia en tu equipo.'
                  : 'Enviando audio procesado a Whisper Turbo en Groq Cloud.'
              ),
            })
          } else if (event.type === 'complete') {
            finalResult = event.result as TranscriptionResult
          } else if (event.type === 'error') {
            throw new Error(event.error || 'Error al procesar la transcripción del video.')
          }
        } catch (pe) {
          if (pe instanceof Error && pe.message !== 'Unexpected end of JSON input') {
            throw pe
          }
        }
      }
    }

    clearTimeout(timeoutId)
    if (signal) {
      signal.removeEventListener('abort', handleExternalAbort)
    }

    if (finalResult) {
      return finalResult
    }

    throw new Error('No se recibió la transcripción completa del servidor.')
  } catch (error: any) {
    clearTimeout(timeoutId)
    if (signal) {
      signal.removeEventListener('abort', handleExternalAbort)
    }
    if (error.name === 'AbortError' || signal?.aborted) {
      const abortErr = new Error('Operación cancelada por el usuario.')
      abortErr.name = 'AbortError'
      throw abortErr
    }
    if (error.message && (error.message.includes('Failed to fetch') || error.message.includes('NetworkError'))) {
      throw new Error(
        'No se pudo conectar con el servidor backend de KuriScribe. Verifica que el servidor esté activo.'
      )
    }
    throw error
  }
}

/**
 * Transcribes a batch of videos concurrently with live SSE real-time updates,
 * layer transition indicators per video, individual custom filenames, and in-memory ZIP compression.
 */
export async function transcribeBatchVideos(
  itemsOrInput: BatchInputItem[] | string,
  zipName: string,
  onProgress?: (progress: TranscriptionProgress) => void,
  onItemsUpdate?: (items: BatchItemState[]) => void,
  groqApiKey?: string,
  targetLanguage: string = 'auto',
  signal?: AbortSignal
): Promise<BatchResult> {
  const normalizedZip = zipName.trim()
    ? zipName.trim().endsWith('.zip')
      ? zipName.trim()
      : `${zipName.trim()}.zip`
    : 'transcripciones_kuriscribe.zip'

  onProgress?.({
    step: 1,
    statusMessage: 'Paso 1: Consultando subtítulos nativos de YouTube...',
    detail: 'Iniciando trabajadores concurrentes en memoria.',
  })

  const payload = Array.isArray(itemsOrInput)
    ? { items: itemsOrInput.map((i) => ({ url: i.url, customName: i.customName })), zipName: normalizedZip, groqApiKey: groqApiKey || undefined, targetLanguage: targetLanguage || 'auto' }
    : { input: itemsOrInput, zipName: normalizedZip, groqApiKey: groqApiKey || undefined, targetLanguage: targetLanguage || 'auto' }

  try {
    const response = await fetch(`${API_BASE}/api/transcribe-batch-stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal,
      body: JSON.stringify(payload),
    })

    if (!response.ok || !response.body) {
      const standardRes = await fetch(`${API_BASE}/api/transcribe-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify(payload),
      })
      const data = await standardRes.json()
      if (!standardRes.ok) throw new Error(data.error || 'Error al procesar lote.')
      return data as BatchResult
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let itemsState: BatchItemState[] = []
    let finalBatchResult: BatchResult | null = null
    let completedCount = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const rawJson = line.slice(6).trim()
        if (!rawJson) continue

        try {
          const event = JSON.parse(rawJson)

          if (event.type === 'init') {
            itemsState = (event.videos || []).map((v: any) => ({
              videoId: v.videoId,
              videoUrl: v.url,
              title: v.customName || v.title || `Video ${v.videoId}`,
              customName: v.customName,
              status: 'transcribing',
              currentStep: 1,
              stepMessage: 'Paso 1: Consultando subtítulos nativos de YouTube...',
            }))
            onItemsUpdate?.([...itemsState])
            onProgress?.({
              step: 1,
              statusMessage: `Procesando ${itemsState.length} videos en paralelo...`,
              detail: 'Paso 1: Consultando subtítulos nativos de YouTube...',
              totalVideos: itemsState.length,
              completedVideos: 0,
            })
          } else if (event.type === 'video_step') {
            const idx = event.index
            if (itemsState[idx]) {
              itemsState[idx] = {
                ...itemsState[idx],
                currentStep: event.step,
                stepMessage: event.stepMessage,
                device: event.device || itemsState[idx].device,
              }
              onItemsUpdate?.([...itemsState])
              onProgress?.({
                step: event.step,
                statusMessage: event.stepMessage || `Procesando video #${idx + 1}...`,
                detail: `Video: ${itemsState[idx].title}`,
                device: event.device,
                totalVideos: itemsState.length,
                completedVideos: completedCount,
                currentlyProcessingTitle: itemsState[idx].title,
              })
            }
          } else if (event.type === 'video_done') {
            const idx = event.index
            if (itemsState[idx]) {
              itemsState[idx] = {
                ...itemsState[idx],
                ...event.item,
                title: event.item?.customName || event.item?.videoTitle || itemsState[idx].title,
              }
            } else if (event.item) {
              itemsState[idx] = event.item
            }
            completedCount++
            onItemsUpdate?.([...itemsState])
            onProgress?.({
              step: event.item?.currentStep || 2,
              statusMessage: `Completado ${completedCount} de ${itemsState.length} videos...`,
              detail: `Último procesado: ${event.item?.customName || event.item?.videoTitle || 'Video'} (${event.item?.processingTimeSec}s)`,
              totalVideos: itemsState.length,
              completedVideos: completedCount,
              currentlyProcessingTitle: event.item?.customName || event.item?.videoTitle,
            })
          } else if (event.type === 'complete') {
            finalBatchResult = {
              batchId: event.batchId,
              zipFilename: event.zipFilename,
              downloadUrl: event.downloadUrl,
              results: event.results || itemsState,
              totalCount: event.totalCount,
              successCount: event.successCount,
              totalTimeSec: event.totalTimeSec,
            }
          }
        } catch (parseErr) {
          console.warn('Error parsing SSE line:', parseErr)
        }
      }
    }

    if (finalBatchResult) {
      onProgress?.({
        step: 3,
        statusMessage: '¡Procesamiento en lote completado!',
        detail: `Archivo ${finalBatchResult.zipFilename} listo en memoria (${finalBatchResult.totalTimeSec}s).`,
        totalVideos: finalBatchResult.totalCount,
        completedVideos: finalBatchResult.successCount,
      })
      return finalBatchResult
    }

    // Si el flujo terminó antes de emitir 'complete' pero se procesaron videos
    if (itemsState.length > 0) {
      const remainingItems = itemsState.map((it) =>
        it.status === 'transcribing'
          ? { ...it, status: 'error' as const, error: 'Conexión interrumpida antes de finalizar la transcripción.' }
          : it
      )
      onItemsUpdate?.([...remainingItems])
      const partialSuccess = remainingItems.filter((i) => i.status === 'completed').length
      throw new Error(
        `La conexión con el servidor se interrumpió durante el procesamiento en lote (${partialSuccess} de ${itemsState.length} completados). Puede descargar los completados o reintentar.`
      )
    }

    throw new Error('La conexión con el servidor se cerró antes de recibir los resultados del lote.')
  } catch (error: any) {
    if (error.name === 'AbortError' || signal?.aborted) {
      const abortErr = new Error('Procesamiento de lote cancelado por el usuario.')
      abortErr.name = 'AbortError'
      throw abortErr
    }
    if (error.message && (error.message.includes('Failed to fetch') || error.message.includes('NetworkError'))) {
      throw new Error(
        'No se pudo conectar con el servidor backend de KuriScribe. Verifica que el servidor esté en ejecución.'
      )
    }
    throw error
  }
}

/**
 * Generates and downloads a ZIP file on the client-side using JSZip and file-saver.
 */
export async function downloadZipClientSide(
  items: BatchItemState[],
  zipFilename: string
): Promise<void> {
  const zip = new JSZip()

  items.forEach((item, index) => {
    let baseName = (item.customName || item.title || `video_${item.videoId}`).trim()
    if (baseName.toLowerCase().endsWith('.txt')) {
      baseName = baseName.slice(0, -4)
    }
    baseName = baseName.replace(/[^a-zA-Z0-9_\-\s]/g, '_').trim() || `video_${index + 1}`
    const fileName = `${baseName}.txt`
    const content = (item.fullText || (item.error ? `Error: ${item.error}` : '')).trim()
    zip.file(fileName, content)
  })

  const blob = await zip.generateAsync({ type: 'blob' })
  const finalFilename = zipFilename.endsWith('.zip') ? zipFilename : `${zipFilename}.zip`
  saveAs(blob, finalFilename)
}
