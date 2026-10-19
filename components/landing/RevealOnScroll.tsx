'use client'

import { useEffect } from 'react'

/**
 * Ana sayfada `.rv` parçalarını kaydırınca belirtir. Yalnızca ilk ekranın altındakiler gizlenir (görünürdeki içerik hiç
 * kaybolup gelmez); ekrana giren ya da bağlantıyla atlanıp üstte kalan parça açılır. JS yoksa ya da hareket azaltma açıksa
 * hepsi baştan görünür.
 */
export default function RevealOnScroll() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let pending = Array.from(document.querySelectorAll<HTMLElement>('.lp .rv')).filter(
      (el) => el.getBoundingClientRect().top > window.innerHeight,
    )
    pending.forEach((el) => el.classList.add('pre'))

    let frame = 0
    const check = () => {
      frame = 0
      const limit = window.innerHeight * 0.92
      pending = pending.filter((el) => {
        if (el.getBoundingClientRect().top < limit) {
          el.classList.remove('pre')
          return false
        }
        return true
      })
      if (pending.length === 0) stop()
    }
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(check)
    }
    const stop = () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    check()
    return () => {
      stop()
      if (frame) window.cancelAnimationFrame(frame)
      pending.forEach((el) => el.classList.remove('pre'))
    }
  }, [])
  return null
}
