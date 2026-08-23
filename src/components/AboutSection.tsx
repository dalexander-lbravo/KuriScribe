import React from 'react'
import { motion } from 'framer-motion'
import { Sparkles, Cpu, Clock, ShieldCheck } from 'lucide-react'
import { WordsPullUpMultiStyle } from './animations/WordsPullUpMultiStyle'
import { ScrollHighlightText } from './animations/ScrollHighlightText'

export const AboutSection: React.FC = () => {
  // Single continuous headline with italic emphasis
  const headlineSegments = [
    {
      text: 'Descodifica tus clases y videos,',
      className: 'font-normal text-2xl sm:text-3xl md:text-4xl lg:text-[2.6rem] text-[#E1E0CC] tracking-tight',
    },
    {
      text: 'sin esperas ni costos.',
      className: 'italic font-serif text-2xl sm:text-3xl md:text-4xl lg:text-[2.6rem] text-primary font-normal tracking-wide',
    },
    {
      text: 'Obtén transcripciones precisas impulsadas por Whisper y subtítulos nativos.',
      className: 'font-normal text-2xl sm:text-3xl md:text-4xl lg:text-[2.6rem] text-[#E1E0CC] tracking-tight',
    },
  ]

  const descriptionText =
    'KuriScribe elimina la necesidad de procesar archivos pesados en tu computadora. Diseñado para estudiantes y creadores que necesitan convertir horas de contenido en texto limpio al instante.'

  return (
    <section
      id="about"
      className="relative w-full bg-black py-20 sm:py-24 md:py-32 px-4 sm:px-6 md:px-12 flex items-center justify-center overflow-hidden"
    >
      {/* Background soft glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[160px] pointer-events-none"
        aria-hidden="true"
      />

      {/* Central Card (bg-[#101010]) */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-5xl bg-[#101010] border border-white/10 rounded-3xl md:rounded-[2.5rem] p-6 sm:p-10 md:p-14 shadow-2xl overflow-hidden"
      >
        {/* Subtle noise inside card */}
        <div className="absolute inset-0 bg-noise opacity-10 pointer-events-none" />

        {/* Top Tag / Label */}
        <div className="relative z-10 flex items-center justify-between mb-8 md:mb-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary tracking-wide uppercase">
            <Sparkles className="w-3.5 h-3.5" />
            <span>IA & Transcripción</span>
          </div>

          <span className="text-xs font-mono text-gray-500 hidden sm:inline-block">
            01 / SOBRE KURISCRIBE
          </span>
        </div>

        {/* Unified Continuous Headline Paragraph */}
        <div className="relative z-10">
          <WordsPullUpMultiStyle
            segments={headlineSegments}
            wrapperClassName="text-left justify-start gap-x-[0.32em] gap-y-1 leading-tight md:leading-snug max-w-5xl"
          />
        </div>

        {/* Central Paragraph: Exactly 2 complete balanced lines */}
        <div className="relative z-10 my-8 md:my-12 pt-8 md:pt-10 border-t border-white/10">
          <ScrollHighlightText
            text={descriptionText}
            className="text-base sm:text-lg md:text-[1.28rem] font-light leading-relaxed md:leading-[1.65] font-sans w-full"
            activeColor="#FFFFFF"
            inactiveColor="#525252"
          />
        </div>

        {/* Symmetrical Bento Cards Grid with generous separation */}
        <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 pt-8 md:pt-12 border-t border-white/10 items-stretch">
          
          {/* Card 1: Subtítulos Nativos */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="flex flex-col justify-between p-6 sm:p-7 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-primary/40 hover:bg-white/[0.05] transition-all h-full group"
          >
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 group-hover:scale-105 transition-transform">
                  <Clock className="w-4 h-4" />
                </div>
                <h4 className="text-sm sm:text-base font-semibold text-[#E1E0CC] group-hover:text-white transition-colors">
                  Subtítulos en 2s
                </h4>
              </div>
              <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
                Extracción nativa directa sin esperas, consumiendo 0% de CPU y GPU local.
              </p>
            </div>
          </motion.div>

          {/* Card 2: Groq Whisper Cloud */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="flex flex-col justify-between p-6 sm:p-7 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-primary/40 hover:bg-white/[0.05] transition-all h-full group"
          >
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 group-hover:scale-105 transition-transform">
                  <Cpu className="w-4 h-4" />
                </div>
                <h4 className="text-sm sm:text-base font-semibold text-[#E1E0CC] group-hover:text-white transition-colors">
                  Groq Whisper Cloud
                </h4>
              </div>
              <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
                Inferencia ultrarrápida con Whisper Large V3 Turbo a 200x velocidad real.
              </p>
            </div>
          </motion.div>

          {/* Card 3: 100% Sin Costo */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="flex flex-col justify-between p-6 sm:p-7 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-primary/40 hover:bg-white/[0.05] transition-all h-full group"
          >
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 group-hover:scale-105 transition-transform">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h4 className="text-sm sm:text-base font-semibold text-[#E1E0CC] group-hover:text-white transition-colors">
                  100% Sin Costo
                </h4>
              </div>
              <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
                Hasta 8 horas diarias gratuitas en la nube sin requerir tarjeta ni registros.
              </p>
            </div>
          </motion.div>

        </div>
      </motion.div>
    </section>
  )
}
