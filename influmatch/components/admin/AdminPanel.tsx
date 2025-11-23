'use client'

import { useState, useTransition, useEffect } from 'react'
import Image from 'next/image'
import { CheckCircle, XCircle, ExternalLink, Loader2, Instagram, Youtube, Globe, MapPin, Briefcase, Mail, Calendar, FileText, AlertCircle, Info, MessageSquare, AlertTriangle, Award } from 'lucide-react'
import { verifyUser, rejectUser, updateAdminNotes, manuallyAwardBadges, manuallyAwardSpecificBadge } from '@/app/admin/actions'
import { influencerBadges, brandBadges } from '@/app/badges/data'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import Link from 'next/link'

interface User {
  id: string
  full_name: string | null
  email: string | null
  role: 'influencer' | 'brand' | null
  avatar_url: string | null
  username: string | null
  social_links: Record<string, string | null> | null
  verification_status: 'pending' | 'verified' | 'rejected'
  admin_notes: string | null
  created_at: string
  bio: string | null
  category: string | null
  city: string | null
  tax_id?: string | null
  company_legal_name?: string | null
}

interface AdminPanelProps {
  pendingUsers: User[]
  verifiedUsers: User[]
  rejectedUsers: User[]
  totalUsers?: number
  influencerCount?: number
  brandCount?: number
}

const tabs = [
  { key: 'pending', label: 'Onay Bekleyenler', count: 0 },
  { key: 'verified', label: 'Onaylılar', count: 0 },
  { key: 'rejected', label: 'Reddedilenler', count: 0 },
] as const

type TabKey = (typeof tabs)[number]['key']

