'use client'

import Link from 'next/link'
import { useState } from 'react'

const NAV = [
  { href: '#nasil', label: 'Nasıl çalışır' },
  { href: '#dogrulama', label: 'Doğrulama' },
  { href: '#spotlight', label: 'Spotlight' },
  { href: '#sss', label: 'S.S.S.' },
]

/** Ana sayfanın üst menüsü (Yön B · Ürün sahnesi); dar ekranda açılır menü. Stiller components/landing/landing.css. */
export default function ProductStageHeader() {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)
  return (
    <header className="hdr">
      <div className="wrap">
        <Link className="logo" href="/" aria-label="Influmatch ana sayfa">
          INFLU<b>MATCH</b>
        </Link>
        <nav className="nav" aria-label="Ana menü">
          {NAV.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
        <div className="hdr-cta">
          <Link className="login" href="/login">
            Giriş yap
          </Link>
          <Link className="btn btn-ghost" href="/signup">
            Ücretsiz başla
          </Link>
        </div>
        <button className="menu-btn" type="button" aria-expanded={open} aria-controls="lp-menu" onClick={() => setOpen((v) => !v)}>
          {open ? 'Kapat' : 'Menü'}
        </button>
      </div>
      <div className={`m-panel${open ? ' open' : ''}`} id="lp-menu">
        {NAV.map((item) => (
          <a key={item.href} href={item.href} onClick={close}>
            {item.label}
          </a>
        ))}
        <Link href="/login" onClick={close}>
          Giriş yap
        </Link>
        <Link className="btn btn-primary" href="/signup" onClick={close}>
          Ücretsiz başla
        </Link>
      </div>
    </header>
  )
}
