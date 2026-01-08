'use client'

import { useState } from 'react'
import { adminManualConnectInstagram } from '@/app/admin/actions'

export default function ManualConnectPage() {
    const [identifier, setIdentifier] = useState('')
    const [username, setUsername] = useState('')
    const [status, setStatus] = useState('')
    const [loading, setLoading] = useState(false)

    const handleConnect = async () => {
        if (!identifier || !username) {
            setStatus('Lütfen tüm alanları doldurun.')
            return
        }

        setLoading(true)
        setStatus('İşleniyor...')

        try {
            const result = await adminManualConnectInstagram(identifier, username)
            if (result.success) {
                setStatus(`✅ BAŞARILI: ${result.message}`)
                // Clear inputs on success maybe?
            } else {
                setStatus(`❌ HATA: ${result.error}`)
            }
        } catch (e: any) {
            setStatus(`Kritik Hata: ${e.message}`)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-black text-white p-8">
            <div className="max-w-md mx-auto bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-2xl">
                <h1 className="text-xl font-bold mb-1 text-soft-gold">Manuel Instagram Bağlama</h1>
                <p className="text-xs text-gray-500 mb-6">Problemli hesapları admin yetkisiyle zorla bağlar.</p>

                <div className="flex flex-col gap-4">
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Kullanıcı ID (UUID) veya Email</label>
                        <input
                            className="w-full bg-black/50 border border-zinc-700 p-3 rounded-lg text-sm focus:border-soft-gold outline-none transition"
                            placeholder="9e8250fc-..."
                            value={identifier}
                            onChange={e => setIdentifier(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Instagram Kullanıcı Adı</label>
                        <input
                            className="w-full bg-black/50 border border-zinc-700 p-3 rounded-lg text-sm focus:border-soft-gold outline-none transition"
                            placeholder="arzuuerguu"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                        />
                    </div>

                    <button
                        onClick={handleConnect}
                        disabled={loading}
                        className="mt-2 w-full bg-soft-gold text-black font-semibold p-3 rounded-lg hover:bg-yellow-500 disabled:opacity-50 transition flex justify-center items-center"
                    >
                        {loading ? (
                            <span className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin"></span>
                        ) : (
                            'Bağla ve Onayla'
                        )}
                    </button>

                    {status && (
                        <div className={`mt-4 p-3 rounded-lg text-xs font-mono break-words ${status.startsWith('❌') ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
                            {status}
                        </div>
                    )}

                    <div className="mt-6 pt-4 border-t border-zinc-800">
                        <a href="/admin" className="text-xs text-gray-500 hover:text-white transition">← Admin Paneline Dön</a>
                    </div>
                </div>
            </div>
        </div>
    )
}