export default function AdminPanel({ pendingUsers, verifiedUsers, rejectedUsers, totalUsers = 0, influencerCount = 0, brandCount = 0 }: AdminPanelProps) {
  const supabase = useSupabaseClient()
  const [activeTab, setActiveTab] = useState<TabKey>('pending')
  const [isPending, startTransition] = useTransition()
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())
  const [pendingUsersState, setPendingUsersState] = useState<User[]>(pendingUsers)
  const [verifiedUsersState, setVerifiedUsersState] = useState<User[]>(verifiedUsers)
  const [rejectedUsersState, setRejectedUsersState] = useState<User[]>(rejectedUsers)
  const [badgeModalUserId, setBadgeModalUserId] = useState<string | null>(null)
  const [selectedBadgeId, setSelectedBadgeId] = useState<string>('')
  
  const [users, setUsers] = useState<User[]>(() => {
    switch (activeTab) {
      case 'pending':
        return pendingUsers
      case 'verified':
        return verifiedUsers
      case 'rejected':
        return rejectedUsers
      default:
        return []
    }
  })

  const tabsWithCounts = tabs.map((tab) => ({
    ...tab,
    count:
      tab.key === 'pending'
        ? pendingUsersState.length
        : tab.key === 'verified'
          ? verifiedUsersState.length
          : rejectedUsersState.length,
  }))

  // Update users when tab changes
  useEffect(() => {
    switch (activeTab) {
      case 'pending':
        setUsers(pendingUsersState)
        break
      case 'verified':
        setUsers(verifiedUsersState)
        break
      case 'rejected':
        setUsers(rejectedUsersState)
        break
    }
  }, [activeTab, pendingUsersState, verifiedUsersState, rejectedUsersState])
  
  // Sync with initial data
  useEffect(() => {
    setPendingUsersState(pendingUsers)
    setVerifiedUsersState(verifiedUsers)
    setRejectedUsersState(rejectedUsers)
  }, [pendingUsers, verifiedUsers, rejectedUsers])

  // Realtime subscription for user updates
  useEffect(() => {
    // Subscribe to all user updates
    const channel = supabase
      .channel('admin-users-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
        },
        async (payload) => {
          const updatedUserData = payload.new as any
          const userId = updatedUserData.id
          const newStatus = updatedUserData.verification_status

          // Fetch complete user data to ensure we have all fields
          const { data: completeUser } = await supabase
            .from('users')
            .select('id, full_name, email, role, avatar_url, username, social_links, verification_status, admin_notes, created_at, bio, category, city')
            .eq('id', userId)
            .single()

          if (!completeUser) return

          const updatedUser = completeUser as User

          // Update all state lists based on new status
          if (newStatus === 'verified') {
            setPendingUsersState((prev) => prev.filter((u) => u.id !== userId))
            setRejectedUsersState((prev) => prev.filter((u) => u.id !== userId))
            setVerifiedUsersState((prev) => {
              const exists = prev.some((u) => u.id === userId)
              if (exists) {
                return prev.map((u) => (u.id === userId ? updatedUser : u))
              }
              return [updatedUser, ...prev]
            })
          } else if (newStatus === 'rejected') {
            setPendingUsersState((prev) => prev.filter((u) => u.id !== userId))
            setVerifiedUsersState((prev) => prev.filter((u) => u.id !== userId))
            setRejectedUsersState((prev) => {
              const exists = prev.some((u) => u.id === userId)
              if (exists) {
                return prev.map((u) => (u.id === userId ? updatedUser : u))
              }
              return [updatedUser, ...prev]
            })
          } else if (newStatus === 'pending') {
            setVerifiedUsersState((prev) => prev.filter((u) => u.id !== userId))
            setRejectedUsersState((prev) => prev.filter((u) => u.id !== userId))
            setPendingUsersState((prev) => {
              const exists = prev.some((u) => u.id === userId)
              if (exists) {
                return prev.map((u) => (u.id === userId ? updatedUser : u))
              }
              return [updatedUser, ...prev]
            })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  const getCurrentUsers = () => users

  const toggleCard = (userId: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) {
        next.delete(userId)
      } else {
        next.add(userId)
      }
      return next
    })
  }

  const handleVerify = async (userId: string) => {
    if (!confirm('Bu kullanıcıyı onaylamak istediğinizden emin misiniz?')) return
    
    startTransition(async () => {
      try {
        const result = await verifyUser(userId)
        if (result.error) {
          alert(result.error)
          console.error('Verify error:', result.error)
        } else {
          console.log('User verified successfully:', userId)
        }
      } catch (error) {
        console.error('Verify exception:', error)
        alert('Bir hata oluştu. Lütfen tekrar deneyin.')
      }
      // Real-time subscription will automatically update the state
    })
  }

  const handleReject = async (userId: string) => {
    if (!confirm('Bu kullanıcıyı reddetmek istediğinizden emin misiniz?')) {
      return
    }
    
    startTransition(async () => {
      try {
        const result = await rejectUser(userId)
        if (result.error) {
          alert(result.error)
          console.error('Reject error:', result.error)
        } else {
          console.log('User rejected successfully:', userId)
        }
      } catch (error) {
        console.error('Reject exception:', error)
        alert('Bir hata oluştu. Lütfen tekrar deneyin.')
      }
      // Real-time subscription will automatically update the state
    })
  }

  const handleAwardBadges = async (userId: string) => {
    if (!confirm('Bu kullanıcı için rozetleri tekrar vermek istediğinizden emin misiniz?')) {
      return
    }
    
    startTransition(async () => {
      try {
        const result = await manuallyAwardBadges(userId)
        if (result.error) {
          alert(result.error)
          console.error('Badge awarding error:', result.error)
        } else {
          alert(result.message || 'Rozetler başarıyla verildi.')
          console.log('Badges awarded successfully for user:', userId)
        }
      } catch (error) {
        console.error('Badge awarding exception:', error)
        alert('Bir hata oluştu. Lütfen tekrar deneyin.')
      }
    })
  }

  const handleAwardSpecificBadge = async (userId: string, badgeId: string) => {
    if (!badgeId) {
      alert('Lütfen bir rozet seçin.')
      return
    }

    if (!confirm(`"${badgeId}" rozetini bu kullanıcıya vermek istediğinizden emin misiniz?`)) {
      return
    }

    startTransition(async () => {
      try {
        const result = await manuallyAwardSpecificBadge(userId, badgeId)
        if (result.error) {
          alert(result.error)
          console.error('Badge awarding error:', result.error)
        } else {
          alert(result.message || 'Rozet başarıyla verildi.')
          setBadgeModalUserId(null)
          setSelectedBadgeId('')
          console.log('Badge awarded successfully for user:', userId, 'badge:', badgeId)
        }
      } catch (error) {
        console.error('Badge awarding exception:', error)
        alert('Bir hata oluştu. Lütfen tekrar deneyin.')
      }
    })
  }

  const getAvailableBadges = (userRole: 'influencer' | 'brand' | null) => {
    if (userRole === 'influencer') {
      return influencerBadges
    } else if (userRole === 'brand') {
      return brandBadges
    }
    return [...influencerBadges, ...brandBadges]
  }

  const getSocialLink = (user: User, platform: 'instagram' | 'tiktok' | 'youtube' | 'website') => {
    const socialLinks = user.social_links as Record<string, string | null> | null
    if (!socialLinks) return null
    return socialLinks[platform] || null
  }

  const formatSocialLink = (link: string | null, platform: 'instagram' | 'tiktok' | 'youtube') => {
    if (!link) return null
    if (link.startsWith('http')) return link
    if (platform === 'instagram') return `https://instagram.com/${link.replace('@', '').replace('https://instagram.com/', '')}`
    if (platform === 'tiktok') return `https://tiktok.com/@${link.replace('@', '').replace('https://tiktok.com/@', '')}`
    if (platform === 'youtube') return link.startsWith('@') ? `https://youtube.com/${link}` : link
    return link
  }

  const getSocialLinksCount = (user: User) => {
    const socialLinks = user.social_links as Record<string, string | null> | null
    if (!socialLinks) return 0
    return Object.values(socialLinks).filter((link) => link && link.trim().length > 0).length
  }

  const getMissingInfo = (user: User) => {
    const missing: string[] = []
    const socialLinks = user.social_links as Record<string, string | null> | null
    const socialLinksCount = getSocialLinksCount(user)

    if (socialLinksCount === 0) {
      missing.push('Sosyal medya hesabı yok')
    }
    if (!user.bio) {
      missing.push('Biyografi')
    }
    if (!user.category) {
      missing.push('Kategori')
    }
    if (!user.city) {
      missing.push('Şehir')
    }
    if (!user.avatar_url) {
      missing.push('Profil fotoğrafı')
    }

    return missing
  }

  const currentUsers = getCurrentUsers()

  return (
    <main className="min-h-screen bg-background px-6 py-24 md:px-12 lg:px-24">
      <div className="mx-auto max-w-7xl">
        <div className="glass-panel rounded-[32px] p-10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-soft-gold">Admin Paneli</p>
              <h1 className="mt-4 text-3xl font-semibold text-white">Hesap Doğrulama Yönetimi</h1>
              <p className="mt-2 text-gray-300">Kullanıcı hesaplarını detaylı inceleyin ve doğrulama durumlarını yönetin.</p>
              
              {/* Statistics */}
              <div className="mt-6 grid grid-cols-3 gap-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Toplam Üye</p>
                  <p className="mt-2 text-2xl font-semibold text-soft-gold">{totalUsers}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Influencer</p>
                  <p className="mt-2 text-2xl font-semibold text-blue-400">{influencerCount}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Marka</p>
                  <p className="mt-2 text-2xl font-semibold text-purple-400">{brandCount}</p>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Link
                href="/admin/feedback"
                className="inline-flex items-center gap-2 rounded-2xl border border-soft-gold/60 bg-soft-gold/10 px-4 py-2 text-sm font-semibold text-soft-gold transition hover:border-soft-gold hover:bg-soft-gold/20"
              >
                <MessageSquare className="h-4 w-4" />
                Geri Bildirimler
              </Link>
              <Link
                href="/admin/messages"
                className="inline-flex items-center gap-2 rounded-2xl border border-soft-gold/60 bg-soft-gold/10 px-4 py-2 text-sm font-semibold text-soft-gold transition hover:border-soft-gold hover:bg-soft-gold/20"
              >
                <AlertTriangle className="h-4 w-4" />
                Raporlanan Mesajlar
              </Link>
              <Link
                href="/admin/support"
                className="inline-flex items-center gap-2 rounded-2xl border border-soft-gold/60 bg-soft-gold/10 px-4 py-2 text-sm font-semibold text-soft-gold transition hover:border-soft-gold hover:bg-soft-gold/20"
              >
                <Mail className="h-4 w-4" />
                Destek Talepleri
              </Link>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-8 flex gap-2 rounded-2xl border border-white/10 bg-[#0c0d13] p-1">
            {tabsWithCounts.map((tab) => {
              const isActive = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                    isActive
                      ? 'bg-soft-gold/20 text-soft-gold shadow-[0_0_20px_rgba(212,175,55,0.25)]'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {tab.label} ({tab.count})
                </button>
              )
            })}
          </div>

          {/* User Grid */}
          <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {currentUsers.length === 0 ? (
              <div className="col-span-full rounded-2xl border border-white/10 bg-white/5 p-10 text-center text-gray-400">
                {activeTab === 'pending' && 'Onay bekleyen kullanıcı bulunmuyor.'}
                {activeTab === 'verified' && 'Onaylı kullanıcı bulunmuyor.'}
                {activeTab === 'rejected' && 'Reddedilen kullanıcı bulunmuyor.'}
              </div>
            ) : (
              currentUsers.map((user) => {
                const isExpanded = expandedCards.has(user.id)
                const isInfluencer = user.role === 'influencer'
                const instagramLink = formatSocialLink(getSocialLink(user, 'instagram'), 'instagram')
                const tiktokLink = formatSocialLink(getSocialLink(user, 'tiktok'), 'tiktok')
                const youtubeLink = formatSocialLink(getSocialLink(user, 'youtube'), 'youtube')
                const websiteLink = getSocialLink(user, 'website')

                return (
                  <div
                    key={user.id}
                    className="group rounded-3xl border border-white/10 bg-gradient-to-br from-[#0B0C10] to-[#0F1014] p-6 transition hover:border-soft-gold/40 hover:shadow-glow"
                  >
                    {/* Header: Avatar, Name, Role, Status */}
                    <div className="flex items-start gap-4">
                      <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-2xl border-2 border-white/10 bg-white/5">
                        {user.avatar_url ? (
                          <Image
                            src={user.avatar_url}
                            alt={user.full_name ?? 'Kullanıcı'}
                            fill
                            sizes="64px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xl font-semibold text-soft-gold">
                            {user.full_name?.[0] ?? user.email?.[0] ?? 'U'}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-white truncate">{user.full_name ?? 'İsimsiz'}</h3>
                        {user.username && (
                          <p className="text-sm text-gray-400 truncate">@{user.username}</p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
                              isInfluencer
                                ? 'border-purple-500/40 bg-purple-500/10 text-purple-300'
                                : 'border-soft-gold/40 bg-soft-gold/10 text-soft-gold'
                            }`}
                          >
                            {isInfluencer ? 'Influencer' : 'Marka'}
                          </span>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
                              user.verification_status === 'pending'
                                ? 'border-yellow-400/40 bg-yellow-400/10 text-yellow-200'
                                : user.verification_status === 'verified'
                                  ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200'
                                  : 'border-red-400/40 bg-red-400/10 text-red-200'
                            }`}
                          >
                            {user.verification_status === 'pending'
                              ? 'Beklemede'
                              : user.verification_status === 'verified'
                                ? 'Onaylı'
                                : 'Reddedildi'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Profile Completeness Info */}
                    {activeTab === 'pending' && (
                      <div className="mt-4 rounded-2xl border border-blue-500/30 bg-blue-500/10 p-3">
                        <div className="flex items-center gap-2 text-xs font-semibold text-blue-300 mb-2">
                          <Info className="h-3.5 w-3.5" />
                          Profil Bilgi Durumu
                        </div>
                        <div className="space-y-1.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-300">Sosyal Medya Hesapları:</span>
                            <span className={`font-semibold ${getSocialLinksCount(user) >= 1 ? 'text-emerald-300' : 'text-red-300'}`}>
                              {getSocialLinksCount(user)} / En az 1 gerekli
                            </span>
                          </div>
                          {getMissingInfo(user).length > 0 && (
                            <div className="mt-2 pt-2 border-t border-white/10">
                              <p className="text-gray-400 mb-1">Eksik Bilgiler:</p>
                              <ul className="list-disc list-inside space-y-0.5 text-gray-400">
                                {getMissingInfo(user).slice(0, 3).map((info, idx) => (
                                  <li key={idx}>{info}</li>
                                ))}
                                {getMissingInfo(user).length > 3 && (
                                  <li className="text-gray-500">+{getMissingInfo(user).length - 3} daha...</li>
                                )}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Contact Info */}
                    <div className="mt-4 space-y-2 border-t border-white/10 pt-4">
                      <div className="flex items-center gap-2 text-sm text-gray-300">
                        <Mail className="h-4 w-4 text-gray-500" />
                        <span className="truncate">{user.email}</span>
                      </div>
                      {user.city && (
                        <div className="flex items-center gap-2 text-sm text-gray-300">
                          <MapPin className="h-4 w-4 text-gray-500" />
                          <span>{user.city}</span>
                        </div>
                      )}
                      {user.category && (
                        <div className="flex items-center gap-2 text-sm text-gray-300">
                          <Briefcase className="h-4 w-4 text-gray-500" />
                          <span>{user.category}</span>
                        </div>
                      )}
                    </div>

                    {/* Brand Verification Info - Only for brands */}
                    {!isInfluencer && (
                      <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
                        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-soft-gold mb-2">
                          <Award className="h-3.5 w-3.5" />
                          Kurumsal Doğrulama Bilgileri
                        </div>
                        
                        {/* Tax ID */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs text-gray-400">Vergi Numarası:</span>
                            {user.tax_id ? (
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-mono text-white">{user.tax_id}</span>
                                <button
                                  type="button"
                                  onClick={() => handleVerifyUser(user.id)}
                                  disabled={isPending}
                                  className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300 transition hover:border-emerald-500 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  Doğrula
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-500">Vergi bilgisi girilmedi</span>
                            )}
                          </div>
                        </div>

                        {/* Company Legal Name */}
                        {user.company_legal_name && (
                          <div className="space-y-1">
                            <span className="text-xs text-gray-400">Resmi Şirket Unvanı:</span>
                            <p className="text-sm text-white">{user.company_legal_name}</p>
                          </div>
                        )}

                        {/* Email Domain Check */}
                        {user.email && websiteLink && (() => {
                          const emailDomain = user.email.split('@')[1]?.toLowerCase()
                          const websiteDomain = websiteLink
                            .replace(/^https?:\/\//, '')
                            .replace(/^www\./, '')
                            .split('/')[0]
                            .toLowerCase()
                          
                          const domainsMatch = emailDomain && websiteDomain && emailDomain === websiteDomain
                          
                          return domainsMatch ? (
                            <div className="mt-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3">
                              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
                                <CheckCircle className="h-4 w-4" />
                                Bu hesap güvenilir görünüyor
                              </div>
                              <p className="mt-1 text-xs text-gray-400">
                                Email domain ({emailDomain}) ve website domain ({websiteDomain}) eşleşiyor.
                              </p>
                            </div>
                          ) : null
                        })()}
                      </div>
                    )}

                    {/* Social Media Links */}
                    {(instagramLink || tiktokLink || youtubeLink || websiteLink) && (
                      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
                        {instagramLink && (
                          <a
                            href={instagramLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-xl border border-pink-500/40 bg-pink-500/10 px-3 py-1.5 text-xs font-semibold text-pink-300 transition hover:border-pink-500 hover:bg-pink-500/20"
                            title="Instagram&apos;ı Kontrol Et"
                          >
                            <Instagram className="h-3.5 w-3.5" />
                            Instagram
                          </a>
                        )}
                        {tiktokLink && (
                          <a
                            href={tiktokLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-xl border border-black/40 bg-black/20 px-3 py-1.5 text-xs font-semibold text-gray-300 transition hover:border-gray-500 hover:bg-black/30"
                          >
                            <span className="text-[10px] font-bold">TT</span>
                            TikTok
                          </a>
                        )}
                        {youtubeLink && (
                          <a
                            href={youtubeLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 transition hover:border-red-500 hover:bg-red-500/20"
                          >
                            <Youtube className="h-3.5 w-3.5" />
                            YouTube
                          </a>
                        )}
                        {websiteLink && (
                          <a
                            href={websiteLink.startsWith('http') ? websiteLink : `https://${websiteLink}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-xl border border-blue-500/40 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-300 transition hover:border-blue-500 hover:bg-blue-500/20"
                          >
                            <Globe className="h-3.5 w-3.5" />
                            Siteye Git
                          </a>
                        )}
                      </div>
                    )}

                    {/* Bio */}
                    {user.bio && (
                      <div className="mt-4 border-t border-white/10 pt-4">
                        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-soft-gold mb-2">
                          <FileText className="h-3.5 w-3.5" />
                          Biyografi
                        </div>
                        <p className={`text-sm text-gray-300 ${!isExpanded ? 'line-clamp-3' : ''}`}>
                          {user.bio}
                        </p>
                        {user.bio.length > 150 && (
                          <button
                            type="button"
                            onClick={() => toggleCard(user.id)}
                            className="mt-2 text-xs text-soft-gold hover:underline"
                          >
                            {isExpanded ? 'Daha az göster' : 'Devamını oku'}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Created Date */}
                    <div className="mt-4 flex items-center gap-2 border-t border-white/10 pt-4 text-xs text-gray-500">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>
                        {new Date(user.created_at).toLocaleDateString('tr-TR', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </span>
                    </div>

                    {/* Admin Notes */}
                    {user.admin_notes && (
                      <div className="mt-4 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-3">
                        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-yellow-300 mb-1">
                          <AlertCircle className="h-3.5 w-3.5" />
                          Admin Notu
                        </div>
                        <p className="text-xs text-yellow-200/90">{user.admin_notes}</p>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="mt-6 flex flex-col gap-2 border-t border-white/10 pt-4">
                      {activeTab === 'pending' && (
                        <>
                          {instagramLink && (
                            <div className="mb-2 flex items-center gap-2 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-3 py-2">
                              <AlertCircle className="h-3.5 w-3.5 text-yellow-300" />
                              <span className="text-xs text-yellow-200">Instagram&apos;ı kontrol et</span>
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => handleVerify(user.id)}
                            disabled={isPending}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/60 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-300 transition hover:border-emerald-500 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle className="h-4 w-4" />
                            )}
                            Onayla
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReject(user.id)}
                            disabled={isPending}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-500/60 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300 transition hover:border-red-500 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <XCircle className="h-4 w-4" />
                            )}
                            Reddet
                          </button>
                        </>
                      )}
                      {activeTab === 'verified' && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setBadgeModalUserId(user.id)
                              setSelectedBadgeId('')
                            }}
                            disabled={isPending}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-blue-500/60 bg-blue-500/10 px-4 py-3 text-sm font-semibold text-blue-300 transition hover:border-blue-500 hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Award className="h-4 w-4" />
                            Manuel Rozet Ver
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAwardBadges(user.id)}
                            disabled={isPending}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-soft-gold/60 bg-soft-gold/10 px-4 py-3 text-sm font-semibold text-soft-gold transition hover:border-soft-gold hover:bg-soft-gold/20 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Award className="h-4 w-4" />
                            )}
                            Rozetleri Tekrar Ver
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReject(user.id)}
                            disabled={isPending}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-500/60 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300 transition hover:border-red-500 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <XCircle className="h-4 w-4" />
                            )}
                            Reddet
                          </button>
                        </>
                      )}
                      {activeTab === 'rejected' && (
                        <button
                          type="button"
                          onClick={() => handleVerify(user.id)}
                          disabled={isPending}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/60 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-300 transition hover:border-emerald-500 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle className="h-4 w-4" />
                          )}
                          Onayla
                        </button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Badge Award Modal */}
      {badgeModalUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0F1014] p-6 shadow-glow">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Manuel Rozet Ver</h3>
              <button
                type="button"
                onClick={() => {
                  setBadgeModalUserId(null)
                  setSelectedBadgeId('')
                }}
                className="rounded-lg p-1 text-gray-400 transition hover:bg-white/10 hover:text-white"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Rozet Seç
              </label>
              <select
                value={selectedBadgeId}
                onChange={(e) => setSelectedBadgeId(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-[#1A1B23] px-4 py-3 text-sm text-white focus:border-soft-gold focus:outline-none focus:ring-2 focus:ring-soft-gold/20"
              >
                <option value="">-- Rozet seçin --</option>
                {getAvailableBadges(
                  users.find((u) => u.id === badgeModalUserId)?.role ?? null
                ).map((badge) => (
                  <option key={badge.id} value={badge.id}>
                    {badge.name} - {badge.description}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setBadgeModalUserId(null)
                  setSelectedBadgeId('')
                }}
                className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-gray-300 transition hover:bg-white/10"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={() => handleAwardSpecificBadge(badgeModalUserId, selectedBadgeId)}
                disabled={!selectedBadgeId || isPending}
                className="flex-1 rounded-2xl border border-soft-gold/60 bg-soft-gold/10 px-4 py-3 text-sm font-semibold text-soft-gold transition hover:border-soft-gold hover:bg-soft-gold/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    Veriliyor...
                  </>
                ) : (
                  'Rozet Ver'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
