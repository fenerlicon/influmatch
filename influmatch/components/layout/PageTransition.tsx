'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { usePathname } from 'next/navigation'
import { ReactNode } from 'react'

interface PageTransitionProps {
  children: ReactNode
}

const pageVariants = {
  initial: {
    opacity: 0,
    y: 5,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.1,
      ease: [0.16, 1, 0.3, 1],
      opacity: {
        duration: 0.08,
      },
      y: {
        duration: 0.1,
      },
    },
  },
  exit: {
    opacity: 0,
    y: -5,
    transition: {
      duration: 0.08,
      ease: [0.16, 1, 0.3, 1],
      opacity: {
        duration: 0.05,
      },
      y: {
        duration: 0.08,
      },
    },
  },
}

export default function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname()

  return (
    <AnimatePresence mode="wait" initial={true}>
      <motion.div
        key={pathname}
        initial="initial"
        animate="animate"
        exit="exit"
        variants={pageVariants}
        className="w-full h-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

