'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'

export function Loading() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-grid" style={{ backgroundColor: 'var(--color-bg-dark)' }}>
      <div className="relative flex flex-col items-center">
        <motion.div
          className="relative"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="w-20 h-20 flex items-center justify-center">
            <Image src="/icon.png" alt="RugBlitz" width={80} height={80} className="rounded-lg" />
          </div>
        </motion.div>
        
        <div className="flex gap-3 mt-8">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-3 h-3 bg-main rounded-full border border-black"
              animate={{ y: [0, -12, 0], scale: [1, 1.2, 1] }}
              transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
            />
          ))}
        </div>
        
      </div>
    </div>
  )
}
