import React from 'react'
import { ArrowUp } from 'lucide-react'
import { GithubIcon } from './icons/GithubIcon'
import { openExternalUrl } from '../lib/openUrl'
import hedgehogMascot from '../assets/hedgehog.jpg'

export const Footer: React.FC = () => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <footer className="relative w-full bg-black border-t border-white/10 py-10 px-4 sm:px-6 md:px-12">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-gray-500">
        
        {/* Brand Left */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <img
              src={hedgehogMascot}
              alt="KuriScribe"
              className="w-5 h-5 rounded-full object-cover border border-primary/40 shadow-sm"
            />
            <span className="font-bold text-[#E1E0CC] text-sm">KuriScribe</span>
          </div>
          <span className="text-gray-600 hidden sm:inline">|</span>
          <span className="hidden sm:inline">Frontend Ultraligero & Libre</span>
        </div>

        {/* Right Section: Credits + Scroll-to-Top Button */}
        <div className="flex flex-wrap items-center justify-center md:justify-end gap-3 sm:gap-4 text-xs text-gray-400">
          <span className="text-gray-500">Desarrollado por</span>
          
          <a
            href="https://github.com/dalexander-lbravo"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => openExternalUrl('https://github.com/dalexander-lbravo', e)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.03] border border-white/10 hover:border-primary/40 text-gray-300 hover:text-white transition-colors cursor-pointer"
          >
            <GithubIcon className="w-3.5 h-3.5" />
            <span>Alexander Luyo</span>
          </a>

          <span className="text-gray-600">•</span>

          <a
            href="https://github.com/Belen-Tesore"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => openExternalUrl('https://github.com/Belen-Tesore', e)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.03] border border-white/10 hover:border-primary/40 text-gray-300 hover:text-white transition-colors cursor-pointer"
          >
            <GithubIcon className="w-3.5 h-3.5" />
            <span>Belén Tesore</span>
          </a>

          <div className="h-4 w-px bg-white/10 hidden sm:block mx-1" />

          {/* Scroll-to-Top Button */}
          <button
            onClick={scrollToTop}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-primary transition-colors cursor-pointer ml-1"
            title="Volver arriba"
            aria-label="Volver arriba"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
        </div>

      </div>
    </footer>
  )
}
