import React from 'react';
import { useTranslation } from "react-i18next";
import { X, Trophy, CheckSquare, Target, Crown } from 'lucide-react';
import { User } from '../types';
import { getHabits, getAllTasks } from '../services/db';
import { getAvatarFrame, getNameColor } from '../utils/profileCustomization';

interface PublicProfileModalProps {
  user: User | undefined;
  onClose: () => void;
}

export const PublicProfileModal: React.FC<PublicProfileModalProps> = ({ user, onClose }) => {
  const { t } = useTranslation();

  if (!user) return null;

  const habits = getHabits().filter(h => h.user_id === user.id);
  const tasks = getAllTasks().filter(t => t.user_id === user.id);
  const completions = JSON.parse(localStorage.getItem('metis_completions') || '[]').filter((c: any) => c.user_id === user.id);
  const completedTasksCount = tasks.filter(t => t.completed).length;

  const frame = getAvatarFrame(user.avatar_frame);
  const nameColor = getNameColor(user.name_color);

  return (
    <div className="fixed inset-0 bg-brand-bg/60 z-[200] flex items-center justify-center p-4 animate-overlay-fade-in backdrop-blur-sm">
      <div className="w-full max-w-sm bg-brand-modal dynamic-bg-card backdrop-blur-2xl border border-brand-border rounded-3xl p-6 shadow-2xl animate-scale-up relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-brand-card hover:bg-brand-card-sec rounded-full text-brand-text-muted transition-colors cursor-pointer"
        >
          <X size={20} />
        </button>

        <div className="flex flex-col items-center justify-center mb-6 pt-2">
          <div className="relative mb-3">
            <img 
              src={user.avatar_url} 
              alt={user.name} 
              className={`w-20 h-20 rounded-full object-cover transition-all ${frame.borderClass} ${frame.glowClass}`} 
            />
            <span className={`absolute -bottom-1 -right-1 text-[9px] font-black px-1.5 py-0.2 rounded-full border border-black/40 ${frame.badgeColor || 'bg-brand-primary text-black'}`}>
              Nv.{user.level || 1}
            </span>
          </div>

          <h2 className={`text-lg font-bold text-center ${nameColor.textClass}`}>
            {user.name}
          </h2>

          <div className="flex items-center space-x-1.5 mt-0.5 mb-1 justify-center flex-wrap">
            <span className="text-xs text-brand-text-muted">
              @{user.username || user.name.toLowerCase()}
            </span>
            {user.title && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-brand-primary/10 text-brand-primary border border-brand-primary/20 flex items-center space-x-1">
                <Crown size={10} />
                <span>{user.title}</span>
              </span>
            )}
          </div>

          <p className="text-xs font-semibold text-brand-primary mt-1">Level {user.level} • {user.xp} XP</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-brand-bg p-3 rounded-xl border border-brand-border flex flex-col items-center">
            <Trophy size={16} className="text-[#FFD700] mb-1" />
            <span className="text-lg font-bold text-brand-text">{user.xp}</span>
            <span className="text-[9px] text-brand-text-muted uppercase font-bold">{t('Experiencia')}</span>
          </div>
          <div className="bg-brand-bg p-3 rounded-xl border border-brand-border flex flex-col items-center">
            <CheckSquare size={16} className="text-brand-primary mb-1" />
            <span className="text-lg font-bold text-brand-text">{completedTasksCount}</span>
            <span className="text-[9px] text-brand-text-muted uppercase font-bold">{t('Tareas')}</span>
          </div>
          <div className="bg-brand-bg p-3 rounded-xl border border-brand-border flex flex-col items-center">
            <Target size={16} className="text-blue-500 mb-1" />
            <span className="text-lg font-bold text-brand-text">{habits.length}</span>
            <span className="text-[9px] text-brand-text-muted uppercase font-bold">{t('Hábitos')}</span>
          </div>
          <div className="bg-brand-bg p-3 rounded-xl border border-brand-border flex flex-col items-center">
            <span className="text-lg font-bold text-brand-text mb-1">🔥</span>
            <span className="text-lg font-bold text-brand-text">{completions.length}</span>
            <span className="text-[9px] text-brand-text-muted uppercase font-bold">{t('Completados')}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
