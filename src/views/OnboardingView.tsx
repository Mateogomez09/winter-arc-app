import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Flame, BookOpen, Dumbbell, Salad, Sunrise, 
  Sparkles, ArrowRight, CheckCircle2, ChevronRight, ChevronLeft,
  Trophy, Handshake, Bell, BellRing, Shield, Swords, Clock, Check
} from 'lucide-react';
import { User } from '../types';
import { PRESET_AVATARS } from '../utils/profileCustomization';
import { updateUserProfile } from '../services/db';
import { requestNotificationPermission, areNotificationsEnabled, isNotificationSupported } from '../services/notificationService';

export const ONBOARDING_VERSION = 'v3_notifications_added';

interface OnboardingViewProps {
  user: User;
  onComplete: (updatedUser: User) => void;
}

export const OnboardingView: React.FC<OnboardingViewProps> = ({ user, onComplete }) => {
  const { t } = useTranslation();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedAvatarUrl, setSelectedAvatarUrl] = useState<string>(
    user.avatar_url || PRESET_AVATARS[1].url
  );
  const [isSaving, setIsSaving] = useState(false);
  const [notifGranted, setNotifGranted] = useState(() => areNotificationsEnabled());
  const [isRequestingNotif, setIsRequestingNotif] = useState(false);

  // Swipe gesture handling
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const distance = touchStartX.current - touchEndX.current;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe && step < 4) {
      setStep((prev) => (prev + 1) as 1 | 2 | 3 | 4);
    }
    if (isRightSwipe && step > 1) {
      setStep((prev) => (prev - 1) as 1 | 2 | 3 | 4);
    }

    touchStartX.current = null;
    touchEndX.current = null;
  };

  const handleEnableNotifications = async () => {
    setIsRequestingNotif(true);
    const granted = await requestNotificationPermission();
    setNotifGranted(granted);
    setIsRequestingNotif(false);
    if (granted) {
      setTimeout(() => {
        setStep(4);
      }, 700);
    }
  };

  const handleFinish = async () => {
    setIsSaving(true);
    try {
      const updated = updateUserProfile(user.id, {
        avatar_url: selectedAvatarUrl
      });
      localStorage.setItem(`winterarc_onboarding_${ONBOARDING_VERSION}_${user.id}`, 'true');
      localStorage.setItem(`winterarc_onboarding_completed_${user.id}`, 'true');
      onComplete(updated);
    } catch (e) {
      localStorage.setItem(`winterarc_onboarding_${ONBOARDING_VERSION}_${user.id}`, 'true');
      localStorage.setItem(`winterarc_onboarding_completed_${user.id}`, 'true');
      onComplete(user);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div 
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="flex-1 min-h-[100dvh] sm:min-h-0 sm:h-full flex flex-col justify-between px-6 py-6 bg-[#050505] text-white relative overflow-hidden select-none"
    >
      <style>{`body { background-color: #050505 !important; }`}</style>

      {/* Dynamic Background Glow */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-15%] left-[-10%] w-[70%] h-[70%] bg-brand-primary/10 rounded-full blur-[120px] animate-pulse-glow" />
        <div className="absolute bottom-[-15%] right-[-10%] w-[60%] h-[60%] bg-[#06b6d4]/10 rounded-full blur-[100px] animate-pulse-glow" style={{ animationDelay: '1.2s' }} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.02)_0%,transparent_100%)] mix-blend-overlay" />
      </div>

      {/* Minimal Top Header */}
      <div className="relative z-10 w-full flex items-center justify-between pt-1">
        {step > 1 ? (
          <button 
            onClick={() => setStep((prev) => (prev - 1) as 1 | 2 | 3 | 4)}
            className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all text-white/60 cursor-pointer"
          >
            <ChevronLeft size={18} />
          </button>
        ) : (
          <div className="w-9" />
        )}

        <span className="font-display font-black text-[11px] tracking-widest text-white/40 uppercase">
          WINTER ARC
        </span>

        <div className="w-9" />
      </div>

      {/* Main Step Content Area */}
      <div className="relative z-10 flex-1 flex flex-col justify-center py-4">
        
        {/* STEP 1: Filosofía Minimalista + Cards de Valor */}
        {step === 1 && (
          <div className="space-y-6 text-center animate-fade-in max-w-xs mx-auto">
            <div className="space-y-3">
              <h1 className="text-[2.7rem] font-display font-black tracking-tight leading-[1.05] text-white">
                Disciplina <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-white/40">
                  Absoluta.
                </span>
              </h1>
              
              <p className="text-[13px] text-white/60 leading-relaxed font-medium">
                90 días de enfoque implacable. Mientras la mayoría se acomoda al final de año, tú construyes en silencio tu versión más fuerte e inquebrantable.
              </p>
            </div>

            {/* Feature Highlights */}
            <div className="grid grid-cols-2 gap-3 pt-2 text-left">
              <div className="p-3.5 rounded-2xl bg-[#0F0F12]/90 border border-white/10 space-y-1.5 backdrop-blur-sm shadow-md">
                <div className="w-7 h-7 rounded-lg bg-[#FFD700]/10 flex items-center justify-center text-[#FFD700]">
                  <Trophy size={16} />
                </div>
                <p className="text-xs font-bold text-white">Ranking Real</p>
                <p className="text-[10px] text-white/40 leading-snug">Gana XP y escala puestos con tu constancia diaria.</p>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#0F0F12]/90 border border-white/10 space-y-1.5 backdrop-blur-sm shadow-md">
                <div className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
                  <Handshake size={16} />
                </div>
                <p className="text-xs font-bold text-white">Pactos de Honor</p>
                <p className="text-[10px] text-white/40 leading-snug">Únete a un compañero y mantengan su racha juntos.</p>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Los 4 Hábitos Innegociables */}
        {step === 2 && (
          <div className="space-y-5 animate-fade-in max-w-xs mx-auto w-full">
            <div className="text-center space-y-1">
              <h2 className="text-2xl font-display font-black tracking-tight text-white">
                4 Hábitos Base
              </h2>
              <p className="text-xs text-white/50">
                La base innegociable de cada día durante los 90 días.
              </p>
            </div>

            <div className="space-y-2.5 pt-1">
              <div className="flex items-center space-x-3 p-3.5 rounded-2xl bg-[#0F0F12]/80 border border-white/10 backdrop-blur-sm">
                <div className="w-9 h-9 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center shrink-0">
                  <BookOpen size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white">Leer 10 páginas</p>
                  <p className="text-[10px] text-white/40">Enfoque mental diario</p>
                </div>
                <CheckCircle2 size={16} className="text-brand-primary shrink-0" />
              </div>

              <div className="flex items-center space-x-3 p-3.5 rounded-2xl bg-[#0F0F12]/80 border border-white/10 backdrop-blur-sm">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
                  <Dumbbell size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white">Entrenar</p>
                  <p className="text-[10px] text-white/40">Exigencia física diaria</p>
                </div>
                <CheckCircle2 size={16} className="text-brand-primary shrink-0" />
              </div>

              <div className="flex items-center space-x-3 p-3.5 rounded-2xl bg-[#0F0F12]/80 border border-white/10 backdrop-blur-sm">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                  <Salad size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white">Comer saludable</p>
                  <p className="text-[10px] text-white/40">Nutrición y energía limpia</p>
                </div>
                <CheckCircle2 size={16} className="text-brand-primary shrink-0" />
              </div>

              <div className="flex items-center space-x-3 p-3.5 rounded-2xl bg-[#0F0F12]/80 border border-white/10 backdrop-blur-sm">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center shrink-0">
                  <Sunrise size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white">Levantarse pronto</p>
                  <p className="text-[10px] text-white/40">Gana el día desde temprano</p>
                </div>
                <CheckCircle2 size={16} className="text-brand-primary shrink-0" />
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Blindaje de Disciplina • Notificaciones */}
        {step === 3 && (
          <div className="space-y-4 animate-fade-in max-w-xs mx-auto w-full text-center">
            <div className="space-y-1.5">
              <div className="w-14 h-14 rounded-3xl bg-brand-primary/10 border border-brand-primary/25 mx-auto flex items-center justify-center text-brand-primary shadow-[0_0_25px_rgba(122,141,255,0.2)]">
                <BellRing size={26} className="animate-pulse" />
              </div>
              <h2 className="text-2xl font-display font-black tracking-tight text-white pt-1">
                Blindaje de Racha
              </h2>
              <p className="text-xs text-white/50 leading-relaxed max-w-[260px] mx-auto">
                La constancia no se deja al azar. Recibe avisos estratégicos en tu hora local para no fallar jamás.
              </p>
            </div>

            {/* Strategic Notification Highlights */}
            <div className="space-y-2 text-left pt-1">
              <div className="p-3 rounded-2xl bg-[#0F0F12]/90 border border-white/10 flex items-center space-x-3 backdrop-blur-sm">
                <div className="w-8 h-8 rounded-xl bg-brand-primary/15 text-brand-primary flex items-center justify-center shrink-0">
                  <Clock size={15} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white">Mitad de Jornada (~14:00)</p>
                  <p className="text-[10px] text-white/40 leading-tight">Reconecta con tus 4 hábitos base.</p>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-[#0F0F12]/90 border border-white/10 flex items-center space-x-3 backdrop-blur-sm">
                <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
                  <Shield size={15} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white">Alerta de Racha (~17:30)</p>
                  <p className="text-[10px] text-white/40 leading-tight">Cero excusas antes del anochecer.</p>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-[#0F0F12]/90 border border-white/10 flex items-center space-x-3 backdrop-blur-sm">
                <div className="w-8 h-8 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center shrink-0">
                  <Swords size={15} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white">Alertas de Pactos en Vivo</p>
                  <p className="text-[10px] text-white/40 leading-tight">Cuando tu compañero cumpla su parte.</p>
                </div>
              </div>
            </div>

            {/* Activation CTA */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleEnableNotifications}
                disabled={isRequestingNotif || notifGranted}
                className={`w-full py-3 rounded-2xl font-bold text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                  notifGranted 
                    ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                    : 'bg-brand-primary hover:bg-brand-primary-active text-black shadow-[0_0_20px_rgba(122,141,255,0.3)] active:scale-95'
                }`}
              >
                {isRequestingNotif ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : notifGranted ? (
                  <>
                    <Check size={16} className="stroke-[3]" />
                    <span>Avisos de Disciplina Activados</span>
                  </>
                ) : (
                  <>
                    <Bell size={15} />
                    <span>Activar Avisos de Disciplina</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Selector de Avatar / Aura Inicial */}
        {step === 4 && (
          <div className="space-y-5 text-center animate-fade-in max-w-xs mx-auto w-full">
            <div className="space-y-1">
              <h2 className="text-2xl font-display font-black tracking-tight text-white">
                Elige tu Color
              </h2>
              <p className="text-xs text-white/50">
                Selecciona tu fondo de perfil inicial para el reto.
              </p>
            </div>

            {/* Live Profile Card Preview */}
            <div className="w-full p-4 rounded-2xl bg-[#0F0F12]/90 border border-white/10 shadow-xl flex flex-col items-center space-y-2 backdrop-blur-md">
              <div className="relative">
                <img 
                  src={selectedAvatarUrl} 
                  alt="Avatar" 
                  className="w-18 h-18 rounded-full object-cover border-2 border-brand-border shadow-lg transition-all duration-300"
                />
                <span className="absolute -bottom-1 -right-1 text-[8px] font-black px-1.5 py-0.5 rounded-full bg-brand-primary text-black">
                  Nv.1
                </span>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-white">{user.name}</p>
                <p className="text-[11px] text-white/40">@{user.username || user.name.toLowerCase()}</p>
              </div>
            </div>

            {/* Avatar Color Grids */}
            <div className="grid grid-cols-4 gap-2.5 max-w-[260px] mx-auto pt-0.5">
              {PRESET_AVATARS.map((preset) => {
                const isSelected = selectedAvatarUrl === preset.url;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setSelectedAvatarUrl(preset.url)}
                    className={`relative p-1 rounded-2xl transition-all duration-300 cursor-pointer ${
                      isSelected ? 'ring-2 ring-brand-primary scale-110' : 'hover:scale-105 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <div 
                      className="w-11 h-11 rounded-xl shadow-md border border-white/10"
                      style={{ background: preset.cssGradient }}
                    />
                    {isSelected && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-brand-primary text-black flex items-center justify-center">
                        <CheckCircle2 size={12} className="stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

      </div>

      {/* Bottom Area: Indicators & Navigation */}
      <div className="relative z-10 w-full flex flex-col items-center space-y-4 pb-2">
        
        {/* Centered Step Indicator Dots */}
        <div className="flex items-center space-x-2">
          {[1, 2, 3, 4].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStep(s as 1 | 2 | 3 | 4)}
              className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                s === step ? 'w-6 bg-brand-primary shadow-[0_0_8px_#7A8DFF]' : 'w-1.5 bg-white/20 hover:bg-white/40'
              }`}
            />
          ))}
        </div>

        {/* Minimal Bottom Action / Subtle Continue */}
        {step < 4 ? (
          <button
            type="button"
            onClick={() => setStep((prev) => (prev + 1) as 1 | 2 | 3 | 4)}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 active:scale-95 text-xs font-semibold text-white/70 hover:text-white transition-all cursor-pointer"
          >
            <span>{step === 3 && notifGranted ? 'Siguiente paso' : 'Desliza o pulsa aquí'}</span>
            <ChevronRight size={14} className="text-white/50" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleFinish}
            disabled={isSaving}
            className="w-full max-w-xs py-3.5 bg-brand-primary hover:bg-brand-primary-active text-black font-extrabold text-[14px] rounded-2xl flex items-center justify-center space-x-2 active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(122,141,255,0.3)] disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? (
              <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>Aceptar el Reto • Entrar</span>
                <Flame size={16} className="fill-black" />
              </>
            )}
          </button>
        )}

      </div>
    </div>
  );
};
