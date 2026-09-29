import React, { useState } from 'react';
import { useTranslation } from "react-i18next";
import { 
  LogOut, Trophy, CheckSquare, Target, Settings, X, Trash2, 
  AlertTriangle, Calendar, ChevronLeft, ChevronRight, Flame, 
  Sparkles, Palette, Crown, Shield 
} from 'lucide-react';
import { User, Habit } from '../types';
import { getHabits, getAllTasks, getLocalDateString } from '../services/db';
import { SettingsView } from './SettingsView';
import { EditProfileModal } from '../components/EditProfileModal';
import { getAvatarFrame, getNameColor } from '../utils/profileCustomization';
import { signOutUser } from '../services/auth';
import { createPortal } from 'react-dom';

interface PerfilViewProps {
  user: User;
}

export const PerfilView: React.FC<PerfilViewProps> = ({ user: initialUser }) => {
  const { t } = useTranslation();
  const [currentUser, setCurrentUser] = useState<User>(initialUser);
  const [showSettings, setShowSettings] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());

  const handleLogout = async () => {
    await signOutUser();
    window.location.reload();
  };

  const handleDeleteAccount = async () => {
    await signOutUser();
    localStorage.clear();
    window.location.reload();
  };

  if (showSettings) {
    return (
      <SettingsView 
        user={currentUser}
        onBack={() => setShowSettings(false)}
        onLogout={handleLogout}
        onDeleteAccount={handleDeleteAccount}
      />
    );
  }

  const habits: Habit[] = getHabits().filter(h => h.user_id === currentUser.id && !h.archived);
  const tasks = getAllTasks().filter(t => t.user_id === currentUser.id);
  const completions = JSON.parse(localStorage.getItem('metis_completions') || '[]').filter((c: any) => c.user_id === currentUser.id);
  const completedTasksCount = tasks.filter(t => t.completed).length;

  const todayStr = getLocalDateString();
  const currentFrame = getAvatarFrame(currentUser.avatar_frame);
  const currentColor = getNameColor(currentUser.name_color);

  // Calendar logic
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  
  // Starting day of week: Monday is 0, Sunday is 6
  let startingDayOfWeek = firstDayOfMonth.getDay() - 1;
  if (startingDayOfWeek === -1) startingDayOfWeek = 6;

  const daysInMonth = lastDayOfMonth.getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const calendarDays: Array<{
    dayNum: number;
    dateStr: string;
    isCurrentMonth: boolean;
    isPerfect: boolean;
    isPartial: boolean;
    isFuture: boolean;
  }> = [];

  // Helper to check if a date is perfect
  const checkDayStatus = (dateStr: string) => {
    if (habits.length === 0) return { isPerfect: false, isPartial: false };
    const dateObj = new Date(dateStr + 'T12:00:00');
    const dayOfWeek = dateObj.getDay();

    const scheduledHabits = habits.filter(h => {
      const createdDate = getLocalDateString(new Date(h.created_at));
      if (dateStr < createdDate) return false;
      if (h.frequency === 'custom' && h.custom_days && h.custom_days.length > 0) {
        return h.custom_days.includes(dayOfWeek);
      }
      return true;
    });

    if (scheduledHabits.length === 0) return { isPerfect: false, isPartial: false };

    const dayComps = completions.filter((c: any) => c.date === dateStr && c.is_fully_completed !== false);
    const completedCount = scheduledHabits.filter(h => dayComps.some((c: any) => c.habit_id === h.id)).length;

    const isPerfect = completedCount === scheduledHabits.length && scheduledHabits.length > 0;
    const isPartial = completedCount > 0 && !isPerfect;

    return { isPerfect, isPartial };
  };

  // Previous month padding
  for (let i = startingDayOfWeek - 1; i >= 0; i--) {
    const dayNum = daysInPrevMonth - i;
    const prevMonthDate = new Date(year, month - 1, dayNum);
    const dStr = getLocalDateString(prevMonthDate);
    const status = checkDayStatus(dStr);
    calendarDays.push({
      dayNum,
      dateStr: dStr,
      isCurrentMonth: false,
      isPerfect: status.isPerfect,
      isPartial: status.isPartial,
      isFuture: dStr > todayStr
    });
  }

  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    const currDate = new Date(year, month, i);
    const dStr = getLocalDateString(currDate);
    const status = checkDayStatus(dStr);
    calendarDays.push({
      dayNum: i,
      dateStr: dStr,
      isCurrentMonth: true,
      isPerfect: status.isPerfect,
      isPartial: status.isPartial,
      isFuture: dStr > todayStr
    });
  }

  // Total Perfect Days across the challenge
  const allUniqueDates: string[] = Array.from(new Set(completions.map((c: any) => c.date as string)));
  const totalPerfectDaysCount = allUniqueDates.filter(dStr => checkDayStatus(dStr).isPerfect).length;

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  const monthLabel = `${monthNames[month]} ${year}`;

  return (
    <div className="min-w-full w-full flex-shrink-0 snap-center overflow-y-auto px-5 pt-4 pb-24 h-full relative">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-display font-extrabold text-brand-text tracking-tight mt-0.5">
            {t('Tu Perfil')}
          </h1>
          <p className="text-xs text-brand-text-muted mt-0.5">{t('Métricas y constancia del Winter Arc')}</p>
        </div>
        <button 
          onClick={() => setShowSettings(true)}
          className="p-2.5 bg-brand-card hover:bg-brand-card-sec border border-brand-border rounded-2xl text-brand-text transition-colors cursor-pointer"
          title={t('Ajustes')}
        >
          <Settings size={19} />
        </button>
      </div>

      {/* Main Profile Card with customizable avatar frame, name color, and title */}
      <div className="flex flex-col items-center justify-center p-5 bg-brand-card border border-brand-border rounded-3xl shadow-sm mb-5 relative overflow-hidden">
        {/* Glow ambient background based on frame */}
        <div className="w-24 h-24 rounded-full bg-brand-bg flex items-center justify-center mb-3 relative">
          <img 
            src={currentUser.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'} 
            alt={currentUser.name} 
            className={`w-20 h-20 rounded-full object-cover transition-all duration-300 ${currentFrame.borderClass} ${currentFrame.glowClass}`} 
          />
          <span className={`absolute -bottom-1 text-[10px] font-black px-2 py-0.5 rounded-full border border-black/50 shadow-md ${currentFrame.badgeColor || 'bg-brand-primary text-black'}`}>
            Nv. {currentUser.level || 1}
          </span>
        </div>

        {/* Name with customizable color */}
        <h2 className={`text-lg font-display font-extrabold tracking-tight text-center ${currentColor.textClass}`}>
          {currentUser.name}
        </h2>

        {/* Username & Title */}
        <div className="flex items-center space-x-2 mt-1 mb-1.5 flex-wrap justify-center">
          <span className="text-xs text-brand-text-muted font-medium">
            @{currentUser.username || currentUser.name.toLowerCase()}
          </span>
          {currentUser.title && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-brand-primary/10 text-brand-primary border border-brand-primary/25 flex items-center space-x-1">
              <Crown size={11} className="text-brand-primary" />
              <span>{currentUser.title}</span>
            </span>
          )}
        </div>

        <p className="text-xs font-semibold text-brand-primary mt-1 mb-3">
          Level {currentUser.level || 1} • {currentUser.xp || 0} XP
        </p>

        {/* Customize / Edit Profile Button */}
        <button 
          onClick={() => setShowEditProfile(true)}
          className="px-4 py-2 bg-brand-card-sec hover:bg-brand-border/60 border border-brand-border rounded-xl text-xs font-bold text-brand-text flex items-center space-x-1.5 transition-all active:scale-95 shadow-sm cursor-pointer"
        >
          <Sparkles size={14} className="text-brand-primary" />
          <span>{t('Personalizar Perfil')}</span>
        </button>
      </div>

      {/* Private Perfect Days Calendar */}
      <div className="bg-brand-card border border-brand-border rounded-3xl p-4 shadow-sm mb-5 text-left">
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-500">
              <Calendar size={14} />
            </div>
            <div>
              <h3 className="text-xs font-bold text-brand-text">{t('Historial de Días Perfectos')}</h3>
              <p className="text-[9px] text-brand-text-muted">{t('Tu constancia privada del Winter Arc')}</p>
            </div>
          </div>
          <div className="flex items-center space-x-1">
            <button onClick={handlePrevMonth} className="p-1 bg-brand-bg hover:bg-brand-card-sec rounded-lg text-brand-text-muted transition-colors cursor-pointer">
              <ChevronLeft size={13} />
            </button>
            <span className="text-[11px] font-bold text-brand-text px-1">{monthLabel}</span>
            <button onClick={handleNextMonth} className="p-1 bg-brand-bg hover:bg-brand-card-sec rounded-lg text-brand-text-muted transition-colors cursor-pointer">
              <ChevronRight size={13} />
            </button>
          </div>
        </div>

        {/* Counter Banner */}
        <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl p-2.5 flex items-center justify-between mb-3">
          <div className="flex items-center space-x-1.5">
            <Flame size={15} className="text-emerald-500 fill-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-brand-text">{t('Días Perfectos (100%)')}</span>
          </div>
          <span className="text-xs font-black text-emerald-500 bg-emerald-500/20 px-2.5 py-0.5 rounded-md border border-emerald-500/30">
            {totalPerfectDaysCount} {totalPerfectDaysCount === 1 ? t('día') : t('días')}
          </span>
        </div>

        {/* Days of week header */}
        <div className="grid grid-cols-7 gap-1 text-center text-[9px] font-bold text-brand-text-muted mb-1.5">
          <span>L</span><span>M</span><span>X</span><span>J</span><span>V</span><span>S</span><span>D</span>
        </div>

        {/* Grid of days */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day, idx) => (
            <div 
              key={idx}
              className={`aspect-square rounded-xl flex flex-col items-center justify-center text-[11px] font-bold transition-all relative ${
                !day.isCurrentMonth
                  ? 'opacity-20 text-brand-text-muted bg-transparent'
                  : day.isPerfect
                    ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.25)]'
                    : day.isPartial
                      ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
                      : day.isFuture
                        ? 'bg-brand-bg/40 text-brand-text-muted/50 border border-brand-border/20'
                        : 'bg-brand-bg text-brand-text-muted border border-brand-border/40'
              }`}
            >
              <span>{day.dayNum}</span>
              {day.isPerfect && (
                <span className="w-1 h-1 bg-emerald-400 rounded-full mt-0.5 shadow-[0_0_4px_#34d399]" />
              )}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center space-x-3 mt-3 pt-2.5 border-t border-brand-border/40 text-[9px] text-brand-text-muted">
          <div className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded bg-emerald-500/30 border border-emerald-500/60" />
            <span>100% Hábitos</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded bg-amber-500/20 border border-amber-500/40" />
            <span>Parcial</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded bg-brand-bg border border-brand-border" />
            <span>Sin completar</span>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 gap-2.5 mb-6">
        <div className="bg-brand-card p-3.5 rounded-2xl border border-brand-border flex flex-col items-center shadow-sm">
          <Trophy size={18} className="text-[#FFD700] mb-1.5" />
          <span className="text-xl font-black text-brand-text mb-0.5">{currentUser.xp}</span>
          <span className="text-[9px] text-brand-text-muted uppercase font-bold tracking-wider">{t('Experiencia')}</span>
        </div>
        <div className="bg-brand-card p-3.5 rounded-2xl border border-brand-border flex flex-col items-center shadow-sm">
          <CheckSquare size={18} className="text-brand-primary mb-1.5" />
          <span className="text-xl font-black text-brand-text mb-0.5">{completedTasksCount}</span>
          <span className="text-[9px] text-brand-text-muted uppercase font-bold tracking-wider">{t('Tareas')}</span>
        </div>
        <div className="bg-brand-card p-3.5 rounded-2xl border border-brand-border flex flex-col items-center shadow-sm">
          <Target size={18} className="text-blue-500 mb-1.5" />
          <span className="text-xl font-black text-brand-text mb-0.5">{habits.length}</span>
          <span className="text-[9px] text-brand-text-muted uppercase font-bold tracking-wider">{t('Hábitos Activos')}</span>
        </div>
        <div className="bg-brand-card p-3.5 rounded-2xl border border-brand-border flex flex-col items-center shadow-sm">
          <span className="text-lg mb-1 leading-none mt-0.5">🔥</span>
          <span className="text-xl font-black text-brand-text mb-0.5">{completions.length}</span>
          <span className="text-[9px] text-brand-text-muted uppercase font-bold tracking-wider">{t('Completados')}</span>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {showEditProfile && createPortal(
        <EditProfileModal 
          user={currentUser}
          onClose={() => setShowEditProfile(false)}
          onSaved={(updated) => {
            setCurrentUser(updated);
            setShowEditProfile(false);
          }}
        />,
        document.body
      )}
    </div>
  );
};
