import React from 'react'
import { motion, type Variants } from 'framer-motion'
import { Check, Sparkles, Zap } from 'lucide-react'
import { WordsPullUp } from './animations/WordsPullUp'
import heroBgImage from '../assets/hero.png'

export const FeaturesSection: React.FC = () => {
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.12,
        delayChildren: 0.1,
      },
    },
  }

  const cardVariants: Variants = {
    hidden: {
      opacity: 0,
      scale: 0.95,
      y: 20,
    },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: [0.22, 1, 0.36, 1],
      },
    },
  }

  return (
    <section
      id="features"
      className="relative w-full bg-black py-16 md:py-24 px-4 sm:px-6 md:px-12 overflow-hidden"
    >
      {/* Background noise with 0.15 opacity */}
      <div
        className="absolute inset-0 bg-noise opacity-15 pointer-events-none"
        aria-hidden="true"
      />

      <div className="relative z-10 max-w-7xl mx-auto">
        
        {/* Section Header: Symmetrical 2 Clean Separate Lines */}
        <div className="mb-12 md:mb-16 text-center max-w-4xl mx-auto flex flex-col items-center">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-primary mb-4"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>CARACTERÍSTICAS</span>
          </motion.div>

          {/* Line 1: Main Title (Normal Text) */}
          <div className="w-full text-center">
            <WordsPullUp
              text="Flujos de transcripción inteligentes."
              className="text-2xl sm:text-3xl md:text-5xl font-normal text-[#E1E0CC] tracking-tight leading-tight"
            />
          </div>

          {/* Line 2: Subtitle (Completely in Serif Italic, Centered underneath) */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="text-lg sm:text-2xl md:text-3xl text-primary/90 font-serif italic font-normal tracking-wide leading-relaxed mt-2"
          >
            Del video al texto en segundos.
          </motion.p>
        </div>

        {/* 4 Cards Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {/* Card 1: Video Card */}
          <motion.div
            variants={cardVariants}
            className="relative lg:h-[480px] rounded-3xl overflow-hidden bg-black border border-white/10 flex flex-col justify-end p-6 group hover:border-[#DEDBC8]/40 transition-colors duration-300"
          >
            {/* Background Fallback & Video */}
            <div
              className="absolute inset-0 bg-cover bg-center z-0 filter brightness-[0.7]"
              style={{ backgroundImage: `url(${heroBgImage})` }}
              aria-hidden="true"
            />
            <video
              autoPlay
              loop
              muted
              playsInline
              poster={heroBgImage}
              className="absolute inset-0 w-full h-full object-cover z-0 filter brightness-[0.7] group-hover:scale-105 transition-transform duration-700 ease-out"
              src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260406_133058_0504132a-0cf3-4450-a370-8ea3b05c95d4.mp4"
            />

            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent z-[1]" />
            <div className="absolute inset-0 noise-overlay opacity-40 mix-blend-overlay z-[2]" />

            {/* Content */}
            <div className="relative z-10">
              <div className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-primary mb-3">
                <Sparkles className="w-4 h-4" />
              </div>
              <p className="text-xs font-mono uppercase tracking-widest text-primary mb-1">
                Tiempo Real
              </p>
              <h3 className="text-2xl font-bold text-[#E1E0CC] tracking-tight">
                Texto instantáneo.
              </h3>
              <p className="text-xs text-gray-300 mt-2 font-normal">
                Visualiza y exporta palabras en sincronía sin interrupciones.
              </p>
            </div>
          </motion.div>

          {/* Card 2: Subtítulos Directos (01 - Nativo) */}
          <motion.div
            variants={cardVariants}
            className="relative lg:h-[480px] rounded-3xl bg-[#212121] border border-white/10 p-6 sm:p-8 flex flex-col justify-between group hover:border-[#DEDBC8]/40 transition-colors duration-300 shadow-xl"
          >
            <div>
              <div className="flex items-center justify-between mb-6">
                <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-md bg-black/40 text-primary border border-white/10">
                  01
                </span>
                <span className="text-xs text-gray-500 font-mono">NATIVO</span>
              </div>

              <h3 className="text-2xl font-bold text-[#E1E0CC] mb-2">
                Subtítulos Directos.
              </h3>
              <p className="text-xs text-gray-400 mb-6 leading-relaxed">
                Extracción inmediata de pistas existentes o autogeneradas por YouTube.
              </p>
            </div>

            {/* Checklist */}
            <ul className="space-y-3.5 pt-4 border-t border-white/10">
              {[
                'Extrae en 2 segundos',
                'Cero consumo de CPU',
                'Soporte multi-idioma',
                'Exportación a .txt',
              ].map((item, idx) => (
                <li key={idx} className="flex items-center gap-3 text-xs sm:text-sm text-gray-300">
                  <div className="w-5 h-5 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 text-primary" />
                  </div>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Card 3: Whisper Turbo Cloud (02 - Groq Cloud) */}
          <motion.div
            variants={cardVariants}
            className="relative lg:h-[480px] rounded-3xl bg-[#212121] border border-white/10 p-6 sm:p-8 flex flex-col justify-between group hover:border-[#DEDBC8]/40 transition-colors duration-300 shadow-xl"
          >
            <div>
              <div className="flex items-center justify-between mb-6">
                <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-md bg-black/40 text-primary border border-white/10">
                  02
                </span>
                <span className="text-xs text-gray-500 font-mono">GROQ CLOUD</span>
              </div>

              <h3 className="text-2xl font-bold text-[#E1E0CC] mb-2">
                Whisper Turbo Cloud.
              </h3>
              <p className="text-xs text-gray-400 mb-6 leading-relaxed">
                Inferencia acelerada en hardware LPU sin tocar tus recursos locales.
              </p>
            </div>

            {/* Checklist */}
            <ul className="space-y-3.5 pt-4 border-t border-white/10">
              {[
                'Procesa videos sin subtítulos',
                'Modelo Whisper Large V3',
                '200x velocidad real',
                'Límite de 8 hrs/día gratis',
              ].map((item, idx) => (
                <li key={idx} className="flex items-center gap-3 text-xs sm:text-sm text-gray-300">
                  <div className="w-5 h-5 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 text-primary" />
                  </div>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Card 4: Flujo de Trabajo (03 - Exportación) */}
          <motion.div
            variants={cardVariants}
            className="relative lg:h-[480px] rounded-3xl bg-[#212121] border border-white/10 p-6 sm:p-8 flex flex-col justify-between group hover:border-[#DEDBC8]/40 transition-colors duration-300 shadow-xl"
          >
            <div>
              <div className="flex items-center justify-between mb-6">
                <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-md bg-black/40 text-primary border border-white/10">
                  03
                </span>
                <span className="text-xs text-gray-500 font-mono">EXPORTACIÓN</span>
              </div>

              <h3 className="text-2xl font-bold text-[#E1E0CC] mb-2">
                Flujo de Trabajo.
              </h3>
              <p className="text-xs text-gray-400 mb-6 leading-relaxed">
                Herramientas directas diseñadas para agilizar la toma de notas y resúmenes.
              </p>
            </div>

            {/* Checklist */}
            <ul className="space-y-3.5 pt-4 border-t border-white/10">
              {[
                'Copiado en un clic',
                'Descarga de archivos .txt',
                'Interfaz ultraligera',
                'Sin registros obligatorios',
              ].map((item, idx) => (
                <li key={idx} className="flex items-center gap-3 text-xs sm:text-sm text-gray-300">
                  <div className="w-5 h-5 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 text-primary" />
                  </div>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
