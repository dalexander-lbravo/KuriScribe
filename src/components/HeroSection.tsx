import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  Sparkles,
  AlertCircle,
  PlayCircle,
  Archive,
  ListPlus,
  Link2,
  Plus,
  Trash2,
  FileText,
  Video,
  RotateCcw,
  Globe,
} from 'lucide-react'
import { WordsPullUp } from './animations/WordsPullUp'
import {
  type BatchInputItem,
  extractYouTubeVideoId,
  TRANSLATION_LANGUAGES,
} from '../services/transcriptionService'
import heroBgImage from '../assets/hero.png'

interface HeroSectionProps {
  onTranscribeBatch: (items: BatchInputItem[] | string, zipName: string, targetLanguage?: string) => void
  isLoading?: boolean
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onTranscribeBatch, isLoading = false }) => {
  const [inputMode, setInputMode] = useState<'single' | 'batch'>('single')
  
  // Single mode state
  const [singleUrl, setSingleUrl] = useState('')

  // Batch mode dynamic rows (all initialized completely empty with placeholders)
  const [batchRows, setBatchRows] = useState<BatchInputItem[]>([
    { id: '1', url: '', customName: '' },
    { id: '2', url: '', customName: '' },
  ])

  // Output file name state (dynamic .txt for single, .zip for batch)
  const [fileName, setFileName] = useState('')
  const [targetLanguage, setTargetLanguage] = useState('auto')
  const [error, setError] = useState<string | null>(null)

  const handleSwitchMode = (mode: 'single' | 'batch') => {
    setInputMode(mode)
    setError(null)
    if (fileName) {
      if (mode === 'single' && fileName.toLowerCase().endsWith('.zip')) {
        setFileName(fileName.slice(0, -4) + '.txt')
      } else if (mode === 'batch' && fileName.toLowerCase().endsWith('.txt')) {
        setFileName(fileName.slice(0, -4) + '.zip')
      }
    }
  }

  const handleClearFields = () => {
    setSingleUrl('')
    setBatchRows([
      { id: '1', url: '', customName: '' },
      { id: '2', url: '', customName: '' },
    ])
    setFileName('')
    setError(null)
  }

  const handleAddRow = () => {
    const nextId = String(Date.now())
    setBatchRows((prev) => [
      ...prev,
      { id: nextId, url: '', customName: '' },
    ])
  }

  const handleRemoveRow = (id: string) => {
    if (batchRows.length <= 1) return
    setBatchRows((prev) => prev.filter((r) => r.id !== id))
  }

  const handleRowChange = (id: string, field: 'url' | 'customName', val: string) => {
    setBatchRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: val } : r))
    )
    if (error) setError(null)
  }

  const validBatchCount = batchRows.filter((r) => extractYouTubeVideoId(r.url) || r.url.includes('list=')).length

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    try {
      if (inputMode === 'single') {
        const trimmed = (singleUrl || '').trim()
        if (!trimmed) {
          setError('Por favor, ingresa un enlace de YouTube válido.')
          return
        }
        if (!extractYouTubeVideoId(trimmed)) {
          setError('El formato del enlace de YouTube no es válido.')
          return
        }

        let outputName = fileName.trim()
        if (outputName) {
          if (outputName.toLowerCase().endsWith('.zip')) {
            outputName = outputName.slice(0, -4)
          }
          if (!outputName.toLowerCase().endsWith('.txt')) {
            outputName += '.txt'
          }
        } else {
          outputName = 'transcripcion.txt'
        }

        onTranscribeBatch(trimmed, outputName, targetLanguage)
      } else {
        const filled = (batchRows || []).filter((r) => r?.url && r.url.trim().length > 0)
        if (filled.length === 0) {
          setError('Agrega al menos una URL de video o playlist de YouTube.')
          return
        }

        const validList = filled.filter((r) => extractYouTubeVideoId(r.url) || r.url.includes('list='))
        if (validList.length === 0) {
          setError('Ninguna de las URLs ingresadas es un enlace válido de YouTube.')
          return
        }

        let finalZipName = fileName.trim()
        if (finalZipName) {
          if (finalZipName.toLowerCase().endsWith('.txt')) {
            finalZipName = finalZipName.slice(0, -4)
          }
          if (!finalZipName.toLowerCase().endsWith('.zip')) {
            finalZipName += '.zip'
          }
        } else {
          finalZipName = 'lote_transcripciones.zip'
        }

        onTranscribeBatch(validList, finalZipName, targetLanguage)
      }
    } catch (err: any) {
      console.error('[KuriScribe] Error al iniciar transcripción:', err)
      setError(err?.message || 'Error inesperado al procesar la solicitud.')
    }
  }

  const setSampleSingle = () => {
    setInputMode('single')
    setSingleUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    setFileName('mi_transcripcion.txt')
    setError(null)
  }

  const setSampleBatch = () => {
    setInputMode('batch')
    setBatchRows([
      { id: '1', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', customName: '01_Clase_Introduccion' },
      { id: '2', url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw', customName: '02_Ejemplo_Practico' },
    ])
    setFileName('clases_universidad.zip')
    setError(null)
  }

  return (
    <section
      id="hero"
      className="relative w-full h-screen p-3 md:p-6 flex flex-col justify-between select-none box-border"
    >
      {/* Outer frame container */}
      <div className="relative w-full h-full rounded-2xl md:rounded-[2rem] overflow-hidden bg-black flex flex-col justify-between border border-white/5 shadow-2xl">
        
        {/* Bundled fallback background image */}
        <div
          className="absolute inset-0 bg-cover bg-center z-0 filter brightness-[0.8] contrast-[1.05]"
          style={{ backgroundImage: `url(${heroBgImage})` }}
          aria-hidden="true"
        />

        {/* Background video */}
        <video
          autoPlay
          loop
          muted
          playsInline
          poster={heroBgImage}
          className="absolute inset-0 w-full h-full object-cover z-0 filter brightness-[0.8] contrast-[1.05]"
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260405_170732_8a9ccda6-5cff-4628-b164-059c500a2b41.mp4"
        />

        {/* Noise overlay layer */}
        <div
          className="absolute inset-0 z-[1] noise-overlay opacity-60 mix-blend-overlay pointer-events-none"
          aria-hidden="true"
        />

        {/* Gradient overlay */}
        <div
          className="absolute inset-0 z-[2] bg-gradient-to-b from-black/50 via-transparent to-black/80 pointer-events-none"
          aria-hidden="true"
        />

        {/* Top spacer for floating Navbar */}
        <div className="relative z-10 pt-16 md:pt-20 px-6" />

        {/* Center / Hero Title */}
        <div className="relative z-10 flex-1 flex items-center justify-center px-4 mb-2 md:mb-6 pointer-events-none">
          <div className="w-full text-center overflow-visible py-2 select-none">
            <h1 className="sr-only">KuriScribe</h1>
            <WordsPullUp
              text="KuriScribe"
              className="text-[12vw] sm:text-[11vw] md:text-[10vw] lg:text-[9.5vw] font-medium leading-[0.9] tracking-[-0.05em] text-[#E1E0CC]/85 mix-blend-screen drop-shadow-[0_10px_25px_rgba(0,0,0,0.5)]"
              showAsterisk={true}
              asteriskClassName="text-primary/90 text-[0.4em] align-super -ml-1 md:-ml-2 font-serif italic drop-shadow-md inline-block select-none transform translate-y-[-0.15em]"
            />
          </div>
        </div>

        {/* Bottom Interactive Panel */}
        <div className="relative z-10 p-4 sm:p-6 md:p-8 flex flex-col lg:flex-row items-end justify-between gap-4 md:gap-6">
          
          {/* Left subtle badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.8 }}
            className="hidden lg:flex flex-col gap-2 text-xs text-gray-400 font-medium"
          >
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 shadow-lg">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span>Whisper Turbo + Nombres Personalizados</span>
              </div>
              <span className="text-gray-500">•</span>
              <span className="text-gray-400">Descarga .ZIP Individualizada</span>
            </div>
          </motion.div>

          {/* Right interactive column */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="w-full lg:max-w-2xl flex flex-col gap-2.5 bg-black/70 backdrop-blur-xl p-4 sm:p-5 rounded-2xl md:rounded-3xl border border-[#DEDBC8]/20 shadow-2xl max-h-[46vh] sm:max-h-[50vh] overflow-y-auto"
          >
            {/* Mode Switcher & Clear Fields Button */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
              <div className="flex items-center gap-1 bg-black/70 p-1 rounded-full border border-white/10 text-xs">
                <button
                  type="button"
                  onClick={() => handleSwitchMode('single')}
                  className={`flex items-center gap-1 px-3 py-1 rounded-full transition-all cursor-pointer ${
                    inputMode === 'single'
                      ? 'bg-primary text-black font-semibold shadow'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Link2 className="w-3 h-3" />
                  <span>Un Video</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchMode('batch')}
                  className={`flex items-center gap-1 px-3 py-1 rounded-full transition-all cursor-pointer ${
                    inputMode === 'batch'
                      ? 'bg-primary text-black font-semibold shadow'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <ListPlus className="w-3 h-3" />
                  <span>Lote / Playlist</span>
                </button>
              </div>

              {/* Clear Fields & Status counter */}
              <div className="flex items-center gap-2">
                {inputMode === 'batch' && validBatchCount > 0 ? (
                  <span className="text-[11px] font-mono text-primary font-semibold hidden sm:inline">
                    {validBatchCount} video(s)
                  </span>
                ) : null}

                <button
                  type="button"
                  onClick={handleClearFields}
                  disabled={isLoading}
                  className="flex items-center gap-1.5 bg-black/70 hover:bg-white/10 px-3 py-1 rounded-full border border-[#DEDBC8]/25 text-xs text-[#E1E0CC] transition-all cursor-pointer disabled:opacity-40"
                  title="Limpiar todos los campos"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span>Limpiar campos</span>
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
              
              {/* Single Video Mode */}
              {inputMode === 'single' ? (
                <div className="relative">
                  <input
                    type="text"
                    value={singleUrl}
                    onChange={(e) => {
                      setSingleUrl(e.target.value)
                      if (error) setError(null)
                    }}
                    placeholder="Pega la URL de YouTube (ej. https://youtu.be/...)"
                    className="w-full bg-black/80 border border-[#DEDBC8]/30 focus:border-[#DEDBC8] text-[#E1E0CC] placeholder-gray-500 rounded-full px-4 py-3 text-xs sm:text-sm focus:outline-none transition-all shadow-inner"
                    disabled={isLoading}
                  />
                </div>
              ) : (
                /* Dynamic Rows Batch Mode */
                <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                  <AnimatePresence>
                    {batchRows.map((row, idx) => (
                      <motion.div
                        key={row.id}
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="flex items-center gap-2"
                      >
                        {/* URL Field */}
                        <div className="relative flex-1">
                          <Video className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                          <input
                            type="text"
                            value={row.url}
                            onChange={(e) => handleRowChange(row.id, 'url', e.target.value)}
                            placeholder={`URL #${idx + 1} (ej. https://youtu.be/...)`}
                            className="w-full bg-black/80 border border-[#DEDBC8]/25 focus:border-primary text-[#E1E0CC] placeholder-gray-500 rounded-xl pl-8 pr-3 py-2 text-xs focus:outline-none transition-all"
                            disabled={isLoading}
                          />
                        </div>

                        {/* Custom Filename Field (Clean placeholder, empty value by default) */}
                        <div className="relative w-44 sm:w-56 shrink-0">
                          <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                          <input
                            type="text"
                            value={row.customName}
                            onChange={(e) => handleRowChange(row.id, 'customName', e.target.value)}
                            placeholder="Nombre .txt (opcional)"
                            className="w-full bg-black/80 border border-white/10 focus:border-primary text-[#E1E0CC] placeholder-gray-600 rounded-xl pl-8 pr-3 py-2 text-xs focus:outline-none transition-all"
                            disabled={isLoading}
                          />
                        </div>

                        {/* Delete Row Button */}
                        {batchRows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(row.id)}
                            className="p-2 rounded-lg bg-white/5 hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-colors shrink-0 cursor-pointer"
                            title="Eliminar fila"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {/* Add Row Button */}
                  <button
                    type="button"
                    onClick={handleAddRow}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 text-xs text-primary hover:text-white transition-colors py-1 px-1 font-medium cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Agregar otro video</span>
                  </button>
                </div>
              )}

              {/* Bottom: Dynamic Output File Name & Submit */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1 border-t border-white/5">
                <div className="relative flex-1">
                  {inputMode === 'single' ? (
                    <FileText className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-primary/80" />
                  ) : (
                    <Archive className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                  )}
                  <input
                    type="text"
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                    placeholder={
                      inputMode === 'single'
                        ? 'Nombre del archivo .txt (ej. mi_transcripcion.txt)'
                        : 'Nombre del archivo .zip (ej. lote_transcripciones.zip)'
                    }
                    className="w-full bg-black/80 border border-white/10 focus:border-primary/50 text-[#E1E0CC] placeholder-gray-600 rounded-full pl-9 pr-4 py-2 text-xs focus:outline-none transition-all"
                    disabled={isLoading}
                  />
                </div>

                {/* Target Language Dropdown Selector */}
                <div className="flex items-center gap-1.5 bg-black/80 px-3 py-1.5 rounded-full border border-white/15 text-xs text-[#E1E0CC] shrink-0">
                  <Globe className="w-3.5 h-3.5 text-primary shrink-0" />
                  <select
                    value={targetLanguage}
                    onChange={(e) => setTargetLanguage(e.target.value)}
                    disabled={isLoading}
                    className="bg-transparent text-[#E1E0CC] text-xs focus:outline-none cursor-pointer pr-1 [&>option]:bg-neutral-900 [&>option]:text-[#E1E0CC]"
                    aria-label="Seleccionar idioma de transcripción o traducción"
                  >
                    <option value="auto">Idioma Original / Auto</option>
                    {TRANSLATION_LANGUAGES.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Submit Action Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="group relative flex items-center justify-center gap-2 bg-primary hover:bg-[#ece8d4] text-black font-semibold rounded-full px-5 py-2.5 text-xs sm:text-sm transition-all duration-300 shadow-lg hover:shadow-primary/20 shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>
                    {isLoading
                      ? 'Procesando...'
                      : inputMode === 'batch'
                      ? `Transcribir Lote (${validBatchCount || batchRows.length})`
                      : 'Transcribir Video'}
                  </span>
                  <div className="w-5 h-5 rounded-full bg-black flex items-center justify-center text-primary group-hover:scale-110 transition-transform duration-300">
                    <ArrowRight className="w-3 h-3 text-[#E1E0CC]" />
                  </div>
                </button>
              </div>

              {/* Error Message */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-1.5 text-xs text-red-400 px-1"
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{error}</span>
                </motion.div>
              )}

              {/* Quick sample pickers */}
              <div className="flex items-center flex-wrap gap-3 pt-0.5 text-[11px] text-gray-400">
                <span className="text-gray-500">Pruebas rápidas:</span>
                <button
                  type="button"
                  onClick={setSampleSingle}
                  className="hover:text-primary underline underline-offset-2 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <PlayCircle className="w-3 h-3" />
                  1 Video
                </button>
                <span className="text-gray-600">•</span>
                <button
                  type="button"
                  onClick={setSampleBatch}
                  className="hover:text-primary underline underline-offset-2 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <ListPlus className="w-3 h-3" />
                  Lote Demo (2 Videos)
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
