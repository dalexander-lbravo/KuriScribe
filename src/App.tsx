import { useState, useRef } from 'react'
import { Navbar } from './components/Navbar'
import { HeroSection } from './components/HeroSection'
import { AboutSection } from './components/AboutSection'
import { FeaturesSection } from './components/FeaturesSection'
import { Footer } from './components/Footer'
import { TranscriptionModal } from './components/TranscriptionModal'
import { BatchTranscriptionModal } from './components/BatchTranscriptionModal'
import { LimitsModal } from './components/LimitsModal'
import { ApiKeyModal } from './components/ApiKeyModal'
import {
  transcribeYouTubeVideo,
  transcribeBatchVideos,
  type TranscriptionResult,
  type BatchResult,
  type BatchItemState,
  type BatchInputItem,
  type TranscriptionProgress,
  extractYouTubeVideoId,
} from './services/transcriptionService'

export function App() {
  const [isLimitsOpen, setIsLimitsOpen] = useState(false)
  const [isApiKeyOpen, setIsApiKeyOpen] = useState(false)

  // Abort controllers for active requests
  const singleAbortControllerRef = useRef<AbortController | null>(null)
  const batchAbortControllerRef = useRef<AbortController | null>(null)

  const [groqApiKey, setGroqApiKey] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    return localStorage.getItem('kuriscribe_groq_key') || sessionStorage.getItem('kuriscribe_groq_key') || ''
  })
  const [isKeyPersisted, setIsKeyPersisted] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return Boolean(localStorage.getItem('kuriscribe_groq_key'))
  })

  // Modal States
  const [isSingleModalOpen, setIsSingleModalOpen] = useState(false)
  const [isSingleLoading, setIsSingleLoading] = useState(false)
  const [singleProgress, setSingleProgress] = useState<TranscriptionProgress | null>(null)
  const [singleResult, setSingleResult] = useState<TranscriptionResult | null>(null)
  const [singleError, setSingleError] = useState<string | null>(null)
  const [currentSingleFileName, setCurrentSingleFileName] = useState('transcripcion.txt')
  const [currentSingleUrl, setCurrentSingleUrl] = useState('')
  const [currentSingleTargetLang, setCurrentSingleTargetLang] = useState('auto')

  // Batch Transcription state
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false)
  const [isBatchLoading, setIsBatchLoading] = useState(false)
  const [batchProgress, setBatchProgress] = useState<TranscriptionProgress | null>(null)
  const [liveItems, setLiveItems] = useState<BatchItemState[]>([])
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null)
  const [batchError, setBatchError] = useState<string | null>(null)
  const [currentZipName, setCurrentZipName] = useState('transcripciones_kuriscribe.zip')
  const [pendingCount, setPendingCount] = useState(1)
  const [batchTargetLanguage, setBatchTargetLanguage] = useState('auto')

  const handleSaveApiKey = (key: string, persistLocal: boolean) => {
    const trimmed = key.trim()
    setGroqApiKey(trimmed)
    setIsKeyPersisted(persistLocal)
    if (trimmed) {
      sessionStorage.setItem('kuriscribe_groq_key', trimmed)
      if (persistLocal) {
        localStorage.setItem('kuriscribe_groq_key', trimmed)
      } else {
        localStorage.removeItem('kuriscribe_groq_key')
      }
    } else {
      sessionStorage.removeItem('kuriscribe_groq_key')
      localStorage.removeItem('kuriscribe_groq_key')
    }

    // Si hay una transcripción individual en curso, acelerar y reiniciar de inmediato en Capa 3 con la nueva clave
    if (isSingleModalOpen && isSingleLoading && currentSingleUrl) {
      if (singleAbortControllerRef.current) {
        singleAbortControllerRef.current.abort()
      }
      setTimeout(() => {
        handleTranscribeBatch(currentSingleUrl, currentSingleFileName, currentSingleTargetLang, trimmed)
      }, 50)
    }
  }

  const handleCloseSingleModal = () => {
    if (singleAbortControllerRef.current) {
      singleAbortControllerRef.current.abort()
      singleAbortControllerRef.current = null
    }
    setIsSingleLoading(false)
    setIsSingleModalOpen(false)
  }

  const handleCloseBatchModal = () => {
    if (batchAbortControllerRef.current) {
      batchAbortControllerRef.current.abort()
      batchAbortControllerRef.current = null
    }
    setIsBatchLoading(false)
    setIsBatchModalOpen(false)
  }

  const handleTranscribeBatch = async (
    itemsOrUrl: BatchInputItem[] | string,
    fileOrZipName: string,
    targetLanguage: string = 'auto',
    explicitGroqKey?: string
  ) => {
    const activeGroqKey = explicitGroqKey !== undefined ? explicitGroqKey : groqApiKey

    // Single video mode when passed a string
    if (typeof itemsOrUrl === 'string') {
      setCurrentSingleUrl(itemsOrUrl)
      setCurrentSingleTargetLang(targetLanguage)
      setCurrentSingleFileName(fileOrZipName || 'transcripcion.txt')
      if (singleAbortControllerRef.current) {
        singleAbortControllerRef.current.abort()
      }
      const controller = new AbortController()
      singleAbortControllerRef.current = controller

      setIsSingleModalOpen(true)
      setIsSingleLoading(true)
      setSingleError(null)
      setSingleResult(null)
      setSingleProgress({
        step: 1,
        statusMessage: activeGroqKey ? 'Iniciando transcripción acelerada con Groq Cloud...' : 'Iniciando proceso de transcripción...',
        detail: 'Verificando enlace de YouTube.',
      })

      try {
        const res = await transcribeYouTubeVideo(
          itemsOrUrl,
          (p) => setSingleProgress(p),
          activeGroqKey,
          targetLanguage,
          controller.signal
        )
        setSingleResult(res)
      } catch (err: any) {
        if (err.name === 'AbortError' || controller.signal.aborted) {
          console.log('Transcripción cancelada o reemplazada.')
          return
        }
        console.error(err)
        setSingleError(err?.message || 'Error al procesar el video.')
      } finally {
        setIsSingleLoading(false)
        singleAbortControllerRef.current = null
      }
      return
    }

    // Batch items list
    const validRows = itemsOrUrl.filter((r) => extractYouTubeVideoId(r.url) || r.url.includes('list='))
    if (validRows.length === 0) return

    if (batchAbortControllerRef.current) {
      batchAbortControllerRef.current.abort()
    }
    const batchController = new AbortController()
    batchAbortControllerRef.current = batchController

    const initialItems: BatchItemState[] = validRows.map((r) => {
      const vid = extractYouTubeVideoId(r.url) || 'video'
      return {
        videoId: vid,
        videoUrl: r.url,
        title: r.customName || `Video ${vid}`,
        customName: r.customName || undefined,
        status: 'transcribing',
      }
    })

    setCurrentZipName(fileOrZipName || 'transcripciones_kuriscribe.zip')
    setPendingCount(validRows.length)
    setBatchTargetLanguage(targetLanguage || 'auto')
    setLiveItems(initialItems)
    setIsBatchModalOpen(true)
    setIsBatchLoading(true)
    setBatchError(null)
    setBatchResult(null)
    setBatchProgress({
      step: 1,
      statusMessage: 'Iniciando procesamiento concurrente en paralelo...',
      detail: `Transcribiendo ${validRows.length} videos con nombres personalizados.`,
      totalVideos: validRows.length,
      completedVideos: 0,
    })

    try {
      const res = await transcribeBatchVideos(
        validRows,
        fileOrZipName,
        (p) => setBatchProgress(p),
        (updatedItems) => setLiveItems(updatedItems),
        groqApiKey,
        targetLanguage,
        batchController.signal
      )
      setBatchResult(res)
    } catch (err: any) {
      if (err.name === 'AbortError' || batchController.signal.aborted) {
        console.log('Procesamiento de lote cancelado por el usuario.')
        return
      }
      console.error(err)
      setBatchError(err?.message || 'Ocurrió un error inesperado al procesar el lote.')
    } finally {
      setIsBatchLoading(false)
      batchAbortControllerRef.current = null
    }
  }

  return (
    <div className="relative min-h-screen bg-black text-[#E1E0CC] selection:bg-[#DEDBC8] selection:text-black overflow-x-hidden font-sans">
      {/* Floating Navbar */}
      <Navbar
        onOpenLimits={() => setIsLimitsOpen(true)}
        onOpenApiKeyModal={() => setIsApiKeyOpen(true)}
        hasApiKey={Boolean(groqApiKey)}
      />

      {/* Main Sections */}
      <main>
        {/* Section 1: Hero with Batch Support & Individual Filenames */}
        <HeroSection
          onTranscribeBatch={handleTranscribeBatch}
          isLoading={isSingleLoading || isBatchLoading}
        />

        {/* Section 2: About */}
        <AboutSection />

        {/* Section 3: Features */}
        <FeaturesSection />
      </main>

      {/* Footer */}
      <Footer />

      {/* Single Video Transcription Modal */}
      <TranscriptionModal
        isOpen={isSingleModalOpen}
        onClose={handleCloseSingleModal}
        result={singleResult}
        isLoading={isSingleLoading}
        progress={singleProgress}
        error={singleError}
        customFileName={currentSingleFileName}
        onOpenApiKeyModal={() => setIsApiKeyOpen(true)}
        hasGroqApiKey={Boolean(groqApiKey)}
      />

      {/* Batch Video Transcription & Custom ZIP Download Modal */}
      <BatchTranscriptionModal
        isOpen={isBatchModalOpen}
        onClose={handleCloseBatchModal}
        batchResult={batchResult}
        liveItems={liveItems}
        isLoading={isBatchLoading}
        progress={batchProgress}
        error={batchError}
        customZipName={currentZipName}
        pendingVideosCount={pendingCount}
        groqApiKey={groqApiKey}
        targetLanguage={batchTargetLanguage}
        onOpenApiKeyModal={() => setIsApiKeyOpen(true)}
      />

      {/* Limits and API Key Modals */}
      <LimitsModal
        isOpen={isLimitsOpen}
        onClose={() => setIsLimitsOpen(false)}
      />

      <ApiKeyModal
        isOpen={isApiKeyOpen}
        onClose={() => setIsApiKeyOpen(false)}
        currentKey={groqApiKey}
        isPersisted={isKeyPersisted}
        onSaveKey={handleSaveApiKey}
      />
    </div>
  )
}

export default App
