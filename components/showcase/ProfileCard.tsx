import React, { useState } from 'react';
import { Instagram, Youtube, Video, MessageCircle, Heart, Eye, Users, Activity, Lock } from 'lucide-react';

export type PlatformType = 'instagram' | 'tiktok' | 'youtube' | 'kick';

interface ProfileProps {
    username: string;
    platform: PlatformType;
    category: string;
    imageUrl: string;
    isVerified: boolean;
    dataPeriod?: string;
    stats?: {
        followers: string;
        engagement: string;
        avg_likes?: string;
        avg_views?: string;
        avg_comments?: string;
    };
}

const getPlatformConfig = (platform: PlatformType) => {
    switch (platform) {
        case 'instagram':
            return {
                icon: <Instagram className="w-5 h-5 text-white" />,
                color: 'bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500',
                name: 'Instagram',
                textColor: 'text-pink-600'
            };
        case 'tiktok':
            return {
                icon: <Video className="w-5 h-5 text-white" />,
                color: 'bg-black',
                name: 'TikTok',
                textColor: 'text-black'
            };
        case 'youtube':
            return {
                icon: <Youtube className="w-5 h-5 text-white" />,
                color: 'bg-red-600',
                name: 'YouTube',
                textColor: 'text-red-600'
            };
        case 'kick':
            return {
                icon: <div className="w-5 h-5 text-white font-bold flex items-center justify-center text-xs">K</div>,
                color: 'bg-green-500',
                name: 'Kick',
                textColor: 'text-green-600'
            };
        default:
            return { icon: <Activity />, color: 'bg-gray-400', name: 'Social', textColor: 'text-gray-500' };
    }
};

export default function ProfileCard({ username, platform, category, imageUrl, isVerified, dataPeriod = "Aylık Ortalama", stats }: ProfileProps) {
    const config = getPlatformConfig(platform);
    const [requestStatus, setRequestStatus] = useState<'idle' | 'loading' | 'sent'>('idle');

    const handleRequestData = () => {
        setRequestStatus('loading');
        // Burada ileride backend'e istek atılacak
        setTimeout(() => {
            setRequestStatus('sent');
        }, 1000);
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300 overflow-hidden flex flex-col h-full relative group">

            {/* --- PLATFORM İKONU --- */}
            <div className="absolute top-3 right-3 z-10">
                <div className="relative group/tooltip">
                    <div className={`p-2 rounded-full shadow-md ${config.color}`}>
                        {config.icon}
                    </div>
                    <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover/tooltip:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                        {config.name}
                    </div>
                </div>
            </div>

            <div className="p-5 flex flex-col items-center text-center flex-1">
                <div className="relative">
                    <img
                        src={imageUrl}
                        alt={username}
                        className={`w-20 h-20 rounded-full object-cover border-4 shadow-sm mb-3 ${isVerified ? 'border-gray-50' : 'border-gray-100 grayscale'}`}
                    />
                    {isVerified && (
                        <div className="absolute bottom-0 right-0 bg-blue-500 text-white p-1 rounded-full border-2 border-white" title="Analizli Profil">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                    )}
                </div>

                <h3 className="text-lg font-bold text-gray-900 truncate w-full">@{username}</h3>
                <p className="text-sm text-gray-500 mb-2">{category}</p>

                {isVerified ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-600 uppercase tracking-wide">
                        DOĞRULANMIŞ VERİ
                    </span>
                ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500">
                        <Lock className="w-3 h-3 mr-1" />
                        VERİ GİZLİ
                    </span>
                )}
            </div>

            {isVerified && stats ? (
                <div className="bg-gray-50 border-t border-gray-100">
                    <div className="px-4 py-1 bg-gray-100 border-b border-gray-200 text-center">
                        <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">
                            📅 {dataPeriod}
                        </span>
                    </div>

                    <div className="grid grid-cols-2 divide-x divide-y divide-gray-200">
                        <div className="p-3 text-center">
                            <span className="text-[10px] text-gray-400 uppercase block mb-1">Takipçi</span>
                            <span className="block text-sm font-bold text-gray-900">{stats.followers}</span>
                        </div>
                        <div className="p-3 text-center">
                            <span className="text-[10px] text-gray-400 uppercase block mb-1">Etkileşim</span>
                            <span className={`block text-sm font-bold ${config.textColor}`}>{stats.engagement}</span>
                        </div>
                        <div className="p-3 text-center">
                            <span className="text-[10px] text-gray-400 uppercase block mb-1">Ort. Beğeni</span>
                            <span className="block text-sm font-bold text-gray-800">{stats.avg_likes || '-'}</span>
                        </div>
                        <div className="p-3 text-center">
                            <span className="text-[10px] text-gray-400 uppercase block mb-1">{platform === 'instagram' ? 'Ort. Yorum' : 'Ort. İzlenme'}</span>
                            <span className="block text-sm font-bold text-gray-800">
                                {platform === 'instagram' ? stats.avg_comments : stats.avg_views}
                            </span>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-gray-50 px-5 py-4 border-t border-gray-100 text-center mt-auto">
                    {/* --- TALEP BUTONU --- */}
                    {requestStatus === 'sent' ? (
                        <button disabled className="w-full py-2 px-3 rounded-md text-xs font-semibold bg-green-50 text-green-600 border border-green-200 flex items-center justify-center">
                            <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                            Talep İletildi
                        </button>
                    ) : (
                        <button
                            onClick={handleRequestData}
                            disabled={requestStatus === 'loading'}
                            className="w-full py-2 px-3 rounded-md text-xs font-semibold bg-white text-indigo-600 border border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300 transition-colors flex items-center justify-center group-hover:shadow-sm"
                        >
                            {requestStatus === 'loading' ? (
                                <svg className="animate-spin h-4 w-4 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            ) : (
                                <>
                                    <Lock className="w-3 h-3 mr-1.5" />
                                    Verileri Görüntülemeyi Talep Et
                                </>
                            )}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
