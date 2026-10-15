'use client'

import { useState } from 'react'
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area,
    BarChart,
    Bar
} from 'recharts'
import { ArrowDown, ArrowUp, TrendingUp } from 'lucide-react'
import { Card, CardBody, CardHeader, EmptyState, Segmented, StatCard } from '@/components/ui'

interface HistoryRecord {
    id: string
    follower_count: number
    engagement_rate: number
    avg_likes: number
    avg_comments: number
    avg_views: number
    recorded_at: string
}

interface StatsHistoryProps {
    history: HistoryRecord[]
}

const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
}

// Grafik renkleri tasarım token'larıyla aynı (tailwind.config.ts).
const C = { gold: '#D4AF37', success: '#5BBF8A', info: '#7FA6DB', grid: 'rgba(255,255,255,0.07)', axis: '#6B6F7A' }
const axisProps = { stroke: C.axis, tick: { fontSize: 11 }, tickLine: false, axisLine: false }
const compact = (value: number) => (value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value))

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="rounded-xl border border-line-strong bg-surface-3 p-3 shadow-xl">
                <p className="mb-1.5 text-xs text-ink-faint">{formatDate(label)}</p>
                {payload.map((entry: any, index: number) => (
                    <div key={index} className="flex items-center gap-2 text-[13px]">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
                        <span className="text-ink-muted">{entry.name}:</span>
                        <span className="font-medium tabular-nums text-ink">
                            {entry.value.toLocaleString('tr-TR')}
                            {entry.unit}
                        </span>
                    </div>
                ))}
            </div>
        )
    }
    return null
}

function Change({ value, suffix }: { value: number; suffix: (abs: string) => string }) {
    const up = value >= 0
    return (
        <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${up ? 'text-success' : 'text-danger'}`}>
            {up ? <ArrowUp className="h-3 w-3" aria-hidden /> : <ArrowDown className="h-3 w-3" aria-hidden />}
            {suffix(Math.abs(value).toFixed(2))}
        </span>
    )
}

export default function StatsHistory({ history }: StatsHistoryProps) {
    const [timeRange, setTimeRange] = useState<'week' | 'month' | 'all'>('all')

    // Veriyi sırala (eskiden yeniye)
    const sortedHistory = [...history].sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime())

    // Filtreleme
    const filteredHistory = sortedHistory.filter(item => {
        const date = new Date(item.recorded_at)
        const now = new Date()
        if (timeRange === 'week') {
            const weekAgo = new Date(now.setDate(now.getDate() - 7))
            return date >= weekAgo
        }
        if (timeRange === 'month') {
            const monthAgo = new Date(now.setMonth(now.getMonth() - 1))
            return date >= monthAgo
        }
        return true
    })

    if (!history || history.length === 0) {
        return (
            <Card>
                <EmptyState
                    icon={TrendingUp}
                    title="Henüz geçmiş veri yok"
                    description="Hesap verilerin biriktikçe gelişim grafiklerin burada görünür."
                />
            </Card>
        )
    }

    // Değişim Hesaplama (Son vs İlk - seçili aralıkta)
    const first = filteredHistory[0]
    const last = filteredHistory[filteredHistory.length - 1]

    const calculateChange = (current: number, previous: number) => {
        if (!previous) return 0
        return ((current - previous) / previous) * 100
    }

    const followerChange = (first && last) ? calculateChange(last.follower_count, first.follower_count) : 0
    const engagementChange = (first && last) ? last.engagement_rate - first.engagement_rate : 0 // Percentage point diff for rate

    const hasRange = filteredHistory.length > 1

    return (
        <div className="grid gap-5">
            <div className="flex justify-end">
                <Segmented
                    label="Zaman aralığı"
                    value={timeRange}
                    onSelect={(v) => setTimeRange(v as typeof timeRange)}
                    items={[
                        { value: 'week', label: 'Son 7 gün' },
                        { value: 'month', label: 'Son 30 gün' },
                        { value: 'all', label: 'Tümü' },
                    ]}
                />
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard
                    label="Takipçi"
                    value={last?.follower_count.toLocaleString('tr-TR') ?? '—'}
                    detail={hasRange ? <Change value={followerChange} suffix={(a) => `%${a}`} /> : undefined}
                />
                <StatCard
                    label="Etkileşim oranı"
                    value={last ? `%${last.engagement_rate}` : '—'}
                    detail={hasRange ? <Change value={engagementChange} suffix={(a) => `${a} puan`} /> : undefined}
                />
                <StatCard label="Ort. beğeni" value={last?.avg_likes.toLocaleString('tr-TR') ?? '—'} />
                <StatCard label="Ort. izlenme" value={last?.avg_views.toLocaleString('tr-TR') ?? '—'} />
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
                <Card>
                    <CardHeader title="Takipçi büyümesi" />
                    <CardBody className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={filteredHistory}>
                                <defs>
                                    <linearGradient id="colorFollower" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={C.gold} stopOpacity={0.3} />
                                        <stop offset="95%" stopColor={C.gold} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
                                <XAxis dataKey="recorded_at" tickFormatter={formatDate} {...axisProps} />
                                <YAxis {...axisProps} width={44} tickFormatter={compact} />
                                <Tooltip content={<CustomTooltip />} />
                                <Area type="monotone" dataKey="follower_count" name="Takipçi" stroke={C.gold} fillOpacity={1} fill="url(#colorFollower)" strokeWidth={2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardBody>
                </Card>

                <Card>
                    <CardHeader title="Etkileşim oranı (%)" />
                    <CardBody className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={filteredHistory}>
                                <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
                                <XAxis dataKey="recorded_at" tickFormatter={formatDate} {...axisProps} />
                                <YAxis {...axisProps} width={44} domain={['dataMin - 0.5', 'dataMax + 0.5']} />
                                <Tooltip content={<CustomTooltip />} />
                                <Line
                                    type="monotone"
                                    dataKey="engagement_rate"
                                    name="Etkileşim"
                                    stroke={C.success}
                                    strokeWidth={2}
                                    dot={{ r: 3, fill: C.success, strokeWidth: 0 }}
                                    activeDot={{ r: 5 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardBody>
                </Card>

                <Card className="lg:col-span-2">
                    <CardHeader title="Ortalama etkileşimler" description="Beğeni, izlenme ve yorum" />
                    <CardBody className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={filteredHistory}>
                                <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
                                <XAxis dataKey="recorded_at" tickFormatter={formatDate} {...axisProps} />
                                <YAxis {...axisProps} width={44} tickFormatter={compact} />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                                <Bar dataKey="avg_likes" name="Ort. beğeni" fill={C.gold} radius={[4, 4, 0, 0]} />
                                <Bar dataKey="avg_views" name="Ort. izlenme" fill={C.info} radius={[4, 4, 0, 0]} />
                                <Bar dataKey="avg_comments" name="Ort. yorum" fill={C.success} radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardBody>
                </Card>
            </div>
        </div>
    )
}
