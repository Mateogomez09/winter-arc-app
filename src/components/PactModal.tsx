import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from "react-i18next";
import { X, Copy, Check, Handshake, Users, Flame, Trash2, Loader2, AlertTriangle, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import { Pact, User } from '../types';
import { createPact, joinPact, getPacts, getAllUsers, cancelPact, refreshPactsFromSupabase, getPartnerCompletionStatus, getHabits, getLocalDateString, calculatePactStreak, getPactTierDetails } from '../services/db';
import { supabase } from '../lib/supabaseClient';

interface PactModalProps {
  habitName: string;
  user: User;
  onClose: () => void;
  onPactUpdated: () => void;
}

export const PactModal: React.FC<PactModalProps> = ({ habitName, user, onClose, onPactUpdated }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'info' | 'create' | 'join'>('info');
  const [targetDays] = useState(7);
  const [joinCode, setJoinCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [justCreated, setJustCreated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showDissolveConfirm, setShowDissolveConfirm] = useState(false);
  const [showTiersTable, setShowTiersTable] = useState(false);
  
  const [localPacts, setLocalPacts] = useState<Pact[]>(() => getPacts());
  const [partnerInfo, setPartnerInfo] = useState<{ name: string; avatar_url: string; level?: number } | null>(null);
  const [partnerCompletedToday, setPartnerCompletedToday] = useState(false);
  const [userCompletedToday, setUserCompletedToday] = useState(false);
  const [sharedStreak, setSharedStreak] = useState(0);

  const todayStr = getLocalDateString();

  // Real-time updates while the modal is open
  useEffect(() => {
    let isMounted = true;

    const syncPacts = async () => {
      const refreshed = await refreshPactsFromSupabase(user.id);
      if (isMounted) {
        setLocalPacts(refreshed);
      }
    };

    syncPacts();

    // 1. Supabase Realtime subscription
    const channel = supabase
      .channel('public:pacts_modal_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pacts' }, () => {
        syncPacts();
      })
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [user.id]);

  const myPacts = localPacts.filter(p => 
    (p.creator_id === user.id || p.partner_id === user.id) && 
    p.habit_name.trim().toLowerCase() === habitName.trim().toLowerCase() && 
    p.status !== 'failed' && 
    p.status !== 'completed' &&
    p.status !== 'dissolved' &&
    p.status !== 'cancelled'
  );
  const activePact = myPacts[0];

  // Check today's completion status for both users
  useEffect(() => {
    const myHabits = getHabits(user.id).filter(h => h.user_id === user.id);
    const currentHabit = myHabits.find(h => h.name.trim().toLowerCase() === habitName.trim().toLowerCase());
    const completions = JSON.parse(localStorage.getItem('metis_completions') || '[]');
    const isMeDone = completions.some((c: any) => c.user_id === user.id && c.habit_id === currentHabit?.id && c.date === todayStr && c.is_fully_completed !== false);
    setUserCompletedToday(isMeDone);

    if (!activePact || activePact.status !== 'active') {
      setPartnerInfo(null);
      setPartnerCompletedToday(false);
      return;
    }

    const partnerId = activePact.creator_id === user.id ? activePact.partner_id : activePact.creator_id;
    if (!partnerId) return;

    // Check partner completion
    getPartnerCompletionStatus(partnerId, habitName, todayStr).then(isPartnerDone => {
      setPartnerCompletedToday(isPartnerDone);
    });

    // Calculate dynamic shared streak
    calculatePactStreak(activePact).then(st => {
      setSharedStreak(st);
    });

    // 1. Check local cache first
    const localUser = getAllUsers().find(u => u.id === partnerId);
    if (localUser) {
      setPartnerInfo({
        name: localUser.name,
        avatar_url: localUser.avatar_url || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
        level: localUser.level
      });
      return;
    }

    // 2. Fetch from Supabase
    supabase.from('users').select('name, avatar_url, level').eq('id', partnerId).maybeSingle().then(({ data }) => {
      if (data) {
        setPartnerInfo({
          name: data.name || 'Compañero',
          avatar_url: data.avatar_url || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
          level: data.level || 1
        });
      } else {
        setPartnerInfo({
          name: 'Compañero',
          avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80'
        });
      }
    });
  }, [activePact, user.id, habitName, todayStr]);

  const handleCreate = async () => {
    setIsLoading(true);
    try {
      const code = await createPact(habitName, targetDays);
      setGeneratedCode(code);
      setActiveTab('create');
      setJustCreated(true);
      setLocalPacts(getPacts());
      onPactUpdated();
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!joinCode.trim()) return;
    
    setIsLoading(true);
    try {
      const res = await joinPact(joinCode.trim(), habitName);
      if (res.success) {
        setLocalPacts(getPacts());
        onPactUpdated();
        onClose();
      } else {
        setErrorMsg(res.message || t('Error al unirse al pacto'));
      }
    } catch (e) {
      setErrorMsg(t('Error de conexión con el servidor.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDissolvePact = async (pactId: string) => {
    setIsLoading(true);
    try {
      await cancelPact(pactId);
      setLocalPacts(getPacts());
      onPactUpdated();
      setShowDissolveConfirm(false);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const safeCopy = (text: string) => {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
      } else {
        fallbackCopy(text);
      }
    } catch (e) {
      fallbackCopy(text);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fallbackCopy = (text: string) => {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    } catch (e) {}
  };

  const copyToClipboard = () => {
    safeCopy(generatedCode);
  };

  const renderActivePact = (pact: Pact) => {
    const isPactActive = pact.status === 'active';
    const streak = Math.max(sharedStreak, (userCompletedToday && partnerCompletedToday ? 1 : pact.current_streak || 0));
    const tierDetails = getPactTierDetails(streak);

    return (
      <div className="flex flex-col items-center justify-center p-1">
        <h3 className="text-xl font-bold text-brand-text mb-4 text-center">
          {isPactActive ? t('Pacto Activo') : t('Pacto Pendiente')}
        </h3>
        
        <div className="flex items-center justify-center space-x-5 mb-5">
          <div className="flex flex-col items-center">
            <div className="relative">
              <img 
                src={user.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'} 
                className={`w-14 h-14 rounded-full border-2 object-cover shadow-lg ${userCompletedToday ? 'border-emerald-500 ring-4 ring-emerald-500/20' : 'border-brand-primary ring-2 ring-brand-primary/20'}`} 
                alt="" 
              />
            </div>
            <span className="text-xs font-bold mt-1.5 text-brand-text">{t('Tú')}</span>
            {isPactActive && (
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1 flex items-center ${userCompletedToday ? 'text-emerald-500 bg-emerald-500/15 border border-emerald-500/30' : 'text-amber-500/90 bg-amber-500/10 border border-amber-500/20'}`}>
                <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${userCompletedToday ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500/70'}`} />
                {userCompletedToday ? t('Al día') : t('Pendiente')}
              </span>
            )}
          </div>
          
          <div className="flex flex-col items-center px-1">
            <Flame size={28} className={`${isPactActive ? 'text-amber-500 animate-pulse' : 'text-brand-text-muted'}`} />
            <span className={`text-[9px] font-bold uppercase tracking-wider mt-1 ${isPactActive ? 'text-amber-500' : 'text-brand-text-muted'}`}>
              {isPactActive ? t('Vinculados') : t('Esperando...')}
            </span>
          </div>
          
          <div className="flex flex-col items-center">
            {isPactActive ? (
              <>
                <div className="relative">
                  <img 
                    src={partnerInfo?.avatar_url || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80'} 
                    className={`w-14 h-14 rounded-full border-2 object-cover shadow-lg ${partnerCompletedToday ? 'border-emerald-500 ring-4 ring-emerald-500/20' : 'border-amber-500 ring-2 ring-amber-500/20'}`} 
                    alt="" 
                  />
                </div>
                <span className="text-xs font-bold mt-1.5 text-brand-text max-w-[80px] truncate text-center">
                  {partnerInfo?.name || t('Compañero')}
                </span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1 flex items-center ${partnerCompletedToday ? 'text-emerald-500 bg-emerald-500/15 border border-emerald-500/30' : 'text-amber-500/90 bg-amber-500/10 border border-amber-500/20'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${partnerCompletedToday ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500/70'}`} />
                  {partnerCompletedToday ? t('Al día') : t('Pendiente')}
                </span>
              </>
            ) : (
              <>
                <div className="w-14 h-14 rounded-full border-2 border-dashed border-brand-border flex items-center justify-center bg-brand-bg/50">
                  <Users size={20} className="text-brand-text-muted" />
                </div>
                <span className="text-xs font-bold mt-1.5 text-brand-text-muted">{t('Vacante')}</span>
              </>
            )}
          </div>
        </div>
        
        {!isPactActive && pact.status === 'pending' && (
          <div className="bg-brand-bg rounded-2xl p-4 w-full text-center border border-brand-border mb-4">
            <p className="text-xs text-brand-text-muted mb-2">{t('Pásale este código a tu compañero:')}</p>
            <div className="flex items-center justify-center space-x-2">
              <span className="text-2xl font-mono font-black tracking-widest text-brand-primary">{pact.code}</span>
              <button 
                type="button"
                onClick={() => safeCopy(pact.code)} 
                className="p-2 bg-brand-card rounded-lg text-brand-text hover:text-brand-primary transition-colors cursor-pointer"
              >
                {copied ? <Check size={18} className="text-brand-green" /> : <Copy size={18} />}
              </button>
            </div>
          </div>
        )}
        
        {isPactActive && (
          <div className="bg-brand-bg/60 border border-brand-border rounded-2xl p-3.5 w-full mb-4 space-y-2.5">
            <div className="text-center">
              <p className="text-sm font-bold text-brand-text">
                🔥 {t('Racha Compartida')}: <span className="text-amber-500 font-extrabold">{streak} / {tierDetails.currentMilestone}</span> {t('días')}
              </p>
              <div className="w-full bg-brand-card h-2 rounded-full overflow-hidden border border-brand-border/40 mt-2 mb-1.5">
                <div 
                  className="bg-gradient-to-r from-amber-500 to-amber-400 h-full rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                  style={{ width: `${Math.min(100, Math.max(8, (streak / tierDetails.currentMilestone) * 100))}%` }}
                />
              </div>
              <p className="text-[11px] text-brand-text-muted leading-tight">
                {userCompletedToday && partnerCompletedToday && t('Ambos habéis completado vuestra parte hoy. Racha asegurada.')}
                {userCompletedToday && !partnerCompletedToday && t('Has completado tu parte. Esperando a tu compañero.')}
                {!userCompletedToday && partnerCompletedToday && t('Tu compañero ya ha completado. Falta tu confirmación.')}
                {!userCompletedToday && !partnerCompletedToday && t('Ninguno ha completado todavía la jornada de hoy.')}
              </p>
            </div>

            {/* Multi-tier Escalating Bonus Card */}
            <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl p-2.5 text-left">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                  <Zap size={14} className="text-amber-500 fill-amber-500 animate-pulse" />
                  <span className="text-xs font-bold text-brand-text">{t('Bonus actual:')}</span>
                </div>
                <span className="text-xs font-black text-amber-500 bg-amber-500/15 px-2 py-0.5 rounded-md border border-amber-500/30">
                  +{tierDetails.currentBonus} XP extra / día
                </span>
              </div>
              {!tierDetails.isMaxTier && (
                <p className="text-[10px] text-brand-text-muted mt-1.5 flex items-center justify-between">
                  <span>{t('Próximo hito')} (Día {tierDetails.currentMilestone + 1}):</span>
                  <span className="font-bold text-brand-primary">+{tierDetails.nextBonus} XP extra</span>
                </p>
              )}
            </div>

            {/* Collapsible Roadmap */}
            <button
              type="button"
              onClick={() => setShowTiersTable(!showTiersTable)}
              className="w-full flex items-center justify-between text-[11px] font-bold text-brand-text-muted hover:text-brand-text transition-colors py-1 px-1 cursor-pointer"
            >
              <span>{t('Escala de Recompensas')}</span>
              {showTiersTable ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showTiersTable && (
              <div className="text-[10px] bg-brand-card/90 rounded-xl p-2.5 border border-brand-border/60 space-y-1 animate-fade-in-up">
                <div className="flex justify-between font-semibold text-brand-text pb-1 border-b border-brand-border/40">
                  <span>Días de Racha</span>
                  <span>Bonus / Día</span>
                </div>
                <div className={`flex justify-between ${streak <= 7 ? 'text-amber-500 font-bold' : 'text-brand-text-muted'}`}>
                  <span>Días 1 - 7</span>
                  <span>+2 XP extra</span>
                </div>
                <div className={`flex justify-between ${streak >= 8 && streak <= 14 ? 'text-amber-500 font-bold' : 'text-brand-text-muted'}`}>
                  <span>Días 8 - 14</span>
                  <span>+4 XP extra</span>
                </div>
                <div className={`flex justify-between ${streak >= 15 && streak <= 21 ? 'text-amber-500 font-bold' : 'text-brand-text-muted'}`}>
                  <span>Días 15 - 21</span>
                  <span>+6 XP extra</span>
                </div>
                <div className={`flex justify-between ${streak >= 22 && streak <= 30 ? 'text-amber-500 font-bold' : 'text-brand-text-muted'}`}>
                  <span>Días 22 - 30</span>
                  <span>+10 XP extra</span>
                </div>
                <div className={`flex justify-between ${streak >= 31 && streak <= 60 ? 'text-amber-500 font-bold' : 'text-brand-text-muted'}`}>
                  <span>Días 31 - 60</span>
                  <span>+20 XP extra</span>
                </div>
                <div className={`flex justify-between ${streak > 60 ? 'text-amber-500 font-bold' : 'text-brand-text-muted'}`}>
                  <span>Días 60+ (Final)</span>
                  <span>+30 XP extra</span>
                </div>
                <div className="pt-1.5 border-t border-brand-border/40 text-[9px] text-brand-red font-medium leading-tight">
                  ⚠️ Si uno falla el hábito: -2 XP y la racha compartida se reinicia a 0.
                </div>
              </div>
            )}
          </div>
        )}
        
        <div className="w-full space-y-2">
          <button 
            type="button"
            onClick={onClose} 
            className="w-full py-3 bg-brand-primary text-white rounded-xl font-bold transition-all shadow-[0_0_15px_rgba(var(--color-primary-rgb),0.3)] cursor-pointer"
          >
            {t('Cerrar')}
          </button>

          <button 
            type="button"
            onClick={() => setShowDissolveConfirm(true)} 
            className="w-full py-2 text-xs text-brand-red font-medium hover:bg-brand-red/10 rounded-xl transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
          >
            <Trash2 size={14} />
            <span>{isPactActive ? t('Disolver pacto') : t('Cancelar pacto')}</span>
          </button>
        </div>
      </div>
    );
  };

  return createPortal(
    <div 
      className="fixed inset-0 bg-brand-bg/70 z-[300] flex items-center justify-center p-4 animate-overlay-fade-in backdrop-blur-sm" 
      onClick={onClose}
    >
      <div 
        className="w-full max-w-sm bg-brand-modal border border-brand-border rounded-3xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto" 
        onClick={e => e.stopPropagation()}
      >
        <button 
          type="button"
          onClick={onClose} 
          className="absolute top-4 right-4 p-2 bg-brand-card hover:bg-brand-card-sec rounded-full text-brand-text-muted transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>
        
        {activePact && !justCreated ? (
          renderActivePact(activePact)
        ) : (
          <>
            <div className="text-center mb-5 pt-1">
              <div className="w-12 h-12 rounded-full bg-brand-primary/10 flex items-center justify-center mx-auto mb-2.5">
                <Handshake size={24} className="text-brand-primary" />
              </div>
              <h2 className="text-xl font-bold text-brand-text mb-1">
                {t('Pacto para')} <span className="text-brand-primary">{habitName}</span>
              </h2>
              <p className="text-xs text-brand-text-muted leading-relaxed">
                {t('Une tu racha a un compañero durante el Winter Arc. Recompensas progresivas (+2 a +30 XP extra diario).')}
              </p>
            </div>
            
            {activeTab === 'info' && (
              <div className="space-y-3">
                <button 
                  type="button"
                  onClick={handleCreate} 
                  disabled={isLoading}
                  className="w-full py-3.5 bg-brand-primary text-white rounded-xl font-bold hover:bg-brand-primary/90 transition-all shadow-[0_0_15px_rgba(var(--color-primary-rgb),0.3)] cursor-pointer flex items-center justify-center"
                >
                  {isLoading ? <Loader2 className="animate-spin" size={20} /> : t('Crear Código')}
                </button>
                <button 
                  type="button"
                  onClick={() => setActiveTab('join')} 
                  className="w-full py-3.5 bg-brand-card border border-brand-border text-brand-text rounded-xl font-bold hover:bg-brand-card-sec transition-all cursor-pointer"
                >
                  {t('Unirse con Código')}
                </button>
              </div>
            )}
            
            {activeTab === 'create' && (
              <div className="text-center animate-fade-in-up">
                <p className="text-sm font-bold text-brand-text mb-2">{t('Código generado:')}</p>
                <div className="bg-brand-bg border border-brand-border rounded-xl p-4 mb-4 flex items-center justify-between">
                  <span className="text-2xl font-mono tracking-widest text-brand-primary font-black ml-2">{generatedCode}</span>
                  <button 
                    type="button"
                    onClick={copyToClipboard} 
                    className="p-2 bg-brand-card rounded-lg text-brand-text hover:text-brand-primary transition-colors cursor-pointer"
                  >
                    {copied ? <Check size={20} className="text-brand-green" /> : <Copy size={20} />}
                  </button>
                </div>
                <p className="text-xs text-brand-text-muted mb-6">{t('Pásale este código a tu amigo para que lo introduzca en su app.')}</p>
                <button 
                  type="button"
                  onClick={onClose} 
                  className="w-full py-3.5 bg-brand-primary text-white rounded-xl font-bold transition-all shadow-[0_0_15px_rgba(var(--color-primary-rgb),0.3)] cursor-pointer"
                >
                  {t('Listo')}
                </button>
              </div>
            )}
            
            {activeTab === 'join' && (
              <form onSubmit={handleJoin} className="animate-fade-in-up">
                <p className="text-sm font-bold text-brand-text mb-2 text-center">{t('Introduce el código:')}</p>
                <input 
                  type="text" 
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="ej. A7X9"
                  className="w-full bg-brand-bg border border-brand-border text-brand-text rounded-xl px-4 py-4 text-center font-mono text-2xl tracking-widest uppercase mb-2 focus:outline-none focus:border-brand-primary"
                  maxLength={6}
                  autoFocus
                />
                {errorMsg && <p className="text-xs text-brand-red text-center mb-4">{errorMsg}</p>}
                
                <button 
                  type="submit" 
                  disabled={!joinCode.trim() || isLoading} 
                  className="w-full py-3.5 mt-4 bg-brand-primary text-white rounded-xl font-bold disabled:opacity-50 transition-all shadow-[0_0_15px_rgba(var(--color-primary-rgb),0.3)] cursor-pointer flex items-center justify-center"
                >
                  {isLoading ? <Loader2 className="animate-spin" size={20} /> : t('Vincular Pacto')}
                </button>
                <button 
                  type="button" 
                  onClick={() => setActiveTab('info')} 
                  className="w-full py-3 mt-2 text-brand-text-muted text-xs font-bold hover:text-brand-text transition-colors cursor-pointer"
                >
                  {t('Atrás')}
                </button>
              </form>
            )}
          </>
        )}
      </div>

      {/* Confirmation Modal to Dissolve Pact */}
      {showDissolveConfirm && activePact && (
        <div className="fixed inset-0 bg-brand-bg/85 z-[400] flex items-center justify-center p-4 animate-overlay-fade-in backdrop-blur-sm" onClick={() => setShowDissolveConfirm(false)}>
          <div className="w-full max-w-xs bg-brand-modal border border-brand-red/30 rounded-3xl p-6 shadow-2xl relative text-center" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-brand-red/10 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle size={24} className="text-brand-red" />
            </div>
            <h3 className="text-lg font-bold text-brand-text mb-1">{t('¿Disolver este pacto?')}</h3>
            <p className="text-xs text-brand-text-muted mb-5 leading-relaxed">
              {t('Se cancelará el pacto y la racha compartida. Tu hábito volverá a ser individual.')}
            </p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handleDissolvePact(activePact.id)}
                className="w-full py-3 bg-brand-red text-white rounded-xl font-bold text-sm shadow-[0_0_12px_rgba(239,68,68,0.3)] cursor-pointer"
              >
                {t('Sí, disolver pacto')}
              </button>
              <button
                type="button"
                onClick={() => setShowDissolveConfirm(false)}
                className="w-full py-3 bg-brand-card hover:bg-brand-card-sec border border-brand-border text-brand-text rounded-xl font-bold text-sm cursor-pointer"
              >
                {t('Mantener pacto')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};
