import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Copy,
  Check,
  Download,
  Clock,
  Sparkles,
  Search,
  ExternalLink,
  Zap,
  Cpu,
  FileText,
  ListFilter,
  Globe,
  Languages,
  Loader2,
  AlertCircle,
  RotateCcw,
} from 'lucide-react'
import {
  type TranscriptionResult,
  type TranscriptionProgress,
  type TranscriptSegment,
  formatTime,
  TRANSLATION_LANGUAGES,
  translateTranscription,
  fetchHardwareStatus,
  API_BASE,
} from '../services/transcriptionService'

interface TranscriptionModalProps {
  isOpen: boolean
  onClose: () => void
  result: TranscriptionResult | null
  isLoading: boolean
  progress: TranscriptionProgress | null
  error: string | null
  customFileName?: string
  onOpenApiKeyModal?: () => void
  hasGroqApiKey?: boolean
}

const TranscriptionModalDialog: React.FC<Omit<TranscriptionModalProps, 'isOpen'>> = ({
  onClose,
  result,
  isLoading,
  progress,
  error,
  customFileName,
  onOpenApiKeyModal,
  hasGroqApiKey = false,
}) => {
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<'text' | 'timestamps'>('text')
  const [searchQuery, setSearchQuery] = useState('')

  // Translation states
  const [selectedTargetLang, setSelectedTargetLang] = useState<string | null>(null)
  const defaultTargetLang = (result?.language || '').toLowerCase().startsWith('es') ? 'en' : 'es'
  const targetLang = selectedTargetLang || defaultTargetLang

  const [isTranslating, setIsTranslating] = useState(false)
  const [translationError, setTranslationError] = useState<string | null>(null)
  const [translationData, setTranslationData] = useState<{
    videoId: string
    translatedText: string
    translatedSegments: TranscriptSegment[]
    activeViewMode: 'original' | 'translated'
    langName: string
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

  const isCurrentVideoTranslation = translationData?.videoId === (result?.videoId || '')
  const translatedText = isCurrentVideoTranslation ? translationData?.translatedText : null
  const translatedSegments = isCurrentVideoTranslation ? translationData?.translatedSegments : null
  const activeViewMode = isCurrentVideoTranslation ? (translationData?.activeViewMode || 'original') : 'original'
  const currentTranslatedLangName = isCurrentVideoTranslation ? translationData?.langName : null

  const baseFullText = (
    result?.fullText ||
    (result?.segments && result.segments.length > 0 ? result.segments.map((s) => s.text).join(' ') : '')
  ).trim()

  const currentFullText =
    (activeViewMode === 'translated' && translatedText ? translatedText : baseFullText) || ''
  const currentSegments =
    (activeViewMode === 'translated' && translatedSegments && translatedSegments.length > 0
      ? translatedSegments
      : result?.segments) || []

  const handleTranslate = async () => {
    if (!result || isTranslating) return
    setIsTranslating(true)
    setTranslationError(null)

    try {
      const res = await translateTranscription(
        baseFullText,
        result.segments || [],
        targetLang
      )
      setTranslationData({
        videoId: result.videoId || '',
        translatedText: res?.fullText || '',
        translatedSegments: res?.segments || [],
        activeViewMode: 'translated',
        langName: res?.languageName || targetLang.toUpperCase(),
      })
    } catch (err: any) {
      console.error(err)
      setTranslationError(err?.message || 'Error al traducir el contenido.')
    } finally {
      setIsTranslating(false)
    }
  }

  const handleCopy = async () => {
    if (!result) return
    const content =
      activeTab === 'text'
        ? currentFullText
        : (currentSegments || []).map((s) => `[${formatTime(s?.start ?? 0)}] ${s?.text ?? ''}`).join('\n')

    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy', err)
    }
  }

  const handleDownload = async () => {
    if (!result) return

    const plainText = (currentFullText || '').trim()
    let defaultFilename = customFileName?.trim() || ''
    if (defaultFilename) {
      if (defaultFilename.toLowerCase().endsWith('.zip')) {
        defaultFilename = defaultFilename.slice(0, -4)
      }
      if (!defaultFilename.toLowerCase().endsWith('.txt')) {
        defaultFilename += '.txt'
      }
    } else {
      defaultFilename = `KuriScribe_${result.videoId || 'video'}_${activeViewMode === 'translated' ? targetLang : 'original'}_transcript.txt`
    }

    // 1. Intentar API nativa del navegador Web (window.showSaveFilePicker)
    if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: defaultFilename,
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
        return
      } catch (err: any) {
        if (err.name === 'AbortError') {
          return
        }
        console.warn('showSaveFilePicker falló en modal individual:', err)
      }
    }

    // 2. Entorno Desktop / Backend: Diálogo nativo del sistema operativo vía /api/save-txt-native
    try {
      const res = await fetch(`${API_BASE}/api/save-txt-native`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: plainText,
          filename: defaultFilename,
        }),
      })

      if (res.ok) {
        const json = await res.json()
        if (json.success || json.cancelled) {
          return
        }
      }
    } catch (desktopErr) {
      console.warn('Backend nativo no disponible para .txt individual:', desktopErr)
    }

    // 3. Fallback directo con enlace DOM
    const blob = new Blob([plainText], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = defaultFilename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const filteredSegments = (currentSegments || []).filter((s) =>
    (s?.text || '').toLowerCase().includes((searchQuery || '').toLowerCase())
  )

  const wordCount = (currentFullText || '').trim().split(/\s+/).filter(Boolean).length

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={isLoading ? undefined : onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
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
          <div className="p-4 sm:p-6 border-b border-white/10 flex items-center justify-between bg-black/40">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-[#E1E0CC]">
                  {isLoading ? 'Procesando Transcripción...' : 'Transcripción Generada'}
                </h3>
                <p className="text-xs text-gray-400">
                  {result ? result.videoTitle || result.videoUrl : 'Convirtiendo audio a texto'}
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
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 min-h-[300px]">
            
            {/* Loading State */}
            {isLoading && (
              <div className="h-full flex flex-col items-center justify-center py-12 text-center">
                <div className="relative w-16 h-16 mb-6">
                  <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping" />
                  <div className="absolute inset-0 rounded-full border-2 border-t-primary border-r-transparent border-b-transparent border-l-transparent animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center text-primary">
                    <Sparkles className="w-6 h-6 animate-pulse" />
                  </div>
                </div>

                <h4 className="text-base sm:text-lg font-semibold text-[#E1E0CC] mb-2">
                  {progress?.statusMessage || (
                    progress?.step === 2
                      ? 'Paso 2: Descargando audio e infiriendo con Whisper Local...'
                      : progress?.step === 3
                      ? 'Paso 3: Procesando transcripción en la nube mediante Groq Cloud...'
                      : 'Paso 1: Consultando subtítulos nativos de YouTube...'
                  )}
                </h4>
                <p className="text-xs sm:text-sm text-gray-400 max-w-md mb-6 leading-relaxed">
                  {progress?.detail || (
                    progress?.step === 2
                      ? 'Extrayendo audio a 16kHz mono y procesando localmente.'
                      : progress?.step === 3
                      ? 'Procesamiento de alta velocidad mediante Whisper Turbo.'
                      : 'Consultando subtítulos oficiales de YouTube.'
                  )}
                </p>

                {/* Steps indicator */}
                <div className="flex items-center gap-1.5 max-w-md w-full bg-black/60 p-1.5 rounded-xl border border-white/10 mb-4">
                  {/* Step 1: Nativo */}
                  <div
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-1 rounded-lg text-[11px] font-medium transition-all duration-300 ${
                      progress?.step === 1
                        ? 'bg-primary/25 text-primary border border-primary/50 shadow-lg shadow-primary/20 scale-[1.02]'
                        : (progress?.step || 1) > 1
                        ? 'bg-amber-500/10 text-amber-400/80 border border-amber-500/20'
                        : 'text-gray-500 bg-white/[0.02]'
                    }`}
                  >
                    <Zap className={`w-3.5 h-3.5 ${progress?.step === 1 ? 'animate-bounce text-primary' : ''}`} />
                    <span>1. Nativo</span>
                    {(progress?.step || 1) > 1 && (
                      <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono">429</span>
                    )}
                  </div>

                  {/* Step 2: Whisper Local */}
                  <div
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-1 rounded-lg text-[11px] font-medium transition-all duration-300 ${
                      progress?.step === 2
                        ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/50 shadow-lg shadow-cyan-500/20 scale-[1.02]'
                        : (progress?.step || 1) > 2
                        ? 'bg-amber-500/10 text-amber-400/80 border border-amber-500/20'
                        : 'text-gray-500 bg-white/[0.02]'
                    }`}
                  >
                    <Cpu className={`w-3.5 h-3.5 ${progress?.step === 2 ? 'animate-spin text-cyan-400' : ''}`} />
                    <span>2. Whisper Local</span>
                  </div>

                  {/* Step 3: Groq Cloud */}
                  <div
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-1 rounded-lg text-[11px] font-medium transition-all duration-300 ${
                      progress?.step === 3
                        ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/50 shadow-lg shadow-emerald-500/25 scale-[1.02]'
                        : 'text-gray-500 bg-white/[0.02]'
                    }`}
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${progress?.step === 3 ? 'animate-pulse text-emerald-400' : ''}`} />
                    <span>3. Groq Cloud</span>
                  </div>
                </div>

                {/* Adaptive Hardware Notification Banner (solo en Capa 2 si no hay Groq API key) */}
                {progress?.step === 2 && !hasGroqApiKey && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-3.5 rounded-xl border text-xs text-left max-w-md mb-6 flex items-start gap-2.5 shadow-md ${
                      (progress?.device || hardwareStatus.device) === 'cuda'
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
                        : 'bg-amber-500/15 border-amber-500/40 text-amber-100'
                    }`}
                  >
                    {(progress?.device || hardwareStatus.device) === 'cuda' ? (
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
                  </motion.div>
                )}

                <div className="flex items-center gap-3 flex-wrap justify-center mt-2">
                  {onOpenApiKeyModal && (
                    hasGroqApiKey ? (
                      <button
                        type="button"
                        onClick={onOpenApiKeyModal}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition-all shadow-md cursor-pointer"
                        title="Modificar o ver tu clave API de Groq"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                        <span>⚡ Groq Turbo Activo</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={onOpenApiKeyModal}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-amber-500/20 to-primary/20 hover:from-amber-500/30 hover:to-primary/30 text-amber-200 border border-amber-500/40 text-xs font-semibold transition-all shadow-md cursor-pointer animate-pulse"
                        title="Ingresar clave gratuita de Groq para acelerar la transcripción"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-primary" />
                        <span>Acelerar con Groq Turbo (API Key)</span>
                      </button>
                    )
                  )}

                  <button
                    onClick={onClose}
                    className="px-4 py-2 rounded-full border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-xs font-medium text-gray-400 hover:text-white transition-all cursor-pointer"
                  >
                    Cancelar proceso
                  </button>
                </div>
              </div>
            )}

            {/* Error State */}
            {!isLoading && error && (
              <div className="h-full flex flex-col items-center justify-center py-12 text-center">
                <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mb-4">
                  <X className="w-6 h-6" />
                </div>
                <h4 className="text-base font-semibold text-red-300 mb-2">No se pudo transcribir</h4>
                <p className="text-xs sm:text-sm text-gray-400 max-w-md mb-6">{error}</p>
                <div className="flex items-center gap-3 flex-wrap justify-center">
                  {onOpenApiKeyModal && (
                    <button
                      type="button"
                      onClick={onOpenApiKeyModal}
                      className="px-5 py-2 rounded-full bg-primary hover:bg-[#ece8d4] text-black text-xs font-semibold transition-all shadow-lg hover:shadow-primary/20 cursor-pointer flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Ingresar clave Groq API</span>
                    </button>
                  )}
                  <button
                    onClick={onClose}
                    className="px-5 py-2 rounded-full bg-white/10 hover:bg-white/15 text-xs font-semibold text-[#E1E0CC] transition-all cursor-pointer"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            )}

            {/* Fallback Empty/No Result State */}
            {!isLoading && !error && !result && (
              <div className="h-full flex flex-col items-center justify-center py-12 text-center">
                <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <h4 className="text-base font-semibold text-[#E1E0CC] mb-2">Sin transcripción disponible</h4>
                <p className="text-xs sm:text-sm text-gray-400 max-w-md mb-6">
                  El proceso de transcripción concluyó pero no se recibió texto del vídeo.
                </p>
                <button
                  onClick={onClose}
                  className="px-5 py-2 rounded-full bg-white/10 hover:bg-white/15 text-xs font-semibold text-[#E1E0CC] transition-all cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            )}

            {/* Result Ready State */}
            {!isLoading && result && (
              <div className="space-y-4">
                
                {/* Meta stats bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-black/40 border border-white/5 text-xs text-gray-300">
                  <div className="flex items-center flex-wrap gap-2 sm:gap-3">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary/10 text-primary font-medium border border-primary/20">
                      {result.device === 'cuda' ? (
                        <Zap className="w-3 h-3 text-emerald-400" />
                      ) : result.device === 'cpu' ? (
                        <Cpu className="w-3 h-3 text-amber-400" />
                      ) : (
                        <Sparkles className="w-3 h-3" />
                      )}
                      {result.methodLabel}
                    </span>
                    {result.device && (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${
                        result.device === 'cuda'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}>
                        {result.device === 'cuda' ? 'GPU Acelerada' : 'CPU Local'}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-gray-400">
                      <Clock className="w-3.5 h-3.5" />
                      {result.processingTimeSec}s
                    </span>
                    <span className="text-gray-500">•</span>
                    <span className="text-gray-400">{wordCount} palabras</span>
                    {activeViewMode === 'translated' && currentTranslatedLangName && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-medium">
                        Traducido a {currentTranslatedLangName}
                      </span>
                    )}
                  </div>

                  <a
                    href={result.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-primary transition-colors"
                  >
                    <span>Ver en YouTube</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                {/* Real-time On-demand Translation Bar */}
                <div className="p-3 sm:p-4 rounded-2xl bg-black/60 border border-[#DEDBC8]/20 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                      <Globe className="w-4 h-4" />
                    </div>
                    <div>
                      <h5 className="text-xs font-semibold text-[#E1E0CC]">Traducción en Tiempo Real</h5>
                      <p className="text-[11px] text-gray-400">
                        {translatedText
                          ? `Texto traducido a ${currentTranslatedLangName || targetLang.toUpperCase()}`
                          : 'Traduce instantáneamente esta transcripción a otro idioma'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center flex-wrap gap-2">
                    {/* Language Dropdown */}
                    <div className="flex items-center gap-1.5 bg-black/80 px-3 py-1.5 rounded-full border border-white/15 text-xs text-[#E1E0CC]">
                      <Languages className="w-3.5 h-3.5 text-primary shrink-0" />
                      <select
                        value={targetLang}
                        onChange={(e) => setSelectedTargetLang(e.target.value)}
                        disabled={isTranslating}
                        className="bg-transparent text-[#E1E0CC] text-xs focus:outline-none cursor-pointer pr-1 [&>option]:bg-neutral-900 [&>option]:text-[#E1E0CC]"
                        aria-label="Seleccionar idioma de traducción"
                      >
                        {TRANSLATION_LANGUAGES.map((lang) => (
                          <option key={lang.code} value={lang.code}>
                            {lang.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Translate Action Button */}
                    <button
                      type="button"
                      onClick={handleTranslate}
                      disabled={isTranslating}
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-primary hover:bg-[#ece8d4] text-black font-semibold text-xs transition-all shadow-md hover:shadow-primary/20 cursor-pointer disabled:opacity-50"
                    >
                      {isTranslating ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Traduciendo...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Traducir</span>
                        </>
                      )}
                    </button>

                    {/* View Mode Toggle when translated */}
                    {translatedText && (
                      <button
                        type="button"
                        onClick={() =>
                          setTranslationData((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  activeViewMode: prev.activeViewMode === 'translated' ? 'original' : 'translated',
                                }
                              : null
                          )
                        }
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/10 text-xs font-medium text-[#E1E0CC] transition-all cursor-pointer"
                        title="Alternar entre original y traducido"
                      >
                        <RotateCcw className="w-3 h-3 text-primary" />
                        <span>{activeViewMode === 'translated' ? 'Ver Original' : 'Ver Traducido'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Translation Error alert if any */}
                {translationError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-2.5 text-xs text-red-300">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{translationError}</span>
                  </div>
                )}

                {/* Toolbar: view tabs & search */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="flex items-center bg-black/60 p-1 rounded-xl border border-white/10 w-fit">
                    <button
                      onClick={() => setActiveTab('text')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                        activeTab === 'text'
                          ? 'bg-primary text-black font-semibold'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      Texto Completo
                    </button>
                    <button
                      onClick={() => setActiveTab('timestamps')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 cursor-pointer ${
                        activeTab === 'timestamps'
                          ? 'bg-primary text-black font-semibold'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      <ListFilter className="w-3 h-3" />
                      <span>Con Marcas de Tiempo</span>
                    </button>
                  </div>

                  {activeTab === 'timestamps' && (
                    <div className="relative flex-1 sm:max-w-xs">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Buscar en el texto..."
                        className="w-full bg-black/60 border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-[#E1E0CC] placeholder-gray-500 focus:outline-none focus:border-primary"
                      />
                    </div>
                  )}
                </div>

                {/* Text Display Area */}
                <div className="p-4 sm:p-6 rounded-2xl bg-[#090909] border border-white/10 max-h-[380px] overflow-y-auto font-sans leading-relaxed text-[#E1E0CC] text-sm select-text">
                  {activeTab === 'text' ? (
                    <p className="whitespace-pre-wrap leading-relaxed">{currentFullText}</p>
                  ) : (
                    <div className="space-y-3">
                      {filteredSegments && filteredSegments.length > 0 ? (
                        filteredSegments.map((seg, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-3 p-2 rounded-lg hover:bg-white/[0.03] transition-colors"
                          >
                            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-white/5 text-primary border border-white/5 shrink-0 mt-0.5">
                              {formatTime(seg.start)}
                            </span>
                            <p className="text-sm text-gray-300">{seg.text}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-gray-500 text-center py-6">
                          No se encontraron fragmentos para &ldquo;{searchQuery}&rdquo;.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          {!isLoading && result && (
            <div className="p-4 sm:p-6 border-t border-white/10 bg-black/40 flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-xs text-gray-500">
                100% Gratuito y sin retención de datos.
              </span>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  onClick={handleCopy}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-full border border-white/15 hover:border-primary/40 bg-white/5 hover:bg-white/10 text-xs font-semibold text-[#E1E0CC] transition-all cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span className="text-emerald-400">¡Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copiar Texto</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleDownload}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-primary hover:bg-[#ece8d4] text-black text-xs font-semibold transition-all shadow-lg hover:shadow-primary/20 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Descargar .txt</span>
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

export const TranscriptionModal: React.FC<TranscriptionModalProps> = (props) => {
  if (!props.isOpen) return null

  return <TranscriptionModalDialog {...props} />
}

