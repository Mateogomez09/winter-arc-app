import React, { useState, useEffect } from 'react';
import { useTranslation } from "react-i18next";
import { Target, CalendarCheck, Trophy, CheckSquare } from 'lucide-react';
import { User } from '../types';
import { getHabits, getAllTasks, getAllUsers } from '../services/db';
import { supabase } from '../lib/supabaseClient';

interface StatsViewProps {
  user: User;
}

export const StatsView: React.FC<StatsViewProps> = ({ user }) => {
  const { t } = useTranslation();
  
  // Calculate stats
  const habits = getHabits().filter(h => h.user_id === user.id);
  const tasks = getAllTasks().filter(t => t.user_id === user.id);
  const completions = JSON.parse(localStorage.getItem('metis_completions') || '[]').filter((c: any) => c.user_id === user.id);
  
  // 1. Puesto en Ranking (Live & Cached)
  const [rank, setRank] = useState<number>(() => {
    try {
      const cached = JSON.parse(localStorage.getItem('winterarc_cached_ranking') || '[]');
      if (Array.isArray(cached) && cached.length > 0) {
        const idx = cached.findIndex((u: any) => u.id === user.id);
        if (idx >= 0) return idx + 1;
      }
    } catch (e) {}
    const allUsers = getAllUsers().sort((a, b) => (b.xp || 0) - (a.xp || 0));
    const localIdx = allUsers.findIndex(u => u.id === user.id);
    return localIdx >= 0 ? localIdx + 1 : 1;
  });

  useEffect(() => {
    let isMounted = true;
    const fetchRank = async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id, xp')
          .order('xp', { ascending: false })
          .limit(100);

        if (!error && data && isMounted) {
          const userIndex = data.findIndex(u => u.id === user.id);
          if (userIndex >= 0) {
            setRank(userIndex + 1);
          } else {
            const { count } = await supabase
              .from('users')
              .select('*', { count: 'exact', head: true })
              .gt('xp', user.xp || 0);
            if (isMounted) {
              setRank((count || 0) + 1);
            }
          }
        }
      } catch (e) {
        // keep cached
      }
    };
    fetchRank();
  }, [user.id, user.xp]);
  
  // 2. Tareas completadas
  const completedTasksCount = tasks.filter(t => t.completed).length;
  
  // 3. Porcentaje de completación global (histórico)
  // Approximate logic: (total completions / (habits * days active))
  // For simplicity, we just show ratio of completions today, or ratio of total completions.
  // The sketch showed "Porcentaje completación". Let's use overall completion rate of active habits over their lifetime, or just a simple placeholder math that makes sense.
  const totalPossibleCompletions = habits.reduce((acc, h) => {
    const daysSinceCreation = Math.max(1, Math.floor((new Date().getTime() - new Date(h.created_at).getTime()) / (1000 * 60 * 60 * 24)));
    return acc + daysSinceCreation;
  }, 0);
  
  const completionPercentage = totalPossibleCompletions > 0 
    ? Math.round((completions.length / totalPossibleCompletions) * 100)
    : 0;
    
  // 4. Días completos
  // Group completions by date, if count >= habits.length, it's a perfect day.
  const completionsByDate = completions.reduce((acc: any, c: any) => {
    if (c.is_fully_completed !== false) {
      acc[c.date] = (acc[c.date] || 0) + 1;
    }
    return acc;
  }, {});
  
  const perfectDaysCount = Object.values(completionsByDate).filter((count: any) => count >= habits.length && habits.length > 0).length;

  return (
    <div className="min-w-full w-full flex-shrink-0 snap-center overflow-y-auto px-5 pt-7 pb-24 h-full relative">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-display font-extrabold text-brand-text tracking-tight mt-0.5">
            {t('Estadísticas')}
          </h1>
          <p className="text-xs text-brand-text-muted mt-1">{t('Tu progreso en el Winter Arc')}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        
        {/* Card 1: Porcentaje Completación */}
        <div className="bg-brand-card border border-brand-border rounded-2xl p-4 flex flex-col items-start shadow-sm">
          <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center mb-3">
            <Target size={16} className="text-blue-500" />
          </div>
          <span className="text-3xl font-display font-black text-brand-text mb-1">{Math.min(100, completionPercentage)}<span className="text-lg">%</span></span>
          <span className="text-[10px] font-bold text-brand-text-muted uppercase tracking-wider">{t('Completación')}</span>
        </div>

        {/* Card 2: Puesto Ranking */}
        <div className="bg-brand-card border border-brand-border rounded-2xl p-4 flex flex-col items-start shadow-sm">
          <div className="w-8 h-8 rounded-full bg-[#FFD700]/10 flex items-center justify-center mb-3">
            <Trophy size={16} className="text-[#FFD700]" />
          </div>
          <span className="text-3xl font-display font-black text-brand-text mb-1">#{rank > 0 ? rank : '-'}</span>
          <span className="text-[10px] font-bold text-brand-text-muted uppercase tracking-wider">{t('Puesto en Ranking')}</span>
        </div>

        {/* Card 3: Tareas Completadas */}
        <div className="bg-brand-card border border-brand-border rounded-2xl p-4 flex flex-col items-start shadow-sm">
          <div className="w-8 h-8 rounded-full bg-brand-primary/10 flex items-center justify-center mb-3">
            <CheckSquare size={16} className="text-brand-primary" />
          </div>
          <span className="text-3xl font-display font-black text-brand-text mb-1">{completedTasksCount}</span>
          <span className="text-[10px] font-bold text-brand-text-muted uppercase tracking-wider">{t('Tareas Completadas')}</span>
        </div>

        {/* Card 4: Días Completos */}
        <div className="bg-brand-card border border-brand-border rounded-2xl p-4 flex flex-col items-start shadow-sm">
          <div className="w-8 h-8 rounded-full bg-brand-green/10 flex items-center justify-center mb-3">
            <CalendarCheck size={16} className="text-brand-green" />
          </div>
          <span className="text-3xl font-display font-black text-brand-text mb-1">{perfectDaysCount}</span>
          <span className="text-[10px] font-bold text-brand-text-muted uppercase tracking-wider">{t('Días Perfectos')}</span>
        </div>

      </div>
    </div>
  );
};
