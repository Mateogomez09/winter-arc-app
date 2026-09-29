import React from 'react';
import { useTranslation } from "react-i18next";
import { CheckCircle2, ListTodo, Flame, Trophy, PieChart, User } from 'lucide-react';

export type TabType = 'habitos' | 'tareas' | 'tablon' | 'ranking' | 'estadisticas' | 'perfil';

interface BottomNavProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, setActiveTab }) => {
  const { t } = useTranslation();
  
  const navItems = [
    { id: 'habitos', icon: CheckCircle2, label: 'Hábitos' },
    { id: 'tareas', icon: ListTodo, label: 'Tareas' },
    { id: 'tablon', icon: Flame, label: 'Tablón' },
    { id: 'ranking', icon: Trophy, label: 'Ranking' },
    { id: 'estadisticas', icon: PieChart, label: 'Estadísticas' },
    { id: 'perfil', icon: User, label: 'Perfil' },
  ] as const;

  return (
    <div className="w-full bg-brand-card border-t border-brand-border pt-2 pb-[max(env(safe-area-inset-bottom),8px)] px-2 flex justify-between items-center z-40 relative flex-shrink-0">
      {navItems.map((item) => (
        <button 
          key={item.id}
          onClick={() => setActiveTab(item.id as TabType)}
          className={`flex flex-col items-center justify-center space-y-1 relative py-1.5 px-2 rounded-xl transition-all duration-300 active:scale-95 flex-1 ${
            activeTab === item.id ? 'text-brand-primary' : 'text-brand-text-muted hover:text-brand-text'
          }`}
        >
          <item.icon size={22} className={`transition-all duration-300 ${activeTab === item.id ? 'scale-110' : 'opacity-85'}`} />
          <span className="text-[9px] font-semibold tracking-tight">{t(item.label)}</span>
          
          {activeTab === item.id && (
            <span className="absolute bottom-0 w-1 h-1 rounded-full bg-brand-primary shadow-[0_0_8px_#7A8DFF] animate-pulse" />
          )}
        </button>
      ))}
    </div>
  );
};
