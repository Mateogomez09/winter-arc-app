import React, { useState, useEffect } from 'react';
import { useTranslation } from "react-i18next";
import { Trophy, Clock, Medal, Crown } from 'lucide-react';
import { User } from '../types';
import { getAllUsers } from '../services/db';
import { getAvatarFrame, getNameColor } from '../utils/profileCustomization';
import { supabase } from '../lib/supabaseClient';

interface RankingViewProps {
  user: User;
  onUserClick: (userId: string) => void;
}

export const RankingView: React.FC<RankingViewProps> = ({ user, onUserClick }) => {
  const { t } = useTranslation();
  const [timeLeft, setTimeLeft] = useState('');
  const [rankingUsers, setRankingUsers] = useState<User[]>(() => {
    try {
      const cached = JSON.parse(localStorage.getItem('winterarc_cached_ranking') || '[]');
      if (Array.isArray(cached) && cached.length > 0) return cached;
    } catch (e) {}
    return getAllUsers().sort((a, b) => (b.xp || 0) - (a.xp || 0));
  });

  const top3 = rankingUsers.slice(0, 3);
  const restUsers = rankingUsers.slice(3);

  // Live Ranking Fetch from Supabase
  useEffect(() => {
    let isMounted = true;

    const fetchRanking = async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id, name, username, avatar_url, level, xp, created_at')
          .order('xp', { ascending: false })
          .limit(50);

        if (!error && data && data.length > 0 && isMounted) {
          // Map users from Supabase and reflect current user's live XP
          let hasCurrentUser = false;
          const updatedList: User[] = (data as any[]).map(ru => {
            if (ru.id === user.id) {
              hasCurrentUser = true;
              return { ...user, ...ru, xp: Math.max(ru.xp || 0, user.xp || 0), level: user.level || ru.level };
            }
            return ru as User;
          });

          // If current user is not in top 50, ensure local list has user
          if (!hasCurrentUser && user.id) {
            updatedList.push(user);
          }

          const sorted = updatedList.sort((a, b) => (b.xp || 0) - (a.xp || 0));
          setRankingUsers(sorted);
          localStorage.setItem('winterarc_cached_ranking', JSON.stringify(sorted));
        }
      } catch (e) {
        // Fallback to local
        if (isMounted) {
          setRankingUsers(getAllUsers().sort((a, b) => (b.xp || 0) - (a.xp || 0)));
        }
      }
    };

    fetchRanking();

    // 1. Supabase Realtime subscription
    const channel = supabase
      .channel('public:ranking_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
        fetchRanking();
      })
      .subscribe();

    // 2. Sync on app focus / screen unlock
    const onFocus = () => {
      fetchRanking();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);

    // 3. Relaxed passive fallback (every 60s)
    const interval = setInterval(fetchRanking, 60000);

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
      clearInterval(interval);
    };
  }, [user.id, user.xp, user.level]);

  useEffect(() => {
    const timer = setInterval(() => {
      const end = new Date(new Date().getFullYear(), 11, 20); // 20th of December
      const now = new Date();
      if (now > end) {
        end.setFullYear(end.getFullYear() + 1);
      }
      const diff = end.getTime() - now.getTime();
      
      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)).toString().padStart(2, '0');
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)).toString().padStart(2, '0');
      const s = Math.floor((diff % (1000 * 60)) / 1000).toString().padStart(2, '0');
      
      setTimeLeft(`${d}d ${h}h ${m}m ${s}s`);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-w-full w-full flex-shrink-0 snap-center overflow-y-auto px-5 pt-7 pb-24 h-full relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-2xl font-display font-extrabold text-brand-text tracking-tight mt-0.5">
            {t('Ranking')}
          </h1>
          <p className="text-xs text-brand-text-muted mt-0.5">{t('Compite por ser el mejor')}</p>
        </div>
      </div>

      {/* Aesthetic Countdown Bar with Brand Blue Accent & Label */}
      {timeLeft && (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-2xl bg-brand-card border border-brand-border shadow-xs mb-4">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-brand-primary animate-pulse" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-brand-text-muted">
              {t('Finaliza en')}
            </span>
          </div>
          <div className="font-mono font-black text-xs text-brand-text tracking-tight">
            {timeLeft}
          </div>
        </div>
      )}

      {/* Podium with generous top margin for bouncing trophy */}
      {top3.length > 0 && (
        <div className="flex items-end justify-center h-48 mb-10 space-x-2 mt-12">
          {/* 2nd Place */}
          {top3[1] && (
            <div className="flex flex-col items-center flex-1 z-10 animate-fade-in-up cursor-pointer active:scale-95 transition-transform" style={{ animationDelay: '0.1s' }} onClick={() => onUserClick(top3[1].id)}>
              <div className="relative mb-2">
                <img src={top3[1].avatar_url} className={`w-12 h-12 rounded-full object-cover border-2 border-[#C0C0C0] ${getAvatarFrame(top3[1].avatar_frame).glowClass}`} />
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-[#C0C0C0] text-black text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-brand-bg shadow-md">2</div>
              </div>
              <div className="w-full bg-gradient-to-t from-[#C0C0C0]/20 to-[#C0C0C0]/5 border-t-2 border-[#C0C0C0] rounded-t-xl h-24 flex flex-col items-center justify-start pt-3">
                <span className={`text-xs font-bold truncate w-full text-center px-1 ${getNameColor(top3[1].name_color).textClass}`}>{top3[1].name}</span>
                <span className="text-[10px] text-brand-text-muted mt-1">{top3[1].xp} XP</span>
              </div>
            </div>
          )}

          {/* 1st Place */}
          {top3[0] && (
            <div className="flex flex-col items-center flex-1 z-20 animate-fade-in-up relative -mt-4 cursor-pointer active:scale-95 transition-transform" style={{ animationDelay: '0.2s' }} onClick={() => onUserClick(top3[0].id)}>
              <Trophy size={24} className="text-[#FFD700] mb-2 absolute -top-8 animate-bounce" />
              <div className="relative mb-2">
                <img src={top3[0].avatar_url} className={`w-16 h-16 rounded-full object-cover border-4 border-[#FFD700] shadow-[0_0_15px_rgba(255,215,0,0.4)] ${getAvatarFrame(top3[0].avatar_frame).glowClass}`} />
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-[#FFD700] text-black text-[10px] font-bold w-6 h-6 rounded-full flex items-center justify-center border-2 border-brand-bg shadow-md">1</div>
              </div>
              <div className="w-full bg-gradient-to-t from-[#FFD700]/30 to-[#FFD700]/5 border-t-2 border-[#FFD700] rounded-t-xl h-32 flex flex-col items-center justify-start pt-3 shadow-[0_-5px_15px_rgba(255,215,0,0.1)]">
                <span className={`text-sm font-bold truncate w-full text-center px-1 ${getNameColor(top3[0].name_color).textClass}`}>{top3[0].name}</span>
                <span className="text-[10px] text-[#FFD700] font-bold mt-1">{top3[0].xp} XP</span>
              </div>
            </div>
          )}

          {/* 3rd Place */}
          {top3[2] && (
            <div className="flex flex-col items-center flex-1 z-10 animate-fade-in-up cursor-pointer active:scale-95 transition-transform" style={{ animationDelay: '0.3s' }} onClick={() => onUserClick(top3[2].id)}>
              <div className="relative mb-2">
                <img src={top3[2].avatar_url} className={`w-12 h-12 rounded-full object-cover border-2 border-[#CD7F32] ${getAvatarFrame(top3[2].avatar_frame).glowClass}`} />
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-[#CD7F32] text-black text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-brand-bg shadow-md">3</div>
              </div>
              <div className="w-full bg-gradient-to-t from-[#CD7F32]/20 to-[#CD7F32]/5 border-t-2 border-[#CD7F32] rounded-t-xl h-20 flex flex-col items-center justify-start pt-3">
                <span className={`text-xs font-bold truncate w-full text-center px-1 ${getNameColor(top3[2].name_color).textClass}`}>{top3[2].name}</span>
                <span className="text-[10px] text-brand-text-muted mt-1">{top3[2].xp} XP</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Rest of the list */}
      <div className="space-y-2">
        {restUsers.map((u, i) => {
          const uFrame = getAvatarFrame(u.avatar_frame);
          const uColor = getNameColor(u.name_color);

          return (
            <div 
              key={u.id} 
              onClick={() => onUserClick(u.id)} 
              className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer active:scale-[0.98] transition-all ${
                u.id === user.id ? 'bg-brand-primary/10 border-brand-primary/30' : 'bg-brand-card hover:bg-brand-card-sec border-brand-border'
              }`}
            >
              <div className="flex items-center space-x-3">
                <span className="text-xs font-bold text-brand-text-muted w-4 text-center">{i + 4}</span>
                <div className="relative flex-shrink-0">
                  <img src={u.avatar_url} className={`w-8 h-8 rounded-full object-cover ${uFrame.borderClass} ${uFrame.glowClass}`} />
                </div>
                <div className="flex items-center space-x-1.5 flex-wrap">
                  <span className={`text-sm font-bold ${uColor.textClass}`}>
                    {u.name}
                  </span>
                  {u.title && (
                    <span className="text-[8px] font-bold px-1 py-0.2 rounded bg-brand-primary/10 text-brand-primary border border-brand-primary/20">
                      {u.title}
                    </span>
                  )}
                  {u.id === user.id && <span className="text-[10px] font-normal text-brand-primary ml-1">(Tú)</span>}
                </div>
              </div>
              <span className="text-xs font-bold text-brand-text-muted bg-brand-bg px-2 py-1 rounded-md">{u.xp} XP</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
