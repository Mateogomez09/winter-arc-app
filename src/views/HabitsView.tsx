import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from "react-i18next";
import { 
  Plus, Edit2, Shield, X, Handshake, Flame, Circle, CheckCircle2,
  Droplets, BookOpen, PenLine, Sparkles, ShieldAlert, Footprints, Sun, HeartPulse 
} from 'lucide-react';
import { User, Habit } from '../types';
import { getHabits, completeHabit, uncompleteHabit, createHabit, updateHabit, getPacts, getPartnerCompletionStatus, refreshPactsFromSupabase, getLocalDateString } from '../services/db';
import { supabase } from '../lib/supabaseClient';
import { createPortal } from 'react-dom';
import { PactModal } from '../components/PactModal';
import { Pact } from '../types';

interface HabitsViewProps {
  user: User;
}

const DEFAULT_HABITS = ['Ejercicio físico 1 hora', 'Buena rutina de sueño', '30 mins aprendiendo algo'];
const LEGACY_DEFAULT_HABITS = ['Leer 10 páginas', 'Entrenar', 'Comer saludable', 'Levantarse pronto'];

interface HabitSuggestion {
  name: string;
  icon: any;
  color: string;
  desc: string;
}

const SUGGESTED_HABITS: HabitSuggestion[] = [
  {
    name: 'Beber 2.5L de agua',
    icon: Droplets,
    color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    desc: 'Edita los litros según tu objetivo'
  },
  {
    name: 'Leer mínimo 10 páginas',
    icon: BookOpen,
    color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
    desc: 'Lectura enfocada y nutrición mental'
  },
  {
    name: 'Escribir antes de dormir',
    icon: PenLine,
    color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    desc: 'Journaling, balance del día y claridad mental'
  },
  {
    name: 'Ducha de agua fría',
    icon: Sparkles,
    color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    desc: 'Disciplina de choque y resiliencia matutina'
  },
  {
    name: '0 alcohol y 0 comida basura',
    icon: ShieldAlert,
    color: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    desc: 'Nutrición limpia y control estricto de impulsos'
  },
  {
    name: 'Caminar 10.000 pasos',
    icon: Footprints,
    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    desc: 'Movimiento activo y oxigenación diaria'
  },
  {
    name: 'Planificar el día siguiente',
    icon: Sun,
    color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    desc: 'Organización la noche anterior antes de dormir'
  },
  {
    name: '10 min meditación o respiración',
    icon: HeartPulse,
    color: 'text-teal-400 bg-teal-500/10 border-teal-500/20',
    desc: 'Calma, presencia y reducción del estrés'
  }
];

