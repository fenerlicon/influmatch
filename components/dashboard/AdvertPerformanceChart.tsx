'use client'

import {
    Area,
    AreaChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts'
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getAnalyticsStats } from '@/app/actions/analytics'

interface AdvertPerformanceChartProps {
    brandId: string
    className?: string
}

export default function AdvertPerformanceChart({ brandId, className }: AdvertPerformanceChartProps) {
    const [data, setData] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        async function fetchStats() {
            try {
                const result = await getAnalyticsStats(brandId, '7d')
                if (result.success && result.data) {
                    // Process data: Group by day
                    const dailyStats = new Map<string, number>()
                    const now = new Date()

                    // Init last 7 days with 0
                    for (let i = 6; i >= 0; i--) {
                        const d = new Date()
                        d.setDate(now.getDate() - i)
                        dailyStats.set(d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }), 0)
                    }

                    // Count views
                    result.data.forEach((event: any) => {
                        const dateStr = new Date(event.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
                        // Only count if within our map (last 7 days scope)
                        if (dailyStats.has(dateStr) && event.event_type === 'view_advert') {
                            dailyStats.set(dateStr, (dailyStats.get(dateStr) || 0) + 1)
                        }
                    })

                    const chartData = Array.from(dailyStats.entries()).map(([date, views]) => ({
                        date,
                        views
                    }))

                    setData(chartData)
                } else {
                    setError('Veri yüklenemedi')
                }
            } catch (err) {
                console.error(err)
                setError('Bir hata oluştu')
            } finally {
                setIsLoading(false)
            }
        }

        fetchStats()
    }, [brandId])

    if (isLoading) {
        return (
            <div className={`flex h-64 items-center justify-center rounded-2xl border border-line bg-surface-1 ${className ?? ''}`}>
                <Loader2 className="h-6 w-6 animate-spin text-ink-faint" />
            </div>
        )
    }

    if (error) {
        return (
            <div className={`flex h-64 items-center justify-center rounded-2xl border border-line bg-surface-1 text-sm text-danger ${className ?? ''}`}>
                {error}
            </div>
        )
    }

    return (
        <div className={`rounded-2xl border border-line bg-surface-1 p-5 ${className ?? ''}`}>
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h3 className="text-[17px] font-semibold tracking-tight text-ink">İlan görüntülenmeleri</h3>
                    <p className="text-[12.5px] text-ink-faint">Son 7 gün</p>
                </div>
                <div className="text-right">
                    <p className="text-[26px] font-semibold tabular-nums text-ink">
                        {data.reduce((acc, curr) => acc + curr.views, 0)}
                    </p>
                    <p className="text-xs text-ink-faint">toplam</p>
                </div>
            </div>

            <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.18} />
                                <stop offset="95%" stopColor="#D4AF37" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.07)" />
                        <XAxis
                            dataKey="date"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#6B6B70', fontSize: 12 }}
                            dy={10}
                        />
                        <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#6B6B70', fontSize: 12 }}
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#17191F', border: '1px solid rgba(255,255,255,0.13)', borderRadius: '8px', color: '#F3F1EC' }}
                            itemStyle={{ color: '#d4af37' }}
                        />
                        <Area
                            type="monotone"
                            dataKey="views"
                            stroke="#d4af37"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#colorViews)"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}
