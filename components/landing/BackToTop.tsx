'use client'

import { useEffect, useState } from 'react'

/** Ana sayfada bir ekran boyu aşağı inince sağ altta beliren "yukarı çık" düğmesi. Stiller components/landing/landing.css (.to-top). */
export default function BackToTop() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      setShow(window.scrollY > window.innerHeight * 0.8)
    }
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  const toTop = () => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
  }

  return (
    <button
      type="button"
      className={`to-top${show ? ' show' : ''}`}
      onClick={toTop}
      aria-label="Sayfanın başına dön"
      tabIndex={show ? 0 : -1}
      aria-hidden={!show}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 19V5" />
        <path d="m5 12 7-7 7 7" />
      </svg>
    </button>
  )
}
