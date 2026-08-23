import React, { useRef } from 'react'
import { motion, useScroll, useTransform, MotionValue } from 'framer-motion'
import { cn } from '../../lib/utils'

interface WordProps {
  children: string
  progress: MotionValue<number>
  range: [number, number]
  activeColor?: string
  inactiveColor?: string
}

const Word: React.FC<WordProps> = ({
  children,
  progress,
  range,
  activeColor = '#FFFFFF',
  inactiveColor = '#4b5563',
}) => {
  const opacity = useTransform(progress, range, [0.25, 1])
  const color = useTransform(progress, range, [inactiveColor, activeColor])

  return (
    <span className="relative inline-block mr-[0.3em] my-[0.05em]">
      <motion.span
        style={{ opacity, color }}
        className="inline-block transition-colors duration-75 select-none"
      >
        {children}
      </motion.span>
    </span>
  )
}

interface ScrollHighlightTextProps {
  text: string
  className?: string
  containerClassName?: string
  activeColor?: string
  inactiveColor?: string
}

export const ScrollHighlightText: React.FC<ScrollHighlightTextProps> = ({
  text,
  className = '',
  containerClassName = '',
  activeColor = '#FFFFFF',
  inactiveColor = '#4b5563',
}) => {
  const containerRef = useRef<HTMLDivElement>(null)

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start 88%', 'start 38%'],
  })

  const words = text.split(/\s+/)
  const total = words.length

  return (
    <div ref={containerRef} className={cn('relative', containerClassName)}>
      <p className={cn('flex flex-wrap leading-relaxed', className)}>
        {words.map((word, i) => {
          const start = i / total
          const end = start + 1 / total
          return (
            <Word
              key={i}
              progress={scrollYProgress}
              range={[start, end]}
              activeColor={activeColor}
              inactiveColor={inactiveColor}
            >
              {word}
            </Word>
          )
        })}
      </p>
    </div>
  )
}
