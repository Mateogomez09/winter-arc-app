import React, { useState } from 'react';
import { useTranslation } from "react-i18next";
import { 
  ArrowLeft, Shield, FileText, Lock, HeartHandshake, 
  HelpCircle, LogOut, Trash2, AlertTriangle, X, 
  ChevronRight, CheckCircle2, User as UserIcon, Mail, Sparkles, Globe, Clock, Bell, BellRing, Check, Send 
} from 'lucide-react';
import { User } from '../types';
import { createPortal } from 'react-dom';
import { ONBOARDING_VERSION } from './OnboardingView';
import { getUserTimezone } from '../services/db';
import { 
  areNotificationsEnabled, 
  requestNotificationPermission, 
  disableNotifications, 
  sendLocalNotification, 
  isNotificationSupported 
} from '../services/notificationService';

interface SettingsViewProps {
  user: User;
  onBack: () => void;
  onLogout: () => void;
  onDeleteAccount: () => void;
}

type PolicyType = 'privacy' | 'terms' | 'cookies' | 'health_disclaimer' | null;

export const SettingsView: React.FC<SettingsViewProps> = ({ 
  user, 
  onBack, 
  onLogout, 
  onDeleteAccount 
}) => {
  const { t } = useTranslation();
  const [activePolicy, setActivePolicy] = useState<PolicyType>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDisableNotifConfirm, setShowDisableNotifConfirm] = useState(false);
  const [notifsActive, setNotifsActive] = useState(() => areNotificationsEnabled());
  const [testSent, setTestSent] = useState(false);

  const handleToggleNotifs = async () => {
    if (notifsActive) {
      setShowDisableNotifConfirm(true);
    } else {
      const granted = await requestNotificationPermission();
      setNotifsActive(granted);
    }
  };

  const handleConfirmDisableNotifs = () => {
    disableNotifications();
    setNotifsActive(false);
    setShowDisableNotifConfirm(false);
  };

  const handleSendTest = async () => {
    setTestSent(true);
    await sendLocalNotification({
      title: 'WINTER ARC • Prueba de Notificación ⚔️',
      body: 'Todo listo. El sistema de avisos de disciplina y pactos está activo.',
      tag: 'test-notification'
    });
    setTimeout(() => setTestSent(false), 2500);
  };

  return (
    <div className="min-w-full w-full flex-shrink-0 snap-center h-full relative flex flex-col bg-brand-bg overflow-hidden animate-fade-in">
      {/* Top Navigation Header */}
      <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-brand-border/50 flex-shrink-0">
        <button 
          onClick={onBack}
          className="flex items-center space-x-1.5 text-xs font-bold text-brand-primary hover:text-brand-primary-active active:scale-95 transition-all p-1 -ml-1 cursor-pointer"
        >
          <ArrowLeft size={18} />
          <span>{t('Volver')}</span>
        </button>
        <h1 className="text-base font-display font-bold text-brand-text">
          {t('Ajustes')}
        </h1>
        <div className="w-8" />
      </div>

      {/* Settings Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6 pb-24 hide-scrollbar">
        
        {/* Account Info Card */}
        <div>
          <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-brand-text-muted mb-2 px-1">
            {t('Cuenta')}
          </h2>
          <div className="bg-brand-card border border-brand-border rounded-2xl p-4 shadow-sm flex items-center space-x-3.5">
            <img 
              src={user.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'} 
              alt={user.name} 
              className="w-12 h-12 rounded-full object-cover border border-brand-border"
            />
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-brand-text truncate">{user.name}</h3>
              <p className="text-xs text-brand-text-muted truncate">@{user.username || user.name.toLowerCase()}</p>
              <div className="flex items-center space-x-2 mt-1">
                <span className="text-[10px] font-extrabold bg-brand-primary/15 text-brand-primary px-2 py-0.5 rounded-md">
                  Nivel {user.level || 1}
                </span>
                <span className="text-[10px] text-brand-text-muted font-medium">
                  {user.xp || 0} XP
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Timezone & Day Rollover Section */}
        <div>
          <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-brand-text-muted mb-2 px-1">
            {t('Zona Horaria y Cambio de Día')}
          </h2>
          <div className="bg-brand-card border border-brand-border rounded-2xl p-4 shadow-sm space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center">
                  <Globe size={16} />
                </div>
                <div>
                  <p className="text-xs font-bold text-brand-text">{t('Zona horaria activa')}</p>
                  <p className="text-[10px] text-brand-text-muted">{getUserTimezone()}</p>
                </div>
              </div>
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                00:00 Local
              </span>
            </div>
            <p className="text-[11px] text-brand-text-muted leading-relaxed pt-1.5 border-t border-brand-border/40">
              {t('Tus hábitos, tareas y rachas se reinician automáticamente a las 00:00 (medianoche) de tu país o ciudad. Si viajas o utilizas la app en México, España o cualquier lugar del mundo, el progreso se adapta con precisión a tu huso horario local.')}
            </p>
          </div>
        </div>

        {/* Discipline Notifications Section */}
        <div>
          <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-brand-text-muted mb-2 px-1">
            {t('Avisos de Disciplina y Pactos')}
          </h2>
          <div className="bg-brand-card border border-brand-border rounded-2xl p-4 shadow-sm space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center">
                  <BellRing size={16} />
                </div>
                <div>
                  <p className="text-xs font-bold text-brand-text">{t('Notificaciones Push')}</p>
                  <p className="text-[10px] text-brand-text-muted">
                    {notifsActive ? t('Activadas y listas en este dispositivo') : t('Desactivadas')}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleToggleNotifs}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                  notifsActive
                    ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'
                    : 'bg-brand-primary text-black hover:bg-brand-primary-active'
                }`}
              >
                {notifsActive ? t('Activas') : t('Activar')}
              </button>
            </div>

            <div className="space-y-2 text-[11px] pt-2 border-t border-brand-border/40">
              <div className="flex items-center space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-primary flex-shrink-0" />
                <span className="text-brand-text">
                  <strong className="font-bold text-brand-text">14:00</strong> <span className="text-brand-text-muted">— {t('Recordatorio de mitad de jornada')}</span>
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                <span className="text-brand-text">
                  <strong className="font-bold text-brand-text">17:30</strong> <span className="text-brand-text-muted">— {t('Alerta de peligro de racha y cero excusas')}</span>
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 flex-shrink-0" />
                <span className="text-brand-text">
                  <strong className="font-bold text-brand-text">En vivo</strong> <span className="text-brand-text-muted">— {t('Alertas cuando tu compañero complete su pacto')}</span>
                </span>
              </div>
            </div>

            {notifsActive && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleSendTest}
                  disabled={testSent}
                  className="w-full py-2.5 rounded-xl bg-brand-card-sec hover:bg-brand-border/30 border border-brand-border text-brand-text text-xs font-semibold flex items-center justify-center space-x-2 transition-all cursor-pointer active:scale-98 shadow-sm"
                >
                  {testSent ? (
                    <>
                      <Check size={14} className="text-emerald-500 stroke-[3]" />
                      <span className="text-emerald-500 font-bold">{t('¡Notificación enviada!')}</span>
                    </>
                  ) : (
                    <>
                      <Send size={13} className="text-brand-primary" />
                      <span>{t('Enviar aviso de prueba ahora')}</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Legal and Compliance Section */}
        <div>
          <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-brand-text-muted mb-2 px-1">
            {t('Legal y Privacidad')}
          </h2>
          <div className="bg-brand-card border border-brand-border rounded-2xl overflow-hidden divide-y divide-brand-border/40 shadow-sm">
            {/* Privacy Policy */}
            <button 
              onClick={() => setActivePolicy('privacy')}
              className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-brand-card-sec/60 transition-colors text-left"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                  <Lock size={16} />
                </div>
                <div>
                  <p className="text-xs font-bold text-brand-text">{t('Política de Privacidad')}</p>
                  <p className="text-[10px] text-brand-text-muted">{t('Protección de datos (RGPD / GDPR)')}</p>
                </div>
              </div>
              <ChevronRight size={14} className="text-brand-text-muted" />
            </button>

            {/* Terms of Service */}
            <button 
              onClick={() => setActivePolicy('terms')}
              className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-brand-card-sec/60 transition-colors text-left"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                  <FileText size={16} />
                </div>
                <div>
                  <p className="text-xs font-bold text-brand-text">{t('Términos de Servicio')}</p>
                  <p className="text-[10px] text-brand-text-muted">{t('Condiciones de uso y normas del reto')}</p>
                </div>
              </div>
              <ChevronRight size={14} className="text-brand-text-muted" />
            </button>

            {/* Cookies & Storage */}
            <button 
              onClick={() => setActivePolicy('cookies')}
              className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-brand-card-sec/60 transition-colors text-left"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                  <Shield size={16} />
                </div>
                <div>
                  <p className="text-xs font-bold text-brand-text">{t('Cookies y Almacenamiento')}</p>
                  <p className="text-[10px] text-brand-text-muted">{t('Almacenamiento local offline')}</p>
                </div>
              </div>
              <ChevronRight size={14} className="text-brand-text-muted" />
            </button>

            {/* Health & Fitness Disclaimer */}
            <button 
              onClick={() => setActivePolicy('health_disclaimer')}
              className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-brand-card-sec/60 transition-colors text-left"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
                  <HeartHandshake size={16} />
                </div>
                <div>
                  <p className="text-xs font-bold text-brand-text">{t('Aviso de Salud y Deporte')}</p>
                  <p className="text-[10px] text-brand-text-muted">{t('Descargo de responsabilidad médica')}</p>
                </div>
              </div>
              <ChevronRight size={14} className="text-brand-text-muted" />
            </button>
          </div>
        </div>

        {/* Support & App Version */}
        <div>
          <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-brand-text-muted mb-2 px-1">
            {t('Información')}
          </h2>
          <div className="bg-brand-card border border-brand-border rounded-2xl p-4 shadow-sm space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-brand-text-muted">{t('Versión de la app')}</span>
              <span className="font-bold text-brand-text">v1.0.0 (Winter Arc 2026)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-brand-text-muted">{t('Contacto y Soporte')}</span>
              <span className="font-semibold text-brand-primary">soporte@winterarc.app</span>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem(`winterarc_onboarding_${ONBOARDING_VERSION}_${user.id}`);
                  localStorage.removeItem(`winterarc_onboarding_completed_${user.id}`);
                  window.location.reload();
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary text-xs font-bold flex items-center justify-center space-x-2 transition-colors cursor-pointer"
              >
                <Sparkles size={14} />
                <span>{t('Ver Tutorial de Bienvenida')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Danger Zone: Session Management */}
        <div>
          <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-brand-text-muted mb-2 px-1">
            {t('Sesión')}
          </h2>
          <div className="space-y-2.5">
            <button 
              onClick={() => setShowLogoutConfirm(true)}
              className="w-full py-3.5 bg-brand-card hover:bg-brand-card-sec border border-brand-border text-brand-text font-bold rounded-2xl flex items-center justify-center space-x-2 transition-all active:scale-[0.98] shadow-sm text-xs cursor-pointer"
            >
              <LogOut size={16} />
              <span>{t('Cerrar Sesión')}</span>
            </button>

            <button 
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full py-3.5 bg-brand-red/10 hover:bg-brand-red/20 border border-brand-red/30 text-brand-red font-bold rounded-2xl flex items-center justify-center space-x-2 transition-all active:scale-[0.98] text-xs cursor-pointer"
            >
              <Trash2 size={16} />
              <span>{t('Eliminar Cuenta y Datos')}</span>
            </button>
          </div>
        </div>

      </div>

      {/* Policy Modal Viewer */}
      {activePolicy && createPortal(
        <div className="fixed inset-0 bg-brand-bg/70 z-[250] flex items-center justify-center p-4 animate-overlay-fade-in backdrop-blur-md">
          <div className="w-full max-w-md max-h-[85vh] bg-brand-modal border border-brand-border rounded-3xl p-6 shadow-2xl relative flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-brand-border flex-shrink-0">
              <div className="flex items-center space-x-2.5">
                <Shield size={18} className="text-brand-primary" />
                <h2 className="text-base font-bold text-brand-text">
                  {activePolicy === 'privacy' && t('Política de Privacidad')}
                  {activePolicy === 'terms' && t('Términos de Servicio')}
                  {activePolicy === 'cookies' && t('Política de Cookies')}
                  {activePolicy === 'health_disclaimer' && t('Descargo de Salud y Deporte')}
                </h2>
              </div>
              <button 
                onClick={() => setActivePolicy(null)}
                className="p-1.5 rounded-full bg-brand-card hover:bg-brand-card-sec text-brand-text-muted transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-3.5 text-xs text-brand-text-muted leading-relaxed pr-1 hide-scrollbar">
              {activePolicy === 'privacy' && (
                <>
                  <p className="font-semibold text-brand-text">Última actualización: Septiembre 2026</p>
                  <p>
                    En <strong>Winter Arc App</strong>, nos comprometemos a proteger y respetar tu privacidad con arreglo al Reglamento General de Protección de Datos (RGPD / GDPR UE 2016/679) y la LOPD-GDD.
                  </p>
                  <h3 className="font-bold text-brand-text text-sm pt-2">1. Datos que recopilamos</h3>
                  <p>
                    Recopilamos únicamente los datos mínimos indispensables para el funcionamiento del reto: nombre de usuario, correo electrónico, registro de hábitos, reflexiones del tablón y progreso de XP.
                  </p>
                  <h3 className="font-bold text-brand-text text-sm pt-2">2. Uso de los datos</h3>
                  <p>
                    Tus datos se utilizan exclusivamente para sincronizar tu progreso entre tus dispositivos, mantener el ranking público del reto y gestionar los pactos de compromiso con tu compañero.
                  </p>
                  <h3 className="font-bold text-brand-text text-sm pt-2">3. No comercialización</h3>
                  <p>
                    <strong>Nunca vendemos, alquilamos ni compartimos tus datos personales</strong> con terceros, plataformas de publicidad ni corredores de datos.
                  </p>
                  <h3 className="font-bold text-brand-text text-sm pt-2">4. Tus derechos (ARCO)</h3>
                  <p>
                    Tienes derecho a acceder, rectificar, exportar o eliminar totalmente tus datos en cualquier momento desde el botón "Eliminar Cuenta y Datos" en los Ajustes o escribiéndonos a <strong>soporte@winterarc.app</strong>.
                  </p>
                </>
              )}

              {activePolicy === 'terms' && (
                <>
                  <p className="font-semibold text-brand-text">Última actualización: Septiembre 2026</p>
                  <p>
                    Al acceder o utilizar <strong>Winter Arc App</strong>, aceptas cumplir estos Términos y Condiciones de Uso del Reto.
                  </p>
                  <h3 className="font-bold text-brand-text text-sm pt-2">1. Naturaleza del Reto</h3>
                  <p>
                    Winter Arc es una plataforma de desarrollo personal y disciplina de 90 días orientada a la creación de hábitos, concentración y superación personal.
                  </p>
                  <h3 className="font-bold text-brand-text text-sm pt-2">2. Normas de Convivencia y Tablón</h3>
                  <p>
                    El Tablón de Valor es un espacio constructivo. Queda terminantemente prohibido publicar spam, insultos, contenido ofensivo, fraudulento, discriminatorio o ilícito. Nos reservamos el derecho de eliminar publicaciones que incumplan estas normas.
                  </p>
                  <h3 className="font-bold text-brand-text text-sm pt-2">3. Integridad de Pactos y XP</h3>
                  <p>
                    Los puntos de experiencia (XP) y las rachas son mecanismos motivacionales internos sin valor monetario canjeable.
                  </p>
                </>
              )}

              {activePolicy === 'cookies' && (
                <>
                  <p className="font-semibold text-brand-text">Última actualización: Septiembre 2026</p>
                  <p>
                    <strong>Winter Arc App NO utiliza cookies publicitarias ni rastreadores de terceros.</strong>
                  </p>
                  <h3 className="font-bold text-brand-text text-sm pt-2">1. Almacenamiento Local (LocalStorage)</h3>
                  <p>
                    Utilizamos exclusivamente almacenamiento local técnico (`localStorage`) en tu navegador para permitir que la app funcione offline, guarde tu sesión activa y recuerde tu progreso en tu dispositivo sin latencia.
                  </p>
                  <h3 className="font-bold text-brand-text text-sm pt-2">2. Control del usuario</h3>
                  <p>
                    Puedes borrar tu almacenamiento local en cualquier momento vaciando la caché de tu navegador o pulsando "Eliminar Cuenta y Datos".
                  </p>
                </>
              )}

              {activePolicy === 'health_disclaimer' && (
                <>
                  <p className="font-semibold text-brand-text">Aviso Médico y Deportivo</p>
                  <p>
                    El contenido y las herramientas de hábito de Winter Arc tienen únicamente un propósito informativo, motivacional y educativo sobre hábitos diarios.
                  </p>
                  <h3 className="font-bold text-brand-text text-sm pt-2">1. No es consejo médico</h3>
                  <p>
                    Esta aplicación no ofrece asesoramiento médico, diagnóstico ni tratamiento profesional. Consulta siempre a un médico o profesional sanitario cualificado antes de comenzar cualquier rutina de ejercicio físico extenuante o cambio dietético drástico.
                  </p>
                  <h3 className="font-bold text-brand-text text-sm pt-2">2. Responsabilidad individual</h3>
                  <p>
                    Cada usuario asume voluntariamente su propia responsabilidad sobre las metas físicas o hábitos que decide configurar en la plataforma.
                  </p>
                </>
              )}
            </div>

            <div className="pt-3 border-t border-brand-border flex-shrink-0">
              <button 
                onClick={() => setActivePolicy(null)}
                className="w-full py-2.5 bg-brand-primary text-white font-bold text-xs rounded-xl hover:bg-brand-primary-active transition-all"
              >
                {t('Entendido')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && createPortal(
        <div className="fixed inset-0 bg-brand-bg/70 z-[300] flex items-center justify-center p-4 animate-overlay-fade-in backdrop-blur-md">
          <div className="w-full max-w-xs bg-brand-modal border border-brand-border rounded-3xl p-6 shadow-2xl text-center">
            <div className="w-14 h-14 rounded-full bg-brand-primary/10 text-brand-primary flex items-center justify-center mx-auto mb-3">
              <LogOut size={26} />
            </div>
            <h3 className="text-base font-bold text-brand-text mb-1">{t('¿Cerrar Sesión?')}</h3>
            <p className="text-xs text-brand-text-muted mb-5">
              {t('Tu progreso se guardará y podrás volver a iniciar sesión cuando quieras.')}
            </p>
            <div className="flex space-x-2.5">
              <button 
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2.5 bg-brand-card hover:bg-brand-card-sec border border-brand-border text-brand-text text-xs font-bold rounded-xl transition-all"
              >
                {t('Cancelar')}
              </button>
              <button 
                onClick={onLogout}
                className="flex-1 py-2.5 bg-brand-primary text-white text-xs font-bold rounded-xl hover:bg-brand-primary-active transition-all shadow-md"
              >
                {t('Salir')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Account Confirmation Modal */}
      {showDeleteConfirm && createPortal(
        <div className="fixed inset-0 bg-brand-bg/80 z-[300] flex items-center justify-center p-4 animate-overlay-fade-in backdrop-blur-md">
          <div className="w-full max-w-xs bg-brand-modal border border-brand-red/30 rounded-3xl p-6 shadow-2xl text-center">
            <div className="w-14 h-14 rounded-full bg-brand-red/10 text-brand-red flex items-center justify-center mx-auto mb-3">
              <AlertTriangle size={26} />
            </div>
            <h3 className="text-base font-bold text-brand-text mb-1">{t('¡Peligro!')}</h3>
            <p className="text-xs text-brand-text-muted mb-5">
              {t('Estás a punto de borrar tu cuenta del Winter Arc. Esto eliminará tus hábitos, tareas y XP de forma irreversible.')}
            </p>
            <div className="flex flex-col space-y-2">
              <button 
                onClick={onDeleteAccount}
                className="w-full py-2.5 bg-brand-red text-white text-xs font-bold rounded-xl hover:bg-brand-red/90 transition-all shadow-md"
              >
                {t('Eliminar definitivamente')}
              </button>
              <button 
                onClick={() => setShowDeleteConfirm(false)}
                className="w-full py-2.5 bg-brand-card hover:bg-brand-card-sec border border-brand-border text-brand-text text-xs font-bold rounded-xl transition-all"
              >
                {t('Cancelar')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Disable Notifications Friction Confirmation Modal */}
      {showDisableNotifConfirm && createPortal(
        <div className="fixed inset-0 bg-brand-bg/80 z-[300] flex items-center justify-center p-4 animate-overlay-fade-in backdrop-blur-md">
          <div className="w-full max-w-xs bg-brand-modal border border-amber-500/30 rounded-3xl p-6 shadow-2xl text-center">
            <div className="w-14 h-14 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle size={26} />
            </div>
            <h3 className="text-base font-bold text-brand-text mb-1.5">{t('¿Desactivar avisos?')}</h3>
            <p className="text-xs text-brand-text-muted leading-relaxed mb-5">
              {t('Desactivar los avisos aumenta el riesgo de olvidar tus hábitos y romper tu racha de 90 días en el Winter Arc. Dejarás de recibir los recordatorios de las 14:00 y las alertas de peligro de las 17:30.')}
            </p>
            <div className="flex flex-col space-y-2">
              <button 
                onClick={() => setShowDisableNotifConfirm(false)}
                className="w-full py-3 bg-brand-primary text-black text-xs font-bold rounded-xl hover:bg-brand-primary-active transition-all shadow-md cursor-pointer"
              >
                {t('Mantener Activas (Recomendado)')}
              </button>
              <button 
                onClick={handleConfirmDisableNotifs}
                className="w-full py-2.5 bg-brand-card hover:bg-brand-card-sec border border-brand-border text-brand-text-muted hover:text-brand-red text-xs font-medium rounded-xl transition-all cursor-pointer"
              >
                {t('Desactivar de todos modos')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
