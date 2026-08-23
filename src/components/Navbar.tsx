import React from 'react'
import { motion } from 'framer-motion'
import { Sparkles, Zap } from 'lucide-react'
import { GithubIcon } from './icons/GithubIcon'
import { openExternalUrl } from '../lib/openUrl'
import hedgehogMascot from '../assets/hedgehog.jpg'

interface NavbarProps {
  onOpenLimits: () => void
  onOpenApiKeyModal?: () => void
  hasApiKey?: boolean
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenLimits, onOpenApiKeyModal, hasApiKey }) => {
  return (
    <motion.header
      initial={{ y: -30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="absolute top-0 left-0 right-0 z-30 flex justify-center pointer-events-none px-4"
    >
      <nav
        aria-label="Navegación principal"
        className="pointer-events-auto bg-black/90 backdrop-blur-md border border-[#DEDBC8]/15 shadow-2xl rounded-b-2xl md:rounded-b-3xl px-4 py-2.5 md:px-8 flex items-center gap-4 md:gap-8"
      >
        {/* Brand mark */}
        <a
          href="#hero"
          className="flex items-center gap-2 text-sm font-semibold tracking-wide text-[#E1E0CC] hover:text-primary transition-colors duration-200"
        >
          <img
            src={hedgehogMascot}
            alt="KuriScribe"
            className="w-5 h-5 rounded-full object-cover border border-primary/40 shadow-sm"
          />
          <span className="font-sans font-bold">KuriScribe</span>
        </a>

        <div className="h-3 w-px bg-white/10 hidden sm:block" />

        {/* Navigation links */}
        <div className="flex items-center gap-4 md:gap-6 text-xs md:text-sm font-normal text-gray-400">
          <a
            href="#hero"
            className="hover:text-[#E1E0CC] transition-colors duration-200"
          >
            Inicio
          </a>
          <a
            href="#about"
            className="hover:text-[#E1E0CC] transition-colors duration-200"
          >
            Nosotros
          </a>
          <a
            href="#features"
            className="hover:text-[#E1E0CC] transition-colors duration-200"
          >
            Características
          </a>
          <button
            onClick={onOpenLimits}
            className="hover:text-primary transition-colors duration-200 flex items-center gap-1 text-xs cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 text-primary" />
            <span>Límites Gratis</span>
          </button>
        </div>

        <div className="h-3 w-px bg-white/10 hidden md:block" />

        {/* Actions */}
        <div className="flex items-center gap-2">
          {onOpenApiKeyModal && (
            <button
              onClick={onOpenApiKeyModal}
              title={hasApiKey ? 'Groq Key Configurada' : 'Configurar Groq Key opcional'}
              className="hidden lg:flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-white/10 bg-white/5 hover:border-primary/40 text-gray-300 hover:text-primary transition-all duration-200 cursor-pointer"
            >
              <Sparkles className="w-3 h-3 text-primary" />
              <span>{hasApiKey ? 'Groq Activo' : 'Groq Key'}</span>
            </button>
          )}

          <a
            href="https://github.com/dalexander-lbravo/KuriScribe"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => openExternalUrl('https://github.com/dalexander-lbravo/KuriScribe', e)}
            className="flex items-center gap-1.5 text-xs md:text-sm text-gray-300 hover:text-white p-1.5 rounded-full hover:bg-white/5 transition-colors duration-200 cursor-pointer"
            aria-label="Repositorio de KuriScribe en GitHub"
          >
            <GithubIcon className="w-4 h-4" />
            <span className="hidden sm:inline">GitHub</span>
          </a>
        </div>
      </nav>
    </motion.header>
  )
}
