import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Archive,
  Download,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Layers,
  Loader2,
  RotateCcw,
  Globe,
  Languages,
  Zap,
  Cpu,
} from 'lucide-react'
import JSZip from 'jszip'
import saveAs from 'file-saver'
import {
  type BatchResult,
  type BatchItemState,
  type TranscriptionProgress,
  type TranscriptSegment,
  transcribeYouTubeVideo,
  translateTranscription,
  fetchHardwareStatus,
  TRANSLATION_LANGUAGES,
  API_BASE,
} from '../services/transcriptionService'

interface ItemTranslationState {
  targetLang: string
  translatedText: string
  translatedSegments: TranscriptSegment[]
  activeViewMode: 'original' | 'translated'
  langName: string
}

interface BatchVideoCardProps {
  item: BatchItemState
  idx: number
  isExpanded: boolean
  isCopied: boolean
  isRetrying: boolean
  isTranslating: boolean
  itemTrans?: ItemTranslationState
  currentLangCode: string
  translationError?: string
  isBatchLoading: boolean
  onToggleExpand: () => void
  onRetry: () => void
  onSelectLang: (lang: string) => void
  onTranslate: () => void
  onToggleTranslationView: () => void
  onCopy: (text: string) => void
  onDownload: (text: string, filename: string) => void
}

