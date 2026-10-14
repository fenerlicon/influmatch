'use client'

import { Printer } from 'lucide-react'
import { Button } from '@/components/ui'

/** Tarayıcının yazdırma penceresi: "PDF olarak kaydet" buradan seçilir (dış PDF servisi yok). */
export default function PrintButton() {
  return (
    <Button type="button" variant="primary" leftIcon={<Printer />} onClick={() => window.print()}>
      Yazdır / PDF olarak kaydet
    </Button>
  )
}