export const HabitsView: React.FC<HabitsViewProps> = ({ user }) => {
  const { t } = useTranslation();
  const [localRefresh, setLocalRefresh] = useState(0);
  const [completions, setCompletions] = useState<any[]>([]);
  const [pacts, setPacts] = useState<Pact[]>(() => getPacts());
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [newHabitName, setNewHabitName] = useState('');
  
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [editName, setEditName] = useState('');
  
  const [selectedPactHabit, setSelectedPactHabit] = useState<string | null>(null);
  const [partnerStatusMap, setPartnerStatusMap] = useState<Record<string, boolean>>({});

  const todayStr = getLocalDateString();

  // Refresh user completions
  const refreshCompletions = useCallback(() => {
    try {
      const comps = JSON.parse(localStorage.getItem('metis_completions') || '[]');
      setCompletions(comps.filter((c: any) => c.user_id === user.id));
    } catch (e) {}
  }, [user.id]);

  // Auto-cleanup and sanitization for 6-habit rule (3 defaults + max 3 custom, strictly unique names)
  useEffect(() => {
    refreshCompletions();
    try {
      const allStoredHabits: Habit[] = JSON.parse(localStorage.getItem('metis_habits') || '[]');
      const userHabits = allStoredHabits.filter(h => h.user_id === user.id && !h.archived);
      
      let needsSave = false;
      const seenNames = new Set<string>();
      const uniqueUserHabits: Habit[] = [];
      const duplicateIdsToRemove: string[] = [];

      // 1. Group user habits by normalized name to eliminate duplicates and purge legacy defaults
      userHabits.forEach(h => {
        const norm = (h.name || '').trim().toLowerCase();
        const isLegacy = LEGACY_DEFAULT_HABITS.some(l => l.trim().toLowerCase() === norm);
        
        if (norm && !norm.includes('Ã') && !norm.includes('FÃ') && !isLegacy) {
          if (!seenNames.has(norm)) {
            seenNames.add(norm);
            uniqueUserHabits.push(h);
          } else {
            duplicateIdsToRemove.push(h.id);
          }
        } else {
          duplicateIdsToRemove.push(h.id);
        }
      });

      // 2. Ensure all 3 official defaults exist with pristine names
      DEFAULT_HABITS.forEach(defName => {
        const norm = defName.trim().toLowerCase();
        if (!seenNames.has(norm)) {
          const newHabit: Habit = {
            id: 'habit_' + Math.random().toString(36).substr(2, 9),
            user_id: user.id,
            goal_id: '',
            name: defName,
            frequency: 'daily',
            privacy: 'public',
            current_streak: 0,
            best_streak: 0,
            wildcard_available: true,
            archived: false,
            created_at: new Date().toISOString()
          };
          uniqueUserHabits.push(newHabit);
          seenNames.add(norm);
          needsSave = true;
        }
      });

      // 3. Separate defaults and custom habits (strictly max 3 customs)
      const validDefaults = uniqueUserHabits.filter(h => DEFAULT_HABITS.some(d => d.trim().toLowerCase() === h.name.trim().toLowerCase()));
      const validCustoms = uniqueUserHabits.filter(h => !DEFAULT_HABITS.some(d => d.trim().toLowerCase() === h.name.trim().toLowerCase()));
      const allowedCustoms = validCustoms.slice(0, 3);

      // Collect extraneous custom habits to remove
      validCustoms.slice(3).forEach(extra => duplicateIdsToRemove.push(extra.id));

      const finalUserHabits = [...validDefaults, ...allowedCustoms];
      const otherUsersHabits = allStoredHabits.filter(h => h.user_id !== user.id);

      if (duplicateIdsToRemove.length > 0 || needsSave || userHabits.length !== finalUserHabits.length) {
        localStorage.setItem('metis_habits', JSON.stringify([...otherUsersHabits, ...finalUserHabits]));
        setLocalRefresh(prev => prev + 1);

        if (duplicateIdsToRemove.length > 0) {
          supabase.from('habits').delete().in('id', duplicateIdsToRemove).then();
        }
      }

      // Always ensure the user's habits exist in Supabase so foreign key constraints on completions never fail
      if (finalUserHabits.length > 0) {
        const sanitized = finalUserHabits.map(h => ({
          id: h.id,
          user_id: user.id,
          name: h.name,
          frequency: h.frequency || 'daily',
          current_streak: h.current_streak || 0,
          best_streak: h.best_streak || 0,
          wildcard_available: h.wildcard_available ?? true,
          archived: false,
          created_at: h.created_at || new Date().toISOString()
        }));
        supabase.from('habits').upsert(sanitized).then();
      }
    } catch (e) {}
  }, [user.id, refreshCompletions]);

  // Sync partner status
  const syncPartnerStatus = useCallback(() => {
    refreshPactsFromSupabase(user.id).then(activePacts => {
      setPacts(activePacts);
      activePacts.forEach(p => {
        if (p.status === 'active' && (p.creator_id === user.id || p.partner_id === user.id)) {
          const partnerId = p.creator_id === user.id ? p.partner_id : p.creator_id;
          if (partnerId) {
            getPartnerCompletionStatus(partnerId, p.habit_name, todayStr).then(isCompleted => {
              setPartnerStatusMap(prev => ({ ...prev, [p.habit_name.trim().toLowerCase()]: isCompleted }));
            });
          }
        }
      });
    });
  }, [user.id, todayStr]);

  // Sync on mount, focus, and Supabase Realtime WebSockets
  useEffect(() => {
    syncPartnerStatus();
    refreshCompletions();

    // 1. User-scoped Supabase Realtime subscription (Prevents global broadcast storms)
    const channel = supabase
      .channel(`pacts_sync_${user.id}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'pacts',
        filter: `creator_id=eq.${user.id}`
      }, () => syncPartnerStatus())
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'pacts',
        filter: `partner_id=eq.${user.id}`
      }, () => syncPartnerStatus())
      .subscribe();

    // 2. Sync on app focus / screen unlock
    const onFocus = () => {
      syncPartnerStatus();
      refreshCompletions();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);

    // 3. Relaxed passive fallback (every 60s instead of aggressive 4s polling)
    const interval = setInterval(() => {
      syncPartnerStatus();
      refreshCompletions();
    }, 60000);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
      clearInterval(interval);
    };
  }, [syncPartnerStatus, refreshCompletions]);

  const rawHabits = getHabits(user.id).filter(h => h.user_id === user.id && !h.archived);
  const seenHabitNames = new Set<string>();
  const allHabits: Habit[] = [];
  for (const h of rawHabits) {
    const norm = (h.name || '').trim().toLowerCase();
    if (norm && !seenHabitNames.has(norm)) {
      seenHabitNames.add(norm);
      allHabits.push(h);
    }
  }

  const handleToggleHabit = (habitId: string) => {
    const isCompleted = completions.some(c => c.user_id === user.id && c.habit_id === habitId && c.date === todayStr && c.is_fully_completed !== false);
    
    if (isCompleted) {
      uncompleteHabit(habitId, todayStr, user.id);
    } else {
      completeHabit(habitId, '', user.id);
    }
    refreshCompletions();
    setLocalRefresh(prev => prev + 1);
    syncPartnerStatus();
  };

  const handleAddCustomHabit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHabitName.trim()) return;
    const created = createHabit(newHabitName.trim(), '', 'daily', 'public');
    if (created) {
      supabase.from('habits').upsert([{
        id: created.id,
        user_id: user.id,
        name: created.name,
        frequency: created.frequency || 'daily',
        current_streak: 0,
        best_streak: 0,
        wildcard_available: true,
        archived: false,
        created_at: created.created_at
      }]).then();
    }
    setNewHabitName('');
    setShowAddModal(false);
    refreshCompletions();
    setLocalRefresh(prev => prev + 1);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingHabit && editName.trim()) {
      updateHabit(editingHabit.id, { name: editName.trim() });
      setEditingHabit(null);
      refreshCompletions();
      setLocalRefresh(prev => prev + 1);
    }
  };

  // Group into Pending and Completed strictly scoped to user.id
  const pendingHabits = allHabits.filter(h => !completions.some(c => c.user_id === user.id && c.habit_id === h.id && c.date === todayStr && c.is_fully_completed !== false));
  const completedHabits = allHabits.filter(h => completions.some(c => c.user_id === user.id && c.habit_id === h.id && c.date === todayStr && c.is_fully_completed !== false));

  // Count custom habits to determine remaining slots (max 3 custom habits)
  const customHabitsCount = allHabits.filter(h => !DEFAULT_HABITS.includes(h.name)).length;
  const emptySlots = Math.max(0, 3 - customHabitsCount);

  const renderHabit = (habit: Habit, isCompleted: boolean) => {
    const isDefault = DEFAULT_HABITS.includes(habit.name);
    const activePact = pacts.find(p => p.habit_name.trim().toLowerCase() === habit.name.trim().toLowerCase() && p.status === 'active' && (p.creator_id === user.id || p.partner_id === user.id));
    const pendingPact = pacts.find(p => p.habit_name.trim().toLowerCase() === habit.name.trim().toLowerCase() && p.status === 'pending' && p.creator_id === user.id);
    const isPartnerDoneToday = partnerStatusMap[habit.name.trim().toLowerCase()];

    return (
      <div 
        key={habit.id} 
        className={`relative bg-brand-card border rounded-2xl p-4 transition-all mb-3 ${
          isCompleted 
            ? 'border-brand-primary/30 bg-brand-primary/5 shadow-sm opacity-85' 
            : activePact 
              ? 'border-amber-500/60 shadow-[0_0_12px_rgba(245,158,11,0.18)]' 
              : 'border-brand-border shadow-sm'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 flex-1 cursor-pointer" onClick={() => handleToggleHabit(habit.id)}>
            <div className={`shrink-0 flex items-center justify-center transition-all ${isCompleted ? 'text-brand-primary scale-110' : activePact ? 'text-amber-500' : 'text-brand-text-muted hover:text-brand-primary'}`}>
              {isCompleted ? <CheckCircle2 size={24} strokeWidth={2.5} /> : <Circle size={24} />}
            </div>
            
            <div className="flex-1">
              <p className={`font-medium text-sm leading-tight ${isCompleted ? 'text-brand-text-muted line-through' : 'text-brand-text'}`}>
                {habit.name}
              </p>
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center ${isCompleted ? 'text-brand-primary bg-brand-primary/10' : activePact ? 'text-amber-500 bg-amber-500/10' : 'text-brand-primary bg-brand-primary/10'}`}>
                  <Flame size={10} className="mr-1"/> {habit.current_streak} {habit.current_streak === 1 ? t('día') : t('días')}
                </span>
                {habit.wildcard_available && (
                  <span className="text-[10px] font-bold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-full flex items-center">
                    <Shield size={10} className="mr-1"/> {t('Escudo')}
                  </span>
                )}
                {activePact && (
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center transition-all ${
                    isPartnerDoneToday 
                      ? 'text-emerald-500 bg-emerald-500/15 border border-emerald-500/30' 
                      : 'text-amber-500/90 bg-amber-500/10 border border-amber-500/20'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${isPartnerDoneToday ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500/70'}`} />
                    {isPartnerDoneToday ? t('Compañero al día') : t('Compañero pendiente')}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-1 pl-2">
            {/* The pact button is styled with a distinct purple bordered badge indicating it is interactive */}
            <button 
              type="button"
              onClick={(e) => { e.stopPropagation(); setSelectedPactHabit(habit.name); }}
              className={`px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer flex items-center space-x-1.5 active:scale-95 shadow-sm ${
                activePact 
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-400 hover:bg-amber-500/25 shadow-[0_0_8px_rgba(245,158,11,0.2)]' 
                  : pendingPact 
                    ? 'bg-purple-600/20 border-purple-500/50 text-purple-300 animate-pulse'
                    : 'bg-purple-500/10 border-purple-500/30 text-purple-400 hover:bg-purple-500/20 hover:border-purple-500/50 hover:text-purple-300'
              }`}
              title={activePact ? t('Pacto Activo') : t('Crear o Unirte a un Pacto')}
            >
              <Handshake size={15} />
              <span className="text-[10px] font-bold uppercase tracking-wider">
                {t('Pacto')}
              </span>
            </button>
            
            {!isDefault && !isCompleted && (
              <button 
                type="button"
                onClick={(e) => { e.stopPropagation(); setEditingHabit(habit); setEditName(habit.name); }} 
                className="p-2 text-brand-text-muted hover:text-brand-primary hover:bg-brand-primary/5 rounded-xl transition-colors cursor-pointer"
                title={t('Editar')}
              >
                <Edit2 size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-w-full w-full flex-shrink-0 snap-center overflow-y-auto px-5 pt-7 pb-24 h-full relative">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-extrabold text-brand-text tracking-tight mt-0.5">
            {t('Tus Hábitos')}
          </h1>
          <p className="text-xs text-brand-text-muted mt-1">{t('Mantén el Winter Arc vivo')}</p>
        </div>
      </div>

      <div className="space-y-1 mb-8">
        {pendingHabits.length > 0 && (
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-brand-text-muted px-1 mb-3">{t('PENDIENTES')}</h3>
        )}
        
        {pendingHabits.map(h => renderHabit(h, false))}

        {/* Empty slots for customizable habits */}
        {Array.from({ length: emptySlots }).map((_, i) => (
          <div 
            key={i} 
            onClick={() => setShowAddModal(true)} 
            className="border-2 border-dashed border-brand-primary/30 bg-brand-primary/5 hover:bg-brand-primary/10 rounded-2xl p-4 flex items-center justify-center text-brand-primary cursor-pointer transition-all active:scale-[0.98] mb-3 h-[72px]"
          >
            <span className="text-xs font-bold uppercase tracking-wider flex items-center">
              <Plus size={16} className="mr-2" />
              {t('Añadir hábito personal')}
            </span>
          </div>
        ))}
      </div>

      {completedHabits.length > 0 && (
        <div className="space-y-1 mt-6">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-brand-primary px-1 mb-3">{t('COMPLETADOS')}</h3>
          {completedHabits.map(h => renderHabit(h, true))}
        </div>
      )}

      {showAddModal && createPortal(
        <div className="fixed inset-0 bg-brand-bg/80 z-[300] flex items-center justify-center p-4 animate-overlay-fade-in backdrop-blur-md" onClick={() => setShowAddModal(false)}>
          <div className="w-full max-w-md max-h-[90vh] bg-brand-modal border border-brand-border rounded-3xl p-5 sm:p-6 shadow-2xl relative flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            
            {/* Modal Header */}
            <div className="flex justify-between items-center pb-3 border-b border-brand-border/50 flex-shrink-0">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-brand-text flex items-center space-x-2">
                  <Sparkles size={18} className="text-brand-primary" />
                  <span>{t('Añadir Hábito Personal')}</span>
                </h2>
                <p className="text-[11px] text-brand-text-muted mt-0.5">
                  {t('Elige una sugerencia o escribe tu propio objetivo a medida')}
                </p>
              </div>
              <button 
                type="button" 
                onClick={() => setShowAddModal(false)} 
                className="p-1.5 rounded-full bg-brand-card hover:bg-brand-card-sec text-brand-text-muted hover:text-brand-text transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Form & Suggestions */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1 hide-scrollbar">
              
              {/* Custom Input */}
              <form onSubmit={handleAddCustomHabit} id="add-habit-form" className="space-y-2">
                <label className="text-[11px] font-extrabold uppercase tracking-wider text-brand-text-muted px-1 block">
                  {t('Nombre del hábito')}
                </label>
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder={t('Ej: Beber 3L de agua, Estudiar 1h...')}
                    className="w-full bg-brand-bg border border-brand-border focus:border-brand-primary text-brand-text rounded-2xl px-4 py-3.5 text-sm focus:outline-none transition-all pr-9 shadow-inner"
                    value={newHabitName}
                    onChange={e => setNewHabitName(e.target.value)}
                  />
                  {newHabitName && (
                    <button 
                      type="button" 
                      onClick={() => setNewHabitName('')} 
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-text-muted hover:text-brand-text p-1 cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-brand-text-muted px-1">
                  {t('💡 Puedes tocar una sugerencia inferior para autocompletar y ajustar tus propios números (litros, páginas, etc.).')}
                </p>
              </form>

              {/* Suggestions Section */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-brand-text-muted">
                    {t('Sugerencias Populares')}
                  </span>
                  <span className="text-[10px] text-brand-primary font-bold">
                    {SUGGESTED_HABITS.length} ideas
                  </span>
                </div>

                <div className="space-y-2">
                  {SUGGESTED_HABITS.map((sug, idx) => {
                    const IconComponent = sug.icon;
                    const isSelected = newHabitName.trim().toLowerCase() === sug.name.toLowerCase();

                    return (
                      <div
                        key={idx}
                        onClick={() => setNewHabitName(sug.name)}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center space-x-3 active:scale-[0.99] ${
                          isSelected
                            ? 'bg-brand-primary/15 border-brand-primary shadow-[0_0_15px_rgba(122,141,255,0.2)]'
                            : 'bg-brand-card hover:bg-brand-card-sec border-brand-border'
                        }`}
                      >
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border ${sug.color}`}>
                          <IconComponent size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-bold truncate ${isSelected ? 'text-brand-primary' : 'text-brand-text'}`}>
                            {sug.name}
                          </p>
                          <p className="text-[10px] text-brand-text-muted truncate mt-0.5">
                            {sug.desc}
                          </p>
                        </div>
                        <div className="flex-shrink-0 pl-1">
                          {isSelected ? (
                            <CheckCircle2 size={16} className="text-brand-primary" />
                          ) : (
                            <Plus size={16} className="text-brand-text-muted hover:text-brand-text" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Bottom Modal CTA */}
            <div className="pt-3 border-t border-brand-border/50 flex-shrink-0">
              <button 
                type="submit" 
                form="add-habit-form"
                disabled={!newHabitName.trim()} 
                className="w-full py-3.5 bg-brand-primary text-black rounded-2xl font-bold text-xs uppercase tracking-wider disabled:opacity-40 transition-all cursor-pointer shadow-[0_0_15px_rgba(122,141,255,0.3)] hover:bg-brand-primary-active active:scale-[0.98] flex items-center justify-center space-x-2"
              >
                <Plus size={16} className="stroke-[3]" />
                <span>{t('Añadir a mi Winter Arc')}</span>
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}

      {editingHabit && createPortal(
        <div className="fixed inset-0 bg-brand-bg/70 z-[300] flex items-center justify-center p-4 animate-overlay-fade-in backdrop-blur-sm" onClick={() => setEditingHabit(null)}>
          <div className="w-full max-w-sm bg-brand-modal border border-brand-border rounded-3xl p-6 shadow-2xl relative" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-brand-text">{t('Editar Hábito')}</h2>
              <button type="button" onClick={() => setEditingHabit(null)} className="text-brand-text-muted hover:text-brand-text p-1 cursor-pointer"><X size={20}/></button>
            </div>
            <form onSubmit={handleSaveEdit}>
              <input 
                autoFocus
                type="text" 
                className="w-full bg-brand-bg border border-brand-border text-brand-text rounded-xl px-4 py-3 text-sm mb-4 focus:outline-none focus:border-brand-primary"
                value={editName}
                onChange={e => setEditName(e.target.value)}
              />
              <button type="submit" disabled={!editName.trim()} className="w-full py-3.5 bg-brand-primary text-white rounded-xl font-bold disabled:opacity-50 transition-colors cursor-pointer shadow-[0_0_15px_rgba(var(--color-primary-rgb),0.3)]">
                {t('Guardar Cambios')}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {selectedPactHabit && (
        <PactModal 
          habitName={selectedPactHabit} 
          user={user} 
          onClose={() => setSelectedPactHabit(null)} 
          onPactUpdated={() => setLocalRefresh(prev => prev + 1)} 
        />
      )}
    </div>
  );
};
