import React from 'react'
import { motion, type Variants } from 'framer-motion'
import { cn } from '../../lib/utils'

export interface TextSegment {
  text: string
  className?: string
}

interface WordsPullUpMultiStyleProps {
  segments: TextSegment[]
  wrapperClassName?: string
  delay?: number
}

export const WordsPullUpMultiStyle: React.FC<WordsPullUpMultiStyleProps> = ({
  segments,
  wrapperClassName = '',
  delay = 0,
}) => {
  const allWords: Array<{ word: string; className?: string; index: number }> = []
  let counter = 0

  segments.forEach((seg) => {
    const cleanClass = (seg.className || '')
      .replace(/\bblock\b/g, '')
      .replace(/\bw-full\b/g, '')
      .replace(/\bflex-col\b/g, '')
      .trim()

    const words = seg.text.trim().split(/\s+/)
    words.forEach((w) => {
      if (w.length > 0) {
        allWords.push({
          word: w,
          className: cleanClass,
          index: counter++,
        })
      }
    })
  })

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.04,
        delayChildren: delay,
      },
    },
  }

  const itemVariants: Variants = {
    hidden: {
      y: 12,
      opacity: 0,
      filter: 'blur(2px)',
    },
    visible: {
      y: 0,
      opacity: 1,
      filter: 'blur(0px)',
      transition: {
        duration: 0.5,
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
      className={cn(
        'inline-flex flex-wrap justify-center items-baseline gap-x-[0.3em] gap-y-1.5 max-w-5xl mx-auto leading-normal',
        wrapperClassName
      )}
    >
      {allWords.map((item, idx) => (
        <React.Fragment key={item.index}>
          <motion.span
            variants={itemVariants}
            className={cn('inline-block text-[#E1E0CC] whitespace-nowrap', item.className)}
          >
            {item.word}
          </motion.span>
          {idx < allWords.length - 1 && <span className="inline-block w-[0.25em] select-text">&nbsp;</span>}
        </React.Fragment>
      ))}
    </motion.div>
  )
}
