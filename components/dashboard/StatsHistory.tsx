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
import { TrendingUp, Users, Heart, MessageCircle, Eye, ArrowUp, ArrowDown } from 'lucide-react'

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

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="rounded-lg border border-white/10 bg-black/90 p-3 shadow-xl backdrop-blur-md">
                <p className="mb-2 text-xs font-semibold text-gray-300">{formatDate(label)}</p>
                {payload.map((entry: any, index: number) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }}></span>
                        <span className="text-gray-400">{entry.name}:</span>
                        <span className="font-mono font-medium text-white">
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

    // Eğer veri yoksa
    if (!history || history.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-4 rounded-full bg-white/5 p-4">
                    <TrendingUp className="h-8 w-8 text-gray-500" />
                </div>
                <h3 className="text-lg font-semibold text-white">Henüz Geçmiş Veri Yok</h3>
                <p className="mt-2 max-w-sm text-sm text-gray-400">
                    Analiz verileriniz biriktikçe burada detaylı gelişim grafikleri göreceksiniz. Profilinizi düzenli güncelleyerek veri birikmesini sağlayın.
                </p>
            </div>
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

    return (
        <div className="space-y-8">
            {/* Header & Filters */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-xl font-bold text-white">Gelişim Analizleri</h2>
                    <p className="text-sm text-gray-400">Hesap verilerinizin zaman içindeki değişimi</p>
                </div>
                <div className="flex rounded-lg bg-white/5 p-1">
                    {(['week', 'month', 'all'] as const).map((range) => (
                        <button
                            key={range}
                            onClick={() => setTimeRange(range)}
                            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${timeRange === range
                                    ? 'bg-soft-gold text-black shadow-sm'
                                    : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            {range === 'week' ? 'Son 7 Gün' : range === 'month' ? 'Son 30 Gün' : 'Tümü'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {/* Follower Card */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="mb-2 flex items-center gap-2 text-xs text-gray-400">
                        <Users className="h-4 w-4" />
                        Takipçi Değişimi
                    </div>
                    <div className="flex items-end gap-2">
                        <span className="text-2xl font-bold text-white">
                            {last?.follower_count.toLocaleString('tr-TR')}
                        </span>
                        {filteredHistory.length > 1 && (
                            <span className={`mb-1 flex items-center text-xs font-medium ${followerChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {followerChange >= 0 ? <ArrowUp className="mr-0.5 h-3 w-3" /> : <ArrowDown className="mr-0.5 h-3 w-3" />}
                                %{Math.abs(followerChange).toFixed(2)}
                            </span>
                        )}
                    </div>
                </div>

                {/* Engagement Card */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="mb-2 flex items-center gap-2 text-xs text-gray-400">
                        <TrendingUp className="h-4 w-4" />
                        Etkileşim Oranı
                    </div>
                    <div className="flex items-end gap-2">
                        <span className="text-2xl font-bold text-white">
                            %{last?.engagement_rate}
                        </span>
                        {filteredHistory.length > 1 && (
                            <span className={`mb-1 flex items-center text-xs font-medium ${engagementChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {engagementChange >= 0 ? <ArrowUp className="mr-0.5 h-3 w-3" /> : <ArrowDown className="mr-0.5 h-3 w-3" />}
                                {Math.abs(engagementChange).toFixed(2)} puan
                            </span>
                        )}
                    </div>
                </div>

                {/* Avg Likes */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="mb-2 flex items-center gap-2 text-xs text-gray-400">
                        <Heart className="h-4 w-4" />
                        Ort. Beğeni
                    </div>
                    <div className="flex items-end gap-2">
                        <span className="text-2xl font-bold text-white">
                            {last?.avg_likes.toLocaleString('tr-TR')}
                        </span>
                    </div>
                </div>

                {/* Avg Views */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="mb-2 flex items-center gap-2 text-xs text-gray-400">
                        <Eye className="h-4 w-4" />
                        Ort. İzlenme
                    </div>
                    <div className="flex items-end gap-2">
                        <span className="text-2xl font-bold text-white">
                            {last?.avg_views.toLocaleString('tr-TR')}
                        </span>
                    </div>
                </div>
            </div>

            {/* Charts Grid */}
            <div className="grid gap-6 lg:grid-cols-2">
                {/* Follower Growth Chart */}
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                    <h3 className="mb-6 text-sm font-semibold text-gray-300">Takipçi Büyümesi</h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={filteredHistory}>
                                <defs>
                                    <linearGradient id="colorFollower" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#82ca9d" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                                <XAxis
                                    dataKey="recorded_at"
                                    tickFormatter={formatDate}
                                    stroke="#666"
                                    tick={{ fontSize: 12 }}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    stroke="#666"
                                    tick={{ fontSize: 12 }}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                <Area
                                    type="monotone"
                                    dataKey="follower_count"
                                    name="Takipçi"
                                    stroke="#82ca9d"
                                    fillOpacity={1}
                                    fill="url(#colorFollower)"
                                    strokeWidth={2}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Engagement Rate Chart */}
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                    <h3 className="mb-6 text-sm font-semibold text-gray-300">Etkileşim Oranı (%)</h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={filteredHistory}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                                <XAxis
                                    dataKey="recorded_at"
                                    tickFormatter={formatDate}
                                    stroke="#666"
                                    tick={{ fontSize: 12 }}
                                    tickLine={false}
                                />
                                <YAxis
                                    stroke="#666"
                                    tick={{ fontSize: 12 }}
                                    tickLine={false}
                                    domain={['dataMin - 0.5', 'dataMax + 0.5']}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                <Line
                                    type="monotone"
                                    dataKey="engagement_rate"
                                    name="Etkileşim"
                                    stroke="#ffc658"
                                    strokeWidth={3}
                                    dot={{ r: 4, fill: '#ffc658', strokeWidth: 0 }}
                                    activeDot={{ r: 6 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Interactions Bar Chart */}
                <div className="col-span-full rounded-2xl border border-white/10 bg-white/5 p-6">
                    <h3 className="mb-6 text-sm font-semibold text-gray-300">Ortalama Etkileşimler (Beğeni, Yorum, İzlenme)</h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={filteredHistory}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                                <XAxis
                                    dataKey="recorded_at"
                                    tickFormatter={formatDate}
                                    stroke="#666"
                                    tick={{ fontSize: 12 }}
                                />
                                <YAxis
                                    stroke="#666"
                                    tick={{ fontSize: 12 }}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar dataKey="avg_likes" name="Ort. Beğeni" fill="#8884d8" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="avg_views" name="Ort. İzlenme" fill="#82ca9d" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="avg_comments" name="Ort. Yorum" fill="#ffc658" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    )
}
