import { useState, useEffect, useRef } from 'react';
import { PhoneContainer } from './components/PhoneContainer';
import { BottomNav, TabType } from './components/BottomNav';
import { Welcome } from './views/Welcome';
import { OnboardingView, ONBOARDING_VERSION } from './views/OnboardingView';
import { HabitsView } from './views/HabitsView';
import { TasksView } from './views/TasksView';
import { ValueBoardView } from './views/ValueBoardView';
import { RankingView } from './views/RankingView';
import { StatsView } from './views/StatsView';
import { PerfilView } from './views/PerfilView';
import { PublicProfileModal } from './components/PublicProfileModal';
import { initializeDB, getAllUsers } from './services/db';
import { pullAllFromSupabase, setupRealtimeSync } from './services/supabaseSync';
import { getCurrentAuthUser } from './services/auth';
import { supabase } from './lib/supabaseClient';
import { User } from './types';

function App() {
  const [authChecking, setAuthChecking] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  const [activeTab, setActiveTab] = useState<TabType>('habitos');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const allUsers = getAllUsers();

  // 1. Initial auth check & database bootstrap
  useEffect(() => {
    initializeDB();

    getCurrentAuthUser()
      .then(user => {
        setCurrentUser(user);
      })
      .catch(err => {
        console.error('Error on initial auth check:', err);
        setCurrentUser(null);
      })
      .finally(() => {
        setAuthChecking(false);
      });

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const user = await getCurrentAuthUser();
        if (user) setCurrentUser(user);
      } else if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // 2. Supabase sync in background on startup and user change
  useEffect(() => {
    if (!currentUser) return;
    pullAllFromSupabase(currentUser.id)
      .then(() => {
        console.log('Supabase background pull complete!');
      })
      .catch(err => {
        console.error('Supabase initial pull failed, running in offline mode:', err);
      });
  }, [currentUser?.id]);

  // 3. Real-time synchronization
  useEffect(() => {
    if (!currentUser) return;
    const unsubscribe = setupRealtimeSync(() => {
      // Sync complete
    });
    return () => unsubscribe();
  }, [currentUser]);

  // Sync scroll position with activeTab
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    let isProgrammaticScroll = false;

    const handleScroll = () => {
      if (isProgrammaticScroll) return;
      
      const scrollLeft = container.scrollLeft;
      const width = container.clientWidth;
      const index = Math.round(scrollLeft / width);
      
      const tabs: TabType[] = ['habitos', 'tareas', 'tablon', 'ranking', 'estadisticas', 'perfil'];
      if (tabs[index] && tabs[index] !== activeTab) {
        setActiveTab(tabs[index]);
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [activeTab]);

  // Handle programmatic scroll when clicking bottom nav
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    const container = scrollContainerRef.current;
    if (container) {
      const tabs: TabType[] = ['habitos', 'tareas', 'tablon', 'ranking', 'estadisticas', 'perfil'];
      const index = tabs.indexOf(tab);
      const width = container.clientWidth;
      
      container.scrollTo({
        left: width * index,
        behavior: 'smooth'
      });
    }
  };

  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (currentUser) {
      const isDone = localStorage.getItem(`winterarc_onboarding_${ONBOARDING_VERSION}_${currentUser.id}`);
      if (!isDone) {
        setShowOnboarding(true);
      } else {
        setShowOnboarding(false);
      }
    }
  }, [currentUser?.id]);

  const handleAuthSuccess = (user: User, isNewUser: boolean) => {
    setCurrentUser(user);
    if (isNewUser) {
      setShowOnboarding(true);
    }
  };

  if (authChecking) {
    return (
      <div className="min-h-[100dvh] bg-brand-bg flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 rounded-full border-4 border-brand-border border-t-brand-primary animate-spin" />
        <p className="text-xs font-bold text-brand-text-muted uppercase tracking-widest">Iniciando Winter Arc...</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <PhoneContainer>
        <Welcome onAuthSuccess={handleAuthSuccess} />
      </PhoneContainer>
    );
  }

  if (showOnboarding) {
    return (
      <PhoneContainer>
        <OnboardingView 
          user={currentUser} 
          onComplete={(updatedUser) => {
            setCurrentUser(updatedUser);
            setShowOnboarding(false);
          }} 
        />
      </PhoneContainer>
    );
  }

  return (
    <PhoneContainer>
      <div 
        ref={scrollContainerRef}
        className="flex-1 min-h-0 w-full flex overflow-x-auto snap-x snap-mandatory hide-scrollbar"
        style={{ scrollBehavior: 'smooth' }}
      >
        <HabitsView user={currentUser} />
        <TasksView user={currentUser} />
        <ValueBoardView user={currentUser} onUserClick={setSelectedProfileId} />
        <RankingView user={currentUser} onUserClick={setSelectedProfileId} />
        <StatsView user={currentUser} />
        <PerfilView user={currentUser} />
      </div>

      <BottomNav 
        activeTab={activeTab}
        setActiveTab={handleTabChange}
      />
      
      {selectedProfileId && (
        <PublicProfileModal 
          user={allUsers.find(u => u.id === selectedProfileId)} 
          onClose={() => setSelectedProfileId(null)} 
        />
      )}
      
      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </PhoneContainer>
  );
}

export default App;
