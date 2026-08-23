import React, { useRef } from 'react'
import { motion, useScroll, useTransform, MotionValue } from 'framer-motion'
import { cn } from '../../lib/utils'

interface CharacterProps {
  char: string
  progress: MotionValue<number>
  range: [number, number]
}

const Character: React.FC<CharacterProps> = ({ char, progress, range }) => {
  // High-contrast readable range: base 0.55 opacity to 1.0 bright cream
  const opacity = useTransform(progress, range, [0.55, 1])
  const color = useTransform(progress, range, ['#a3a3a3', '#E1E0CC'])

  return (
    <motion.span
      style={{ opacity, color }}
      className="transition-colors duration-150"
    >
      {char}
    </motion.span>
  )
}

interface AnimatedWordProps {
  word: string
  progress: MotionValue<number>
  wordStart: number
  wordEnd: number
  totalCharsInText: number
  globalCharOffset: number
}

const AnimatedWord: React.FC<AnimatedWordProps> = ({
  word,
  progress,
  totalCharsInText,
  globalCharOffset,
}) => {
  const characters = word.split('')

  return (
    <span className="inline-block whitespace-nowrap mr-[0.3em]">
      {characters.map((char, charIdx) => {
        const charGlobalIndex = globalCharOffset + charIdx
        const start = charGlobalIndex / totalCharsInText
        const end = start + 1 / totalCharsInText

        return (
          <Character
            key={charIdx}
            char={char}
            progress={progress}
            range={[start, end]}
          />
        )
      })}
    </span>
  )
}

interface ScrollRevealTextProps {
  text: string
  className?: string
  containerClassName?: string
}

export const ScrollRevealText: React.FC<ScrollRevealTextProps> = ({
  text,
  className = '',
  containerClassName = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null)

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start 85%', 'end 45%'],
  })

  const wordsData = React.useMemo(() => {
    const words = text.split(' ')
    const totalChars = text.length
    return words.reduce<Array<{ word: string; currentOffset: number; wordStart: number; wordEnd: number }>>(
      (acc, word) => {
        const last = acc[acc.length - 1]
        const currentOffset = last ? last.currentOffset + last.word.length + 1 : 0
        acc.push({
          word,
          currentOffset,
          wordStart: currentOffset / totalChars,
          wordEnd: (currentOffset + word.length) / totalChars,
        })
        return acc
      },
      []
    )
  }, [text])

  const totalChars = text.length

  return (
    <div ref={containerRef} className={cn('relative', containerClassName)}>
      <p className={cn('flex flex-wrap leading-relaxed text-balance text-neutral-300', className)}>
        {wordsData.map((item, wordIdx) => (
          <AnimatedWord
            key={wordIdx}
            word={item.word}
            progress={scrollYProgress}
            wordStart={item.wordStart}
            wordEnd={item.wordEnd}
            totalCharsInText={totalChars}
            globalCharOffset={item.currentOffset}
          />
        ))}
      </p>
    </div>
  )
}

export const AnimatedLetter = Character
