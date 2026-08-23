import React from 'react'
import { motion, type Variants } from 'framer-motion'
import { cn } from '../../lib/utils'

interface WordsPullUpProps {
  text: string
  className?: string
  wrapperClassName?: string
  showAsterisk?: boolean
  asteriskClassName?: string
  delay?: number
}

export const WordsPullUp: React.FC<WordsPullUpProps> = ({
  text,
  className = '',
  wrapperClassName = '',
  showAsterisk = false,
  asteriskClassName = 'text-primary text-[0.45em] align-super ml-1 font-serif select-none',
  delay = 0,
}) => {
  const words = text.trim().split(/\s+/)

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: (customDelay = delay) => ({
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: customDelay,
      },
    }),
  }

  const itemVariants: Variants = {
    hidden: {
      y: 20,
      opacity: 0,
      filter: 'blur(4px)',
    },
    visible: {
      y: 0,
      opacity: 1,
      filter: 'blur(0px)',
      transition: {
        duration: 0.7,
        ease: [0.22, 1, 0.36, 1],
      },
    },
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-20px' }}
      className={cn('inline-flex flex-wrap items-center justify-center gap-x-[0.3em] leading-normal', wrapperClassName)}
    >
      {words.map((word, idx) => {
        const isLastWord = idx === words.length - 1
        return (
          <React.Fragment key={idx}>
            <motion.span
              variants={itemVariants}
              className={cn('inline-block tracking-tight text-[#E1E0CC]', className)}
            >
              {word}
              {isLastWord && showAsterisk && (
                <span className={cn(asteriskClassName)} aria-hidden="true">
                  *
                </span>
              )}
            </motion.span>
            {!isLastWord && <span className="inline-block w-[0.25em] select-text">&nbsp;</span>}
          </React.Fragment>
        )
      })}
    </motion.div>
  )
}
