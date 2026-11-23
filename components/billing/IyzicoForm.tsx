'use client'

import { useEffect, useRef } from 'react'

/**
 * iyzico'nun barındırdığı ödeme / kart güncelleme formu. iyzico'nun döndürdüğü `checkoutFormContent` bir <script> parçasıdır;
 * React innerHTML'deki betiği çalıştırmadığı için betikler burada yeniden oluşturulur. Kart bilgisi yalnızca iyzico'nun formunda
 * girilir, sunucumuza gelmez. Form `#iyzipay-checkout-form` kutusuna yerleşir.
 */
export default function IyzicoForm({ content }: { content: string }) {
  const added = useRef<HTMLScriptElement[]>([])

  useEffect(() => {
    // Aynı sayfada ikinci kez açılırsa iyzico'nun eski durumu temizlenir (bilinen sorun: form ikinci kez yüklenmiyor).
    const w = window as unknown as Record<string, unknown>
    delete w.iyziInit
    delete w.iyziUcsInit
    delete w.iyziSubscriptionInit

    const holder = document.createElement('div')
    holder.innerHTML = content
    const scripts = Array.from(holder.querySelectorAll('script'))
    for (const original of scripts) {
      const script = document.createElement('script')
      for (const attr of Array.from(original.attributes)) script.setAttribute(attr.name, attr.value)
      script.text = original.text
      document.body.appendChild(script)
      added.current.push(script)
    }
    return () => {
      for (const s of added.current) s.remove()
      added.current = []
    }
  }, [content])

  return <div id="iyzipay-checkout-form" className="responsive min-h-[320px]" />
}
