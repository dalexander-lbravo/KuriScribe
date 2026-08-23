import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Key, ExternalLink, Check, Trash2, Info } from 'lucide-react'

interface ApiKeyModalProps {
  isOpen: boolean
  onClose: () => void
  currentKey: string
  isPersisted: boolean
  onSaveKey: (key: string, persistLocal: boolean) => void
}

const ApiKeyModalDialog: React.FC<Omit<ApiKeyModalProps, 'isOpen'>> = ({
  onClose,
  currentKey,
  isPersisted,
  onSaveKey,
}) => {
  const [apiKey, setApiKey] = useState(currentKey)
  const [persist, setPersist] = useState(isPersisted)
  const [saved, setSaved] = useState(false)

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    onSaveKey(apiKey.trim(), persist)
    setSaved(true)
    setTimeout(() => {
      setSaved(false)
      onClose()
    }, 800)
  }

  const handleClear = () => {
    setApiKey('')
    onSaveKey('', false)
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-lg bg-[#101010] border border-white/15 rounded-3xl shadow-2xl overflow-hidden z-10 p-6 sm:p-8"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#E1E0CC]">Clave Groq API (Opcional)</h3>
                <p className="text-xs text-gray-400">Inferencia en la nube con Whisper Large V3 Turbo</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSave} className="py-6 space-y-4">
            <p className="text-xs text-gray-400 leading-relaxed">
              KuriScribe intentará primero obtener los subtítulos oficiales de YouTube. Si el vídeo no dispone de ellos, puedes proporcionar tu propia clave gratuita de Groq API para transcribir el audio.
            </p>

            <div>
              <label htmlFor="groq-key" className="block text-xs font-semibold text-gray-300 mb-2">
                Groq API Key (ej. <code className="text-primary/90">gsk_...</code>)
              </label>
              <input
                id="groq-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="gsk_xxxxxxxxxxxxxxxxxxxxxxxx"
                className="w-full bg-black/60 border border-white/15 focus:border-primary rounded-xl px-4 py-2.5 text-xs text-[#E1E0CC] placeholder-gray-600 focus:outline-none transition-colors"
              />
            </div>

            {/* Storage Option */}
            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2.5">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={persist}
                  onChange={(e) => setPersist(e.target.checked)}
                  className="mt-0.5 rounded border-white/20 bg-black/40 text-primary focus:ring-0 focus:ring-offset-0"
                />
                <div className="text-xs">
                  <span className="font-semibold text-gray-200">Recordar en este navegador (localStorage)</span>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {persist
                      ? 'La clave permanecerá guardada en tu dispositivo hasta que la borres.'
                      : 'Por defecto, la clave solo se mantiene en memoria durante la sesión activa.'}
                  </p>
                </div>
              </label>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <a
                href="https://console.groq.com/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline flex items-center gap-1 text-[11px]"
              >
                <span>Obtener clave gratuita en Groq</span>
                <ExternalLink className="w-3 h-3" />
              </a>

              {apiKey && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-gray-400 hover:text-red-400 flex items-center gap-1 text-[11px] transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Borrar clave</span>
                </button>
              )}
            </div>

            <div className="flex items-start gap-2 p-3 rounded-xl bg-white/[0.02] border border-white/5 text-[11px] text-gray-400">
              <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <span>La clave se transmite cifrada directamente hacia la API de inferencia y nunca se almacena en bases de datos de servidores de KuriScribe.</span>
            </div>

            {/* Actions */}
            <div className="pt-4 border-t border-white/10 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-full text-xs text-gray-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-6 py-2 rounded-full bg-primary hover:bg-[#ece8d4] text-black font-semibold text-xs transition-colors"
              >
                {saved ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-black" />
                    <span>Guardado</span>
                  </>
                ) : (
                  <span>Guardar Configuración</span>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  isOpen,
  onClose,
  currentKey,
  isPersisted,
  onSaveKey,
}) => {
  if (!isOpen) return null

  return (
    <ApiKeyModalDialog
      onClose={onClose}
      currentKey={currentKey}
      isPersisted={isPersisted}
      onSaveKey={onSaveKey}
    />
  )
}

