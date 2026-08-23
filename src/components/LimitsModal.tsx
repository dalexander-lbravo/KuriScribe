import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Zap, CheckCircle2 } from 'lucide-react'

interface LimitsModalProps {
  isOpen: boolean
  onClose: () => void
}

export const LimitsModal: React.FC<LimitsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
          className="relative w-full max-w-2xl bg-[#101010] border border-white/15 rounded-3xl shadow-2xl overflow-hidden z-10 p-6 sm:p-8"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-6 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#E1E0CC]">Límites y Cuotas Gratuitas</h3>
                <p className="text-xs text-gray-400">Transcribe sin pagar un solo centavo</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Details */}
          <div className="py-6 space-y-6">
            
            {/* Step 1 Native limits */}
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-primary/20 text-primary">
                    Paso 1
                  </span>
                  <h4 className="text-sm font-bold text-[#E1E0CC]">Subtítulos Nativos de YouTube</h4>
                </div>
                <span className="text-xs font-semibold text-emerald-400">Directo de YouTube</span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                Extracción directa de subtítulos oficiales o generados automáticamente por YouTube. No requiere cuotas de inferencia adicionales y responde en pocos segundos.
              </p>
            </div>

            {/* Step 2 Groq Whisper limits */}
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-primary/20 text-primary">
                    Paso 2
                  </span>
                  <h4 className="text-sm font-bold text-[#E1E0CC]">Inferencia Groq Cloud (Whisper Turbo)</h4>
                </div>
                <span className="text-xs font-semibold text-primary">Capa Gratuita de Groq</span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                Para vídeos sin subtítulos en YouTube, Groq provee una cuota gratuita diaria de procesamiento de audio en sus servidores mediante chips LPU.
              </p>
            </div>

            {/* Guarantees */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 px-4 pt-1">
              <div className="flex items-center gap-2.5 text-xs text-gray-300">
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                <span>Sin tarjeta de crédito requerida</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-gray-300">
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                <span>Sin marcas de agua</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-gray-300">
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                <span>Sin necesidad de GPU local</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-gray-300">
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                <span>Exportación limpia en texto plano (.txt)</span>
              </div>
            </div>

            {/* Accuracy and Responsibility Notice */}
            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 text-[11px] text-gray-400 space-y-1">
              <span className="font-semibold text-gray-300">Aviso sobre precisión y contenido:</span>
              <p>Las transcripciones generadas por modelos de IA pueden contener discrepancias de puntuación, términos técnicos o segmentación. Asegúrate de contar con los permisos correspondientes para el uso del contenido de acuerdo con los Términos de YouTube.</p>
            </div>
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-white/10 flex items-center justify-between">
            <span className="text-xs text-gray-500">Diseñado con tecnología abierta</span>
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-full bg-primary text-black font-semibold text-xs hover:bg-[#ece8d4] transition-colors cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
