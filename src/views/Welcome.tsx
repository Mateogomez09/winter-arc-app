import React, { useState } from 'react';
import { Sparkles, ArrowRight, UserPlus, LogIn, Mail, User as UserIcon, Shield, ChevronLeft, Lock, KeyRound, CheckCircle2, Flame } from 'lucide-react';
import { Logo } from '../components/Logo';
import { signInUser, signUpUser, resetUserPassword } from '../services/auth';
import { User } from '../types';
import { useTranslation } from "react-i18next";

interface WelcomeProps {
  onAuthSuccess: (user: User, isNewUser: boolean) => void;
}

type AuthScreen = 'splash' | 'login' | 'register' | 'forgot_password';

export const Welcome: React.FC<WelcomeProps> = ({ onAuthSuccess }) => {
  const { t } = useTranslation();
  const [screen, setScreen] = useState<AuthScreen>('splash');
  
  // Form fields
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Feedback states
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setIsLoading(true);

    try {
      const res = await signInUser(email, password);
      if (res.success && res.user) {
        onAuthSuccess(res.user, false);
      } else {
        setErrorMsg(res.error || 'No se pudo iniciar sesión.');
      }
    } catch (err: any) {
      setErrorMsg('Error al conectar con el servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setIsLoading(true);

    if (!name.trim() || !username.trim() || !email.trim() || !password) {
      setErrorMsg('Todos los campos son obligatorios.');
      setIsLoading(false);
      return;
    }

    try {
      const res = await signUpUser(email, password, name, username);
      if (res.success && res.user) {
        if (res.needsEmailConfirmation) {
          setSuccessMsg('¡Cuenta creada! Revisa tu correo electrónico para confirmar tu registro antes de entrar.');
        } else {
          onAuthSuccess(res.user, true);
        }
      } else {
        setErrorMsg(res.error || 'Error al crear la cuenta.');
      }
    } catch (err: any) {
      setErrorMsg('Error al registrar usuario.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setIsLoading(true);

    try {
      const res = await resetUserPassword(email);
      if (res.success) {
        setSuccessMsg(res.message);
      } else {
        setErrorMsg(res.message || 'Error al enviar correo.');
      }
    } catch (err: any) {
      setErrorMsg('Error al procesar la solicitud.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 h-full flex flex-col justify-between px-6 pt-[max(env(safe-area-inset-top),24px)] pb-[max(env(safe-area-inset-bottom),24px)] bg-[#050505] text-white relative overflow-hidden">
      <style>{`body { background-color: #050505 !important; }`}</style>
      
      {/* Dynamic Background */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-brand-primary/10 rounded-full blur-[120px] animate-pulse-glow"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-[#06b6d4]/10 rounded-full blur-[100px] animate-pulse-glow" style={{ animationDelay: '1s' }}></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.02)_0%,transparent_100%)] mix-blend-overlay"></div>
      </div>

      {/* Brand Header (Only on Auth sub-screens) */}
      {screen !== 'splash' ? (
        <div className="relative z-10 flex items-center justify-between w-full pt-1">
          <button 
            onClick={() => {
              setScreen('splash');
              setErrorMsg('');
              setSuccessMsg('');
            }} 
            className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors cursor-pointer"
          >
            <ChevronLeft size={20} className="text-white/70" />
          </button>
          <div className="flex items-center space-x-2">
            <Logo size={22} className="text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]" />
            <span className="font-display font-black text-xs tracking-widest text-white uppercase">WINTER ARC</span>
          </div>
          <div className="w-10" />
        </div>
      ) : (
        <div className="h-2" />
      )}

      {/* Main Content Area */}
      <div className="relative z-10 flex-1 flex flex-col justify-center">
        
        {/* Splash Screen */}
        {screen === 'splash' && (
          <div className="flex flex-col items-center justify-center text-center space-y-8 animate-fade-in w-full max-w-sm mx-auto">
            
            {/* Center Iconic Core */}
            <div className="relative flex flex-col items-center">
              <div className="w-24 h-24 rounded-3xl bg-[#0A0A0E]/90 border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_30px_rgba(122,141,255,0.15)] flex items-center justify-center backdrop-blur-2xl">
                <Logo size={42} className="text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]" />
              </div>
            </div>

            <div className="space-y-2.5">
              <h1 className="text-[2.5rem] font-display font-black tracking-tight leading-[1] text-white uppercase">
                WINTER ARC
              </h1>
              
              <p className="text-[14px] text-white/50 max-w-[280px] mx-auto leading-relaxed font-medium">
                El reto de 90 días para transformar tus hábitos antes de que termine el año.
              </p>
            </div>

            <div className="space-y-3 w-full pt-4">
              <button 
                onClick={() => {
                  setScreen('register');
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                className="w-full py-4 bg-white text-black font-extrabold text-[15px] rounded-2xl flex items-center justify-center space-x-2 hover:bg-white/90 active:scale-[0.98] transition-all duration-300 shadow-[0_0_20px_rgba(255,255,255,0.15)] cursor-pointer"
              >
                <span>Comenzar mi Winter Arc</span>
                <ArrowRight size={18} />
              </button>
              
              <button 
                onClick={() => {
                  setScreen('login');
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                className="w-full py-3 bg-transparent text-white/50 hover:text-white font-semibold text-[13px] transition-all duration-300 cursor-pointer"
              >
                Ya tengo una cuenta • Iniciar Sesión
              </button>
            </div>
          </div>
        )}

        {/* Login Screen */}
        {screen === 'login' && (
          <div className="flex flex-col justify-center animate-fade-in w-full max-w-sm mx-auto space-y-6">
            <div className="space-y-2 text-center">
              <h2 className="text-3xl font-display font-extrabold text-white tracking-tight">Bienvenido de vuelta</h2>
              <p className="text-xs text-white/50">Inicia sesión para mantener tu racha del Winter Arc.</p>
            </div>

            {errorMsg && (
              <div className="p-3.5 bg-brand-red/15 border border-brand-red/30 rounded-2xl text-brand-red text-xs text-center font-medium animate-shake">
                {errorMsg}
              </div>
            )}

            {successMsg && (
              <div className="p-3.5 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl text-emerald-400 text-xs text-center font-medium flex items-center justify-center space-x-1.5">
                <CheckCircle2 size={15} />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-white/50 uppercase tracking-widest ml-1">Correo Electrónico</label>
                <div className="relative group">
                  <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-brand-primary transition-colors" />
                  <input 
                    type="email" 
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                    className="w-full bg-[#0A0A0C] border border-white/10 rounded-2xl pl-12 pr-4 py-3.5 text-sm text-white placeholder-white/20 focus:border-brand-primary/60 focus:bg-[#121214] focus:ring-4 focus:ring-brand-primary/10 transition-all outline-none"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between px-1">
                  <label className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Contraseña</label>
                  <button 
                    type="button" 
                    onClick={() => {
                      setScreen('forgot_password');
                      setErrorMsg('');
                      setSuccessMsg('');
                    }}
                    className="text-[10px] font-semibold text-brand-primary hover:underline cursor-pointer"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
                <div className="relative group">
                  <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-brand-primary transition-colors" />
                  <input 
                    type="password" 
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#0A0A0C] border border-white/10 rounded-2xl pl-12 pr-4 py-3.5 text-sm text-white placeholder-white/20 focus:border-brand-primary/60 focus:bg-[#121214] focus:ring-4 focus:ring-brand-primary/10 transition-all outline-none"
                    required
                  />
                </div>
              </div>

              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={isLoading}
                  className="w-full py-4 bg-brand-primary hover:bg-brand-primary-active text-black font-extrabold text-[15px] rounded-2xl flex items-center justify-center space-x-2 transition-all duration-300 shadow-[0_0_20px_rgba(255,255,255,0.15)] disabled:opacity-50 cursor-pointer active:scale-[0.98]"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <LogIn size={18} />
                      <span>Entrar al Winter Arc</span>
                    </>
                  )}
                </button>
              </div>

              <div className="text-center pt-2">
                <button 
                  type="button"
                  onClick={() => {
                    setScreen('register');
                    setErrorMsg('');
                    setSuccessMsg('');
                  }}
                  className="text-xs text-white/60 hover:text-white cursor-pointer"
                >
                  ¿No tienes cuenta? <strong className="text-brand-primary font-bold">Regístrate</strong>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Register Screen */}
        {screen === 'register' && (
          <div className="flex flex-col justify-center animate-fade-in w-full max-w-sm mx-auto space-y-5">
            <div className="space-y-1.5 text-center">
              <h2 className="text-3xl font-display font-extrabold text-white tracking-tight">Crea tu cuenta</h2>
              <p className="text-xs text-white/50">Empieza tu reto de 90 días hoy mismo.</p>
            </div>

            {errorMsg && (
              <div className="p-3.5 bg-brand-red/15 border border-brand-red/30 rounded-2xl text-brand-red text-xs text-center font-medium animate-shake">
                {errorMsg}
              </div>
            )}

            {successMsg && (
              <div className="p-3.5 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl text-emerald-400 text-xs text-center font-medium">
                {successMsg}
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest ml-1">Nombre</label>
                <div className="relative group">
                  <UserIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-brand-primary transition-colors" />
                  <input 
                    type="text" 
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Tu nombre"
                    className="w-full bg-[#0A0A0C] border border-white/10 rounded-2xl pl-12 pr-4 py-3 text-sm text-white placeholder-white/20 focus:border-brand-primary/60 focus:bg-[#121214] focus:ring-4 focus:ring-brand-primary/10 transition-all outline-none"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest ml-1">Usuario (@alias)</label>
                <div className="relative group">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-white/30 group-focus-within:text-brand-primary transition-colors">@</span>
                  <input 
                    type="text" 
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="usuario"
                    className="w-full bg-[#0A0A0C] border border-white/10 rounded-2xl pl-10 pr-4 py-3 text-sm text-white placeholder-white/20 focus:border-brand-primary/60 focus:bg-[#121214] focus:ring-4 focus:ring-brand-primary/10 transition-all outline-none"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest ml-1">Correo Electrónico</label>
                <div className="relative group">
                  <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-brand-primary transition-colors" />
                  <input 
                    type="email" 
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                    className="w-full bg-[#0A0A0C] border border-white/10 rounded-2xl pl-12 pr-4 py-3 text-sm text-white placeholder-white/20 focus:border-brand-primary/60 focus:bg-[#121214] focus:ring-4 focus:ring-brand-primary/10 transition-all outline-none"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest ml-1">Contraseña</label>
                <div className="relative group">
                  <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-brand-primary transition-colors" />
                  <input 
                    type="password" 
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full bg-[#0A0A0C] border border-white/10 rounded-2xl pl-12 pr-4 py-3 text-sm text-white placeholder-white/20 focus:border-brand-primary/60 focus:bg-[#121214] focus:ring-4 focus:ring-brand-primary/10 transition-all outline-none"
                    required
                  />
                </div>
              </div>

              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={isLoading}
                  className="w-full py-3.5 bg-white text-black font-extrabold text-[15px] rounded-2xl flex items-center justify-center space-x-2 transition-all duration-300 shadow-[0_0_20px_rgba(255,255,255,0.15)] hover:scale-[1.01] active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <UserPlus size={18} />
                      <span>Crear mi cuenta</span>
                    </>
                  )}
                </button>
              </div>

              <div className="text-center pt-1">
                <button 
                  type="button"
                  onClick={() => {
                    setScreen('login');
                    setErrorMsg('');
                    setSuccessMsg('');
                  }}
                  className="text-xs text-white/60 hover:text-white cursor-pointer"
                >
                  ¿Ya tienes cuenta? <strong className="text-brand-primary font-bold">Inicia sesión</strong>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Forgot Password Screen */}
        {screen === 'forgot_password' && (
          <div className="flex flex-col justify-center animate-fade-in w-full max-w-sm mx-auto space-y-6">
            <div className="space-y-2 text-center">
              <h2 className="text-3xl font-display font-extrabold text-white tracking-tight">Recuperar contraseña</h2>
              <p className="text-xs text-white/50">Introduce tu correo y te enviaremos las instrucciones de restablecimiento.</p>
            </div>

            {errorMsg && (
              <div className="p-3.5 bg-brand-red/15 border border-brand-red/30 rounded-2xl text-brand-red text-xs text-center font-medium animate-shake">
                {errorMsg}
              </div>
            )}

            {successMsg && (
              <div className="p-3.5 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl text-emerald-400 text-xs text-center font-medium">
                {successMsg}
              </div>
            )}

            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-white/50 uppercase tracking-widest ml-1">Correo Electrónico</label>
                <div className="relative group">
                  <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-brand-primary transition-colors" />
                  <input 
                    type="email" 
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                    className="w-full bg-[#0A0A0C] border border-white/10 rounded-2xl pl-12 pr-4 py-3.5 text-sm text-white placeholder-white/20 focus:border-brand-primary/60 focus:bg-[#121214] focus:ring-4 focus:ring-brand-primary/10 transition-all outline-none"
                    required
                  />
                </div>
              </div>

              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={isLoading}
                  className="w-full py-4 bg-brand-primary hover:bg-brand-primary-active text-black font-extrabold text-[15px] rounded-2xl flex items-center justify-center space-x-2 transition-all duration-300 shadow-[0_0_20px_rgba(255,255,255,0.15)] disabled:opacity-50 cursor-pointer active:scale-[0.98]"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <KeyRound size={18} />
                      <span>Enviar enlace de recuperación</span>
                    </>
                  )}
                </button>
              </div>

              <div className="text-center pt-2">
                <button 
                  type="button"
                  onClick={() => {
                    setScreen('login');
                    setErrorMsg('');
                    setSuccessMsg('');
                  }}
                  className="text-xs text-white/60 hover:text-white cursor-pointer"
                >
                  ← Volver a <strong className="text-brand-primary font-bold">Iniciar sesión</strong>
                </button>
              </div>
            </form>
          </div>
        )}

      </div>

      {/* Footer Copy */}
      <div className="relative z-10 text-center pb-2">
        <p className="text-[10px] text-white/30 uppercase tracking-widest font-semibold">
          DISCIPLINA • CONSTANCIA • VICTORIA
        </p>
      </div>
    </div>
  );
};
