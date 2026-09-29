import React from 'react';

interface PhoneContainerProps {
  children: React.ReactNode;
}

export const PhoneContainer: React.FC<PhoneContainerProps> = ({ children }) => {
  return (
    <div className="fixed inset-0 w-full overflow-hidden bg-[#070707] flex items-center justify-center p-0 sm:p-4 md:p-6">
      {/* Sleek Device Mock Wrapper */}
      <div className="relative w-full max-w-md sm:w-[390px] h-full sm:h-[844px] bg-brand-bg sm:rounded-[48px] sm:border-[8px] sm:border-[#1E1E22] sm:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.95),inset_0_0_2px_rgba(255,255,255,0.15)] overflow-hidden flex flex-col transition-all duration-300">
        
        {/* Notch / Dynamic Island Simulation for Desktop */}
        <div className="hidden sm:flex absolute top-0 left-1/2 -translate-x-1/2 w-[110px] h-[30px] bg-[#1E1E22] rounded-b-[20px] z-50 items-center justify-center border-b border-x border-brand-border">
          <div className="w-[10px] h-[10px] rounded-full bg-brand-card mr-2 border border-brand-border flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-brand-primary/30"></div>
          </div>
          <div className="w-[32px] h-[4px] rounded-full bg-[#2E2E35]"></div>
        </div>

        {/* Home Indicator Simulation for Desktop */}
        <div className="hidden sm:block absolute bottom-1.5 left-1/2 -translate-x-1/2 w-[120px] h-[4px] bg-[#2E2E35] rounded-full z-50 pointer-events-none"></div>

        {/* Dynamic Background for Dark Mode (Onboarding Aesthetic) */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden hidden dark:block">
          <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-brand-primary/10 rounded-full blur-[120px] animate-pulse-glow"></div>
          <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-[#5F73FF]/10 rounded-full blur-[100px] animate-pulse-glow" style={{ animationDelay: '1s' }}></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.02)_0%,transparent_100%)] mix-blend-overlay"></div>
        </div>

        {/* Main Content Area (Fixed layout, inner content handles scroll) */}
        <div className="flex-1 flex flex-col overflow-hidden relative z-10 h-full">
          {children}
        </div>
      </div>
    </div>
  );
};