const BatchVideoCard: React.FC<BatchVideoCardProps> = ({
  item,
  idx,
  isExpanded,
  isCopied,
  isRetrying,
  isTranslating,
  itemTrans,
  currentLangCode,
  translationError,
  isBatchLoading,
  onToggleExpand,
  onRetry,
  onSelectLang,
  onTranslate,
  onToggleTranslationView,
  onCopy,
  onDownload,
}) => {
  const isCompleted = item.status === 'completed'
  const isTranscribing =
    item.status === 'transcribing' || isRetrying || (!isCompleted && item.status !== 'error')
  const isError = item.status === 'error' && !isRetrying
  const isTranslated =
    itemTrans?.activeViewMode === 'translated' && Boolean(itemTrans.translatedText)
  const activeFullText = isTranslated ? itemTrans.translatedText : item.fullText || ''
  const itemErrorMsg = item.error || 'Ocurrió un error al procesar este video.'

  return (
    <div
      className={`rounded-2xl border transition-all ${
        isTranscribing
          ? 'bg-[#151515] border-primary/40 shadow-md shadow-primary/5'
          : isError
          ? 'bg-[#160b0b] border-red-500/30'
          : 'bg-[#0d0d0d] border-white/10'
      } overflow-hidden`}
    >
      {/* Video Item Header Row */}
      <div
        onClick={() => {
          if (isCompleted || isError) {
            onToggleExpand()
          }
        }}
        className={`p-3.5 sm:p-4 flex items-center justify-between gap-3 ${
          isCompleted || isError ? 'cursor-pointer hover:bg-white/[0.02]' : ''
        }`}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="text-xs font-mono text-primary font-bold px-2 py-0.5 rounded bg-primary/10 border border-primary/20 shrink-0">
            #{String(idx + 1).padStart(2, '0')}
          </span>
          <div className="min-w-0 flex-1">
            <h5 className="text-xs sm:text-sm font-medium text-[#E1E0CC] truncate">
              {item.title || `Video ${item.videoId}`}
            </h5>
            <div className="flex items-center flex-wrap gap-2 text-[11px] text-gray-500 mt-1">
              {/* Layer Step Badge for Video Item */}
              {isTranscribing && (
                <div className="inline-flex items-center gap-1 p-0.5 rounded-lg bg-black/60 border border-white/10 text-[10px]">
                  <span
                    className={`px-1.5 py-0.5 rounded flex items-center gap-1 transition-all ${
                      (item.currentStep || 1) === 1
                        ? 'bg-primary/25 text-primary border border-primary/40 font-semibold shadow-sm shadow-primary/20 animate-pulse'
                        : (item.currentStep || 1) > 1
                        ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                        : 'text-gray-500'
                    }`}
                  >
                    <Zap className="w-2.5 h-2.5" />
                    <span>1. Nativo</span>
                  </span>

                  <span
                    className={`px-1.5 py-0.5 rounded flex items-center gap-1 transition-all ${
                      item.currentStep === 2
                        ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 font-semibold shadow-sm shadow-emerald-500/20 animate-pulse'
                        : (item.currentStep || 1) > 2
                        ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                        : 'text-gray-500'
                    }`}
                  >
                    <Cpu className="w-2.5 h-2.5" />
                    <span>2. Whisper</span>
                  </span>

                  <span
                    className={`px-1.5 py-0.5 rounded flex items-center gap-1 transition-all ${
                      item.currentStep === 3
                        ? 'bg-primary/25 text-primary border border-primary/40 font-semibold shadow-sm shadow-primary/20 animate-pulse'
                        : 'text-gray-500'
                    }`}
                  >
                    <Sparkles className="w-2.5 h-2.5" />
                    <span>3. Groq</span>
                  </span>
                </div>
              )}

              <span>
                {isRetrying
                  ? 'Reintentando...'
                  : isTranscribing
                  ? (item.stepMessage || 'Procesando...')
                  : item.methodLabel || 'En cola'}
              </span>

              {item.device && (
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                  item.device === 'cuda'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                }`}>
                  {item.device === 'cuda' ? <Zap className="w-2.5 h-2.5" /> : <Cpu className="w-2.5 h-2.5" />}
                  <span>{item.device === 'cuda' ? 'GPU' : 'CPU'}</span>
                </span>
              )}
              {item.processingTimeSec ? (
                <>
                  <span>•</span>
                  <span>{item.processingTimeSec}s</span>
                </>
              ) : null}
              {isTranslated && itemTrans && (
                <>
                  <span>•</span>
                  <span className="text-emerald-400 font-medium">
                    Traducido a {itemTrans.langName}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isCompleted ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-medium">
              <CheckCircle2 className="w-3 h-3" />
              <span className="hidden sm:inline">Completado</span>
            </span>
          ) : isTranscribing ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/15 text-primary border border-primary/30 text-xs font-medium animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>{isRetrying ? 'Reintentando...' : 'Transcribiendo...'}</span>
            </span>
          ) : isError ? (
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-medium">
                <AlertCircle className="w-3 h-3" />
                <span>Error</span>
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onRetry()
                }}
                disabled={isRetrying || isBatchLoading}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-500/20 hover:bg-red-500/30 text-red-200 border border-red-500/40 text-xs font-semibold transition-all cursor-pointer disabled:opacity-40"
                title="Reintentar sólo este video"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reintentar</span>
              </button>
            </div>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/5 text-gray-400 border border-white/10 text-xs font-medium">
              <span>En cola</span>
            </span>
          )}

          {(isCompleted || isError) && (
            <div className="text-gray-400 p-1">
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          )}
        </div>
      </div>

      {/* Expanded View */}
      {isExpanded && (
        <div className="p-4 border-t border-white/5 bg-black/40 text-xs space-y-3">
          {/* Error resolution row */}
          {isError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-red-300">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{itemErrorMsg}</span>
              </div>
              <button
                type="button"
                onClick={onRetry}
                disabled={isRetrying || isBatchLoading}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-red-500 hover:bg-red-600 text-white font-semibold text-xs transition-all cursor-pointer shrink-0 disabled:opacity-40"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reintentar video</span>
              </button>
            </div>
          )}

          {/* Completed actions: Translation & Copy */}
          {isCompleted && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2.5 p-2.5 rounded-xl bg-black/60 border border-white/10">
                <a
                  href={item.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-primary transition-colors inline-flex items-center gap-1 text-xs"
                >
                  <span>Abrir en YouTube</span>
                  <ExternalLink className="w-3 h-3" />
                </a>

                <div className="flex items-center flex-wrap gap-2">
                  <div className="flex items-center gap-1.5 bg-black px-2.5 py-1 rounded-full border border-white/15 text-xs text-[#E1E0CC]">
                    <Globe className="w-3 h-3 text-primary shrink-0" />
                    <select
                      value={currentLangCode}
                      onChange={(e) => onSelectLang(e.target.value)}
                      disabled={isTranslating}
                      className="bg-transparent text-[#E1E0CC] text-[11px] focus:outline-none cursor-pointer pr-1 [&>option]:bg-neutral-900 [&>option]:text-[#E1E0CC]"
                      aria-label="Seleccionar idioma"
                    >
                      {TRANSLATION_LANGUAGES.map((lang) => (
                        <option key={lang.code} value={lang.code}>
                          {lang.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={onTranslate}
                    disabled={isTranslating}
                    className="flex items-center gap-1 px-3 py-1 rounded-full bg-primary hover:bg-[#ece8d4] text-black font-semibold text-[11px] transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isTranslating ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Traduciendo...</span>
                      </>
                    ) : (
                      <>
                        <Languages className="w-3 h-3" />
                        <span>Traducir</span>
                      </>
                    )}
                  </button>

                  {itemTrans?.translatedText && (
                    <button
                      type="button"
                      onClick={onToggleTranslationView}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/15 border border-white/10 text-[11px] font-medium text-[#E1E0CC] transition-all cursor-pointer"
                      title="Alternar vista"
                    >
                      <RotateCcw className="w-2.5 h-2.5 text-primary" />
                      <span>{isTranslated ? 'Ver Original' : 'Ver Traducido'}</span>
                    </button>
                  )}

                  {activeFullText && (
                    <button
                      type="button"
                      onClick={() => onCopy(activeFullText)}
                      className="flex items-center gap-1 px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 text-xs transition-colors cursor-pointer"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">Copiado</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copiar</span>
                        </>
                      )}
                    </button>
                  )}

                  {/* Individual TXT Download Button */}
                  {activeFullText && (
                    <button
                      type="button"
                      onClick={() => {
                        let baseName = (
                          item.customName ||
                          item.title ||
                          `video_${item.videoId || idx + 1}`
                        ).trim()
                        if (baseName.toLowerCase().endsWith('.txt')) {
                          baseName = baseName.slice(0, -4)
                        }
                        baseName = baseName.replace(/[^a-zA-Z0-9_\-\s]/g, '_').trim() || `video_${idx + 1}`
                        const downloadName = `${baseName}.txt`
                        onDownload(activeFullText, downloadName)
                      }}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/25 text-primary hover:text-[#E1E0CC] text-xs font-medium transition-all cursor-pointer"
                      title="Descargar este archivo .txt individualmente"
                    >
                      <Download className="w-3 h-3" />
                      <span>Descargar .txt</span>
                    </button>
                  )}
                </div>
              </div>

              {translationError && (
                <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-[11px] flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{translationError}</span>
                </div>
              )}
            </div>
          )}

          {/* Transcript Text Container */}
          <div className="max-h-48 overflow-y-auto p-3 rounded-xl bg-black/80 border border-white/5 text-gray-300 font-sans leading-relaxed whitespace-pre-wrap select-text">
            {activeFullText || (isError ? itemErrorMsg : 'Sin texto disponible.')}
          </div>
        </div>
      )}
    </div>
  )
}

interface BatchTranscriptionModalProps {
  isOpen: boolean
  onClose: () => void
  batchResult: BatchResult | null
  liveItems: BatchItemState[]
  isLoading: boolean
  progress: TranscriptionProgress | null
  error: string | null
  customZipName?: string
  pendingVideosCount?: number
  groqApiKey?: string
  targetLanguage?: string
  onOpenApiKeyModal?: () => void
}

const BatchTranscriptionModalDialog: React.FC<Omit<BatchTranscriptionModalProps, 'isOpen'>> = ({
  onClose,
  batchResult,
  liveItems = [],
  isLoading,
  progress,
  error,
  customZipName = 'transcripciones_kuriscribe.zip',
  pendingVideosCount = 1,
  groqApiKey = '',
  targetLanguage = 'auto',
  onOpenApiKeyModal,
}) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const [retriedItems, setRetriedItems] = useState<Record<number, BatchItemState>>({})
  const [retryingIndex, setRetryingIndex] = useState<number | null>(null)
  const [translations, setTranslations] = useState<Record<number, ItemTranslationState>>({})
  const [selectedLangs, setSelectedLangs] = useState<Record<number, string>>({})
  const [translatingIndex, setTranslatingIndex] = useState<number | null>(null)
  const [translationErrors, setTranslationErrors] = useState<Record<number, string>>({})
  const [saveNotification, setSaveNotification] = useState<{
    type: 'success' | 'error' | 'info'
    message: string
  } | null>(null)
  const [hardwareStatus, setHardwareStatus] = useState<{ device: 'cuda' | 'cpu'; deviceLabel: string }>({
    device: 'cpu',
    deviceLabel: 'CPU',
  })

  React.useEffect(() => {
    fetchHardwareStatus().then((hw) => {
      if (hw) {
        setHardwareStatus({
          device: hw.device,
          deviceLabel: hw.deviceLabel,
        })
      }
    })
  }, [])

  const baseItems = useMemo(() => {
    return (batchResult?.results && batchResult.results.length > 0 ? batchResult.results : liveItems) || []
  }, [batchResult, liveItems])

  const itemsToDisplay = useMemo(() => {
    return baseItems.map((item, idx) => retriedItems[idx] || item)
  }, [baseItems, retriedItems])

  const totalVideos = progress?.totalVideos || pendingVideosCount || itemsToDisplay.length || 1
  const completedVideos = (itemsToDisplay || []).filter(
    (i) => i && (i.status === 'completed' || i.status === 'error' || Boolean(i.fullText))
  ).length
  const successfulVideos = (itemsToDisplay || []).filter(
    (i) => i && (i.status === 'completed' || Boolean(i.fullText))
  ).length
  const progressPercent = Math.min(100, Math.round((completedVideos / totalVideos) * 100))
  const zipFileName = batchResult?.zipFilename || customZipName || 'transcripciones_kuriscribe.zip'

  // Handle Retry for a single failed video in the batch
  const handleRetrySingle = async (idx: number) => {
    const targetItem = itemsToDisplay[idx]
    if (!targetItem || retryingIndex !== null) return

    setRetryingIndex(idx)
    setRetriedItems((prev) => ({
      ...prev,
      [idx]: { ...targetItem, status: 'transcribing', error: undefined }
    }))

    try {
      const res = await transcribeYouTubeVideo(targetItem.videoUrl, undefined, groqApiKey, targetLanguage)

      setRetriedItems((prev) => ({
        ...prev,
        [idx]: {
          ...targetItem,
          status: 'completed',
          fullText: res.fullText,
          segments: res.segments,
          methodLabel: res.methodLabel,
          processingTimeSec: res.processingTimeSec,
          title: targetItem.customName || res.videoTitle || targetItem.title,
          error: undefined,
        }
      }))
    } catch (err: any) {
      console.error('Error al reintentar video individual:', err)
      setRetriedItems((prev) => ({
        ...prev,
        [idx]: {
          ...targetItem,
          status: 'error',
          error: err?.message || 'Error al reintentar transcripción.',
        }
      }))
    } finally {
      setRetryingIndex(null)
    }
  }

  // Handle individual translation for a video item
  const handleTranslateSingle = async (idx: number) => {
    const item = itemsToDisplay[idx]
    const baseText = (item?.fullText || (item?.segments && item.segments.length > 0 ? item.segments.map((s) => s.text).join(' ') : '')).trim()
    if (!item || !baseText || translatingIndex !== null) return

    const itemLang = (item.language || '').toLowerCase()
    const fallbackDefault = itemLang.startsWith('es') ? 'en' : 'es'
    const targetLang = selectedLangs[idx] || (targetLanguage !== 'auto' ? targetLanguage : fallbackDefault)

    setTranslatingIndex(idx)
    setTranslationErrors((prev) => {
      const next = { ...prev }
      delete next[idx]
      return next
    })

    try {
      const res = await translateTranscription(baseText, item.segments || [], targetLang)

      setTranslations((prev) => ({
        ...prev,
        [idx]: {
          targetLang,
          translatedText: res.fullText,
          translatedSegments: res.segments,
          activeViewMode: 'translated',
          langName: res.languageName,
        },
      }))
    } catch (err: any) {
      console.error('Error al traducir item:', err)
      setTranslationErrors((prev) => ({
        ...prev,
        [idx]: err?.message || 'Error al traducir el contenido.',
      }))
    } finally {
      setTranslatingIndex(null)
    }
  }

  const handleToggleTranslationView = (idx: number) => {
    setTranslations((prev) => {
      const current = prev[idx]
      if (!current) return prev
      return {
        ...prev,
        [idx]: {
          ...current,
          activeViewMode: current.activeViewMode === 'translated' ? 'original' : 'translated',
        },
      }
    })
  }

  // Generate and download ZIP dynamically: Opens native OS Save Dialog via backend with client fallback
  const handleDownloadZip = async () => {
    console.log('[KuriScribe] 👉 Botón "Descargar todo en .ZIP" presionado', {
      totalItems: itemsToDisplay.length,
      successfulVideos,
      isDownloading,
    })

    if (itemsToDisplay.length === 0 || isDownloading) {
      console.warn('[KuriScribe] ⚠️ Descarga cancelada: no hay elementos o ya está en proceso.')
      return
    }

    setIsDownloading(true)
    setSaveNotification(null)

    try {
      const itemsToExport: BatchItemState[] = itemsToDisplay.map((item, idx) => {
        const trans = translations[idx]
        if (trans && trans.activeViewMode === 'translated' && trans.translatedText) {
          return {
            ...item,
            fullText: trans.translatedText,
            segments: trans.translatedSegments,
            methodLabel: `${item.methodLabel || 'Auto'} (Traducido a ${trans.langName})`,
          }
        }
        return item
      })

      const downloadFilename = zipFileName.endsWith('.zip') ? zipFileName : `${zipFileName}.zip`
      console.log('[KuriScribe] 🖥️ Solicitando diálogo nativo de guardado del sistema operativo...', {
        archivo: downloadFilename,
        totalItems: itemsToExport.length,
      })

      // 1. Llamar al backend para abrir la ventana nativa de "Guardar como..." del sistema operativo
      try {
        const res = await fetch(`${API_BASE}/api/save-zip-native`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: itemsToExport,
            zipFilename: downloadFilename,
          }),
        })

        if (res.ok) {
          const json = await res.json()
          if (json.success) {
            const dest = json.savedPath || json.filename || downloadFilename
            console.log('[KuriScribe] ✅ Archivo ZIP guardado exitosamente en:', dest)
            setSaveNotification({
              type: 'success',
              message: `¡Archivo ZIP guardado con éxito en: ${dest}!`,
            })
            setTimeout(() => setSaveNotification(null), 6000)
            return
          } else if (json.cancelled) {
            console.log('[KuriScribe] ℹ️ Diálogo de guardado cancelado por el usuario.')
            return
          }
        }
      } catch (nativeErr) {
        console.warn(
          '[KuriScribe] Backend nativo no disponible, ejecutando fallback de JSZip en navegador:',
          nativeErr
        )
      }

      // 2. Fallback con JSZip + file-saver en cliente
      const zip = new JSZip()

      itemsToExport.forEach((item, index) => {
        let baseName = (
          item.customName ||
          item.title ||
          `video_${item.videoId || index + 1}`
        ).trim()
        if (baseName.toLowerCase().endsWith('.txt')) {
          baseName = baseName.slice(0, -4)
        }
        baseName = baseName.replace(/[^a-zA-Z0-9_\-\s]/g, '_').trim() || `video_${index + 1}`
        const fileName = `${baseName}.txt`
        const content = (item.fullText || (item.error ? `Error: ${item.error}` : '')).trim()
        zip.file(fileName, content)
      })

      const blob = await zip.generateAsync({ type: 'blob' })
      saveAs(blob, downloadFilename)
      setSaveNotification({
        type: 'success',
        message: `¡Descarga de ${downloadFilename} iniciada!`,
      })
      setTimeout(() => setSaveNotification(null), 4000)
    } catch (err) {
      console.error('[KuriScribe] ❌ Error durante la generación del ZIP:', err)
      setSaveNotification({
        type: 'error',
        message: 'Error al procesar el archivo ZIP.',
      })
    } finally {
      setIsDownloading(false)
    }
  }

  const handleCopySingle = async (textToCopy: string, idx: number) => {
    if (!textToCopy) return
    try {
      await navigator.clipboard.writeText(textToCopy)
      setCopiedIndex(idx)
      setTimeout(() => setCopiedIndex(null), 2000)
    } catch (e) {
      console.error(e)
    }
  }

  const handleDownloadSingleTxt = async (text: string, filename: string) => {
    if (!text) return
    const plainText = text.trim()
    const finalFilename = filename.endsWith('.txt') ? filename : `${filename}.txt`

    // 1. Intentar API nativa del navegador Web (window.showSaveFilePicker)
    if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: finalFilename,
          types: [
            {
              description: 'Archivo de texto (*.txt)',
              accept: { 'text/plain': ['.txt'] },
            },
          ],
        })
        const writable = await handle.createWritable()
        await writable.write(plainText)
        await writable.close()
        setSaveNotification({
          type: 'success',
          message: `¡Archivo guardado con éxito como: ${finalFilename}!`,
        })
        setTimeout(() => setSaveNotification(null), 4000)
        return
      } catch (err: any) {
        if (err.name === 'AbortError') {
          // El usuario canceló la ventana de diálogo
          return
        }
        console.warn('showSaveFilePicker falló, intentando diálogo de escritorio/backend:', err)
      }
    }

    // 2. Entorno Desktop / Backend: Diálogo nativo del sistema operativo vía /api/save-txt-native
    try {
      const res = await fetch(`${API_BASE}/api/save-txt-native`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: plainText,
          filename: finalFilename,
        }),
      })

      if (res.ok) {
        const json = await res.json()
        if (json.success) {
          const dest = json.savedPath || json.filename || finalFilename
          setSaveNotification({
            type: 'success',
            message: `¡Archivo guardado con éxito en: ${dest}!`,
          })
          setTimeout(() => setSaveNotification(null), 6000)
          return
        } else if (json.cancelled) {
          return
        }
      }
    } catch (desktopErr) {
      console.warn('Backend nativo no disponible para .txt, usando fallback con file-saver:', desktopErr)
    }

    // 3. Fallback directo con file-saver / Blob
    const blob = new Blob([plainText], { type: 'text/plain;charset=utf-8' })
    saveAs(blob, finalFilename)
    setSaveNotification({
      type: 'success',
      message: `¡Descarga de ${finalFilename} iniciada!`,
    })
    setTimeout(() => setSaveNotification(null), 4000)
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 select-none">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/85 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-4xl max-h-[90vh] bg-[#101010] border border-white/15 rounded-2xl md:rounded-3xl shadow-2xl flex flex-col overflow-hidden z-10"
        >
          {/* Header */}
          <div className="p-4 sm:p-6 border-b border-white/10 flex items-center justify-between bg-black/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-[#E1E0CC]">
                  {isLoading ? 'Procesando Lote en Paralelo...' : 'Lote de Transcripciones'}
                </h3>
                <p className="text-xs text-gray-400">
                  {successfulVideos} de {totalVideos} videos completados con éxito ({progressPercent}
                  %)
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
              aria-label="Cerrar modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {/* Live Progress Bar & Banner */}
            {isLoading && (
              <div className="p-4 rounded-2xl bg-black/60 border border-white/10 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-primary flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 animate-spin" />
                    <span>{progress?.statusMessage || 'Procesando en paralelo...'}</span>
                  </span>
                  <span className="font-mono text-gray-400">
                    {completedVideos}/{totalVideos} ({progressPercent}%)
                  </span>
                </div>

                {/* Animated Progress Bar */}
                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-primary"
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>

                {/* Steps indicator global */}
                <div className="flex items-center gap-1.5 w-full bg-black/60 p-1.5 rounded-xl border border-white/10">
                  {/* Step 1: Nativo */}
                  <div
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-1 rounded-lg text-[11px] font-medium transition-all duration-300 ${
                      (progress?.step || 1) === 1
                        ? 'bg-primary/25 text-primary border border-primary/50 shadow-sm shadow-primary/20 scale-[1.02]'
                        : (progress?.step || 1) > 1
                        ? 'bg-amber-500/10 text-amber-400/80 border border-amber-500/20'
                        : 'text-gray-500 bg-white/[0.02]'
                    }`}
                  >
                    <Zap className={`w-3 h-3 ${(progress?.step || 1) === 1 ? 'animate-bounce text-primary' : ''}`} />
                    <span>1. Nativo</span>
                  </div>

                  {/* Step 2: Whisper Local */}
                  <div
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-1 rounded-lg text-[11px] font-medium transition-all duration-300 ${
                      progress?.step === 2
                        ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/50 shadow-sm shadow-cyan-500/20 scale-[1.02]'
                        : (progress?.step || 1) > 2
                        ? 'bg-amber-500/10 text-amber-400/80 border border-amber-500/20'
                        : 'text-gray-500 bg-white/[0.02]'
                    }`}
                  >
                    <Cpu className={`w-3 h-3 ${progress?.step === 2 ? 'animate-spin text-cyan-400' : ''}`} />
                    <span>2. Whisper Local</span>
                  </div>

                  {/* Step 3: Groq Cloud */}
                  <div
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-1 rounded-lg text-[11px] font-medium transition-all duration-300 ${
                      progress?.step === 3
                        ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/50 shadow-lg shadow-emerald-500/25 scale-[1.02]'
                        : 'text-gray-500 bg-white/[0.02]'
                    }`}
                  >
                    <Sparkles className={`w-3 h-3 ${progress?.step === 3 ? 'animate-pulse text-emerald-400' : ''}`} />
                    <span>3. Groq Cloud</span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                  <p className="text-[11px] text-gray-400">
                    {progress?.detail ||
                      'Hilos concurrentes activos en memoria RAM (sin escritura a disco).'}
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
                    {onOpenApiKeyModal && (
                      groqApiKey ? (
                        <button
                          type="button"
                          onClick={onOpenApiKeyModal}
                          className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition-all cursor-pointer"
                          title="Modificar o ver tu clave API de Groq"
                        >
                          <Sparkles className="w-3 h-3 text-emerald-400" />
                          <span>⚡ Groq Turbo Activo</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={onOpenApiKeyModal}
                          className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500/20 to-primary/20 hover:from-amber-500/30 hover:to-primary/30 text-amber-200 border border-amber-500/40 text-xs font-semibold transition-all cursor-pointer animate-pulse"
                          title="Ingresar clave Groq para acelerar el procesamiento de todos los vídeos del lote"
                        >
                          <Sparkles className="w-3 h-3 text-primary" />
                          <span>Acelerar Lote con Groq</span>
                        </button>
                      )
                    )}
                    <button
                      onClick={onClose}
                      className="px-3 py-1 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-medium text-gray-400 hover:text-white transition-all shrink-0 cursor-pointer"
                    >
                      Cancelar proceso
                    </button>
                  </div>
                </div>

                {/* Adaptive Hardware Banner (solo visible en Capa 2 si no hay clave Groq activa) */}
                {progress?.step === 2 && !groqApiKey && (
                  <div
                    className={`p-3 rounded-xl border text-xs text-left flex items-start gap-2.5 ${
                      hardwareStatus.device === 'cuda'
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                    }`}
                  >
                    {hardwareStatus.device === 'cuda' ? (
                      <>
                        <Zap className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold block text-emerald-300 mb-0.5">Aceleración por GPU (CUDA) Activa</span>
                          <span>Procesando audio localmente mediante tu GPU. ¡Aprovechando la máxima aceleración de tu tarjeta gráfica!</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <Cpu className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold block text-amber-300 mb-0.5">Procesamiento por CPU Local</span>
                          <span>Procesando audio localmente con tu CPU. El tiempo dependerá de la duración del video y la potencia de tu equipo. Para procesar en la nube sin consumir recursos de tu procesador, puedes configurar tu API Key gratuita de Groq.</span>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Error Message */}
            {!isLoading && error && (
              <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-between gap-3 text-red-300 text-xs">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span>{error}</span>
                </div>
                <button
                  onClick={onClose}
                  className="px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/15 text-xs font-semibold text-[#E1E0CC] transition-all cursor-pointer shrink-0"
                >
                  Cerrar
                </button>
              </div>
            )}

            {/* Batch Overview Meta Bar */}
            {!isLoading && itemsToDisplay.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-black/40 border border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
                    <Archive className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-mono font-semibold text-[#E1E0CC]">{zipFileName}</p>
                    <span className="text-[11px] text-gray-400">
                      {successfulVideos} de {itemsToDisplay.length} archivos .txt listos en RAM
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadZip}
                  disabled={isDownloading || itemsToDisplay.length === 0}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary hover:bg-[#ece8d4] text-black font-semibold text-xs transition-all shadow-lg hover:shadow-primary/20 cursor-pointer disabled:opacity-40"
                >
                  {isDownloading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Guardando ZIP...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Descargar todo en .ZIP</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Native Save / Download Success or Error Notification */}
            {saveNotification && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`p-3.5 rounded-2xl flex items-center justify-between gap-3 text-xs border ${
                  saveNotification.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-red-500/10 border-red-500/30 text-red-300'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  {saveNotification.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  )}
                  <span className="truncate font-medium">{saveNotification.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSaveNotification(null)}
                  className="p-1 hover:bg-white/10 rounded-full transition-colors cursor-pointer text-gray-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            )}

            {/* Real-time Video Items List */}
            {itemsToDisplay.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between text-xs text-gray-400 px-1">
                  <span>Videos del Lote ({itemsToDisplay.length})</span>
                  <span>Estado y Gestión Individual</span>
                </div>

                <div className="space-y-2">
                  {itemsToDisplay.map((item, idx) => (
                    <BatchVideoCard
                      key={item.videoId || idx}
                      item={item}
                      idx={idx}
                      isExpanded={expandedIndex === idx}
                      isCopied={copiedIndex === idx}
                      isRetrying={retryingIndex === idx}
                      isTranslating={translatingIndex === idx}
                      itemTrans={translations[idx]}
                      currentLangCode={
                        selectedLangs[idx] ||
                        (targetLanguage !== 'auto'
                          ? targetLanguage
                          : (item.language || '').toLowerCase().startsWith('es')
                          ? 'en'
                          : 'es')
                      }
                      translationError={translationErrors[idx]}
                      isBatchLoading={isLoading}
                      onToggleExpand={() =>
                        setExpandedIndex((prev) => (prev === idx ? null : idx))
                      }
                      onRetry={() => handleRetrySingle(idx)}
                      onSelectLang={(lang) =>
                        setSelectedLangs((prev) => ({ ...prev, [idx]: lang }))
                      }
                      onTranslate={() => handleTranslateSingle(idx)}
                      onToggleTranslationView={() => handleToggleTranslationView(idx)}
                      onCopy={(text) => handleCopySingle(text, idx)}
                      onDownload={handleDownloadSingleTxt}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

export const BatchTranscriptionModal: React.FC<BatchTranscriptionModalProps> = (props) => {
  if (!props.isOpen) return null

  return <BatchTranscriptionModalDialog {...props} />
}

