import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  X, Check, Lock, Sparkles, 
  Palette, Shield, Crown, Image as ImageIcon, Save
} from 'lucide-react';
import { User } from '../types';
import { 
  AVATAR_FRAMES, 
  NAME_COLORS, 
  WINTER_TITLES, 
  PRESET_AVATARS,
  getAvatarFrame,
  getNameColor
} from '../utils/profileCustomization';
import { updateUserProfile } from '../services/db';

interface EditProfileModalProps {
  user: User;
  onClose: () => void;
  onSaved: (updatedUser: User) => void;
}

type TabType = 'avatar' | 'frames' | 'colors' | 'titles';

export const EditProfileModal: React.FC<EditProfileModalProps> = ({ user, onClose, onSaved }) => {
  const { t } = useTranslation();
  
  const [activeTab, setActiveTab] = useState<TabType>('avatar');
  const [selectedAvatar, setSelectedAvatar] = useState(user.avatar_url || PRESET_AVATARS[1].url);
  const [selectedFrame, setSelectedFrame] = useState(user.avatar_frame || 'default');
  const [selectedColor, setSelectedColor] = useState(user.name_color || 'default');
  const [selectedTitle, setSelectedTitle] = useState(user.title || WINTER_TITLES[0].name);
  const [isSaved, setIsSaved] = useState(false);

  const currentFrameObj = getAvatarFrame(selectedFrame);
  const currentColorObj = getNameColor(selectedColor);

  const handleSave = () => {
    const updated = updateUserProfile(user.id, {
      avatar_url: selectedAvatar,
      avatar_frame: selectedFrame,
      name_color: selectedColor,
      title: selectedTitle
    });

    setIsSaved(true);
    setTimeout(() => {
      onSaved(updated);
      onClose();
    }, 500);
  };

  return (
    <div className="fixed inset-0 bg-brand-bg/80 z-[200] flex items-center justify-center p-3 sm:p-4 backdrop-blur-md animate-overlay-fade-in">
      <div className="w-full max-w-lg max-h-[92vh] bg-brand-card border border-brand-border rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-scale-up">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-brand-border/60 flex items-center justify-between flex-shrink-0 bg-brand-card-sec/30">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center">
              <Sparkles size={16} />
            </div>
            <h2 className="text-base font-display font-extrabold text-brand-text">
              {t('Personalizar Perfil')}
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-full bg-brand-card hover:bg-brand-card-sec text-brand-text-muted hover:text-brand-text transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Live Preview Box */}
        <div className="p-4 bg-gradient-to-b from-brand-card-sec/50 to-brand-card border-b border-brand-border/40 flex-shrink-0">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-brand-text-muted mb-2 text-center">
            {t('Vista Previa en Vivo')}
          </p>
          <div className="bg-brand-bg/90 border border-brand-border/80 rounded-2xl p-3.5 flex items-center space-x-3.5 shadow-inner">
            {/* Avatar with Frame */}
            <div className="relative flex-shrink-0">
              <img 
                src={selectedAvatar} 
                alt="Preview" 
                className={`w-14 h-14 rounded-full object-cover transition-all duration-300 ${currentFrameObj.borderClass} ${currentFrameObj.glowClass}`}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = PRESET_AVATARS[1].url;
                }}
              />
              <span className={`absolute -bottom-1 -right-1 text-[9px] font-black px-1.5 py-0.2 rounded-full border border-black/40 ${currentFrameObj.badgeColor || 'bg-brand-primary text-black'}`}>
                Nv.{user.level || 1}
              </span>
            </div>

            {/* Name, Username and Title */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-1.5 flex-wrap">
                <span className={`text-sm font-extrabold truncate ${currentColorObj.textClass}`}>
                  {user.name}
                </span>
                {selectedTitle && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-brand-primary/10 text-brand-primary border border-brand-primary/20 truncate">
                    {selectedTitle}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-brand-text-muted font-medium truncate mt-0.5">
                @{user.username || user.name.toLowerCase()}
              </p>
            </div>
          </div>
        </div>

        {/* Tabs navigation */}
        <div className="flex border-b border-brand-border/40 bg-brand-card-sec/20 flex-shrink-0 px-2 overflow-x-auto hide-scrollbar">
          <button 
            onClick={() => setActiveTab('avatar')}
            className={`px-3.5 py-2.5 text-xs font-extrabold flex items-center space-x-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'avatar' 
                ? 'border-brand-primary text-brand-primary' 
                : 'border-transparent text-brand-text-muted hover:text-brand-text'
            }`}
          >
            <ImageIcon size={14} />
            <span>{t('Avatar')}</span>
          </button>

          <button 
            onClick={() => setActiveTab('frames')}
            className={`px-3.5 py-2.5 text-xs font-extrabold flex items-center space-x-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'frames' 
                ? 'border-brand-primary text-brand-primary' 
                : 'border-transparent text-brand-text-muted hover:text-brand-text'
            }`}
          >
            <Shield size={14} />
            <span>{t('Marcos')}</span>
          </button>

          <button 
            onClick={() => setActiveTab('colors')}
            className={`px-3.5 py-2.5 text-xs font-extrabold flex items-center space-x-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'colors' 
                ? 'border-brand-primary text-brand-primary' 
                : 'border-transparent text-brand-text-muted hover:text-brand-text'
            }`}
          >
            <Palette size={14} />
            <span>{t('Color Nombre')}</span>
          </button>

          <button 
            onClick={() => setActiveTab('titles')}
            className={`px-3.5 py-2.5 text-xs font-extrabold flex items-center space-x-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'titles' 
                ? 'border-brand-primary text-brand-primary' 
                : 'border-transparent text-brand-text-muted hover:text-brand-text'
            }`}
          >
            <Crown size={14} />
            <span>{t('Títulos')}</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 hide-scrollbar">
          
          {/* TAB: AVATAR GRADIENTS */}
          {activeTab === 'avatar' && (
            <div className="space-y-3">
              <p className="text-[11px] text-brand-text-muted">
                {t('Elige el degradado de color para tu avatar del Winter Arc.')}
              </p>
              <div className="grid grid-cols-3 gap-3">
                {PRESET_AVATARS.map(avatar => {
                  const isSelected = selectedAvatar === avatar.url;
                  return (
                    <div 
                      key={avatar.id}
                      onClick={() => setSelectedAvatar(avatar.url)}
                      className={`p-2.5 rounded-2xl border flex flex-col items-center space-y-2 cursor-pointer transition-all active:scale-95 ${
                        isSelected 
                          ? 'bg-brand-primary/15 border-brand-primary ring-2 ring-brand-primary/60 shadow-md' 
                          : 'bg-brand-card-sec/50 border-brand-border/60 hover:border-brand-border hover:bg-brand-card-sec'
                      }`}
                    >
                      {/* Gradient Circle */}
                      <div 
                        className="w-12 h-12 rounded-full border border-white/20 shadow-inner flex items-center justify-center relative"
                        style={{ background: avatar.cssGradient }}
                      >
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-white text-black flex items-center justify-center shadow-md">
                            <Check size={12} strokeWidth={3} />
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] font-bold text-brand-text text-center truncate w-full">
                        {avatar.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB: FRAMES */}
          {activeTab === 'frames' && (
            <div className="space-y-2.5">
              <p className="text-[11px] text-brand-text-muted">
                {t('Desbloquea marcos subiendo de nivel con tu consistencia diaria.')}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {AVATAR_FRAMES.map(frame => {
                  const isUnlocked = (user.level || 1) >= frame.minLevel;
                  const isSelected = selectedFrame === frame.id;

                  return (
                    <div 
                      key={frame.id}
                      onClick={() => isUnlocked && setSelectedFrame(frame.id)}
                      className={`p-3 rounded-2xl border transition-all flex items-center space-x-3 relative ${
                        isSelected 
                          ? 'bg-brand-primary/10 border-brand-primary ring-1 ring-brand-primary shadow-sm' 
                          : isUnlocked 
                            ? 'bg-brand-card-sec/50 border-brand-border/60 hover:border-brand-border hover:bg-brand-card-sec cursor-pointer' 
                            : 'bg-brand-card-sec/20 border-brand-border/30 opacity-60 cursor-not-allowed'
                      }`}
                    >
                      {/* Frame circle preview */}
                      <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center relative">
                        <img 
                          src={selectedAvatar} 
                          alt="" 
                          className={`w-10 h-10 rounded-full object-cover ${frame.borderClass} ${frame.glowClass}`} 
                        />
                      </div>

                      {/* Frame description */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-1.5">
                          <p className="text-xs font-bold text-brand-text truncate">{frame.name}</p>
                        </div>
                        <p className="text-[10px] text-brand-text-muted truncate">{frame.description}</p>
                      </div>

                      {/* Status lock/check */}
                      <div className="flex-shrink-0">
                        {isSelected ? (
                          <div className="w-5 h-5 rounded-full bg-brand-primary text-black flex items-center justify-center">
                            <Check size={12} strokeWidth={3} />
                          </div>
                        ) : isUnlocked ? (
                          <span className="text-[10px] font-bold text-emerald-400">Nv.{frame.minLevel}</span>
                        ) : (
                          <div className="flex items-center space-x-1 text-[10px] font-bold text-brand-text-muted bg-brand-bg/80 px-1.5 py-0.5 rounded">
                            <Lock size={10} />
                            <span>Nv.{frame.minLevel}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB: NAME COLORS */}
          {activeTab === 'colors' && (
            <div className="space-y-2.5">
              <p className="text-[11px] text-brand-text-muted">
                {t('Personaliza el color de tu nombre en el perfil, tablón de valor y ranking.')}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {NAME_COLORS.map(color => {
                  const isUnlocked = (user.level || 1) >= color.minLevel;
                  const isSelected = selectedColor === color.id;

                  return (
                    <div 
                      key={color.id}
                      onClick={() => isUnlocked && setSelectedColor(color.id)}
                      className={`p-3 rounded-2xl border transition-all flex items-center justify-between relative ${
                        isSelected 
                          ? 'bg-brand-primary/10 border-brand-primary ring-1 ring-brand-primary shadow-sm' 
                          : isUnlocked 
                            ? 'bg-brand-card-sec/50 border-brand-border/60 hover:border-brand-border hover:bg-brand-card-sec cursor-pointer' 
                            : 'bg-brand-card-sec/20 border-brand-border/30 opacity-60 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div 
                          className="w-5 h-5 rounded-full border border-white/20 shadow-sm flex-shrink-0"
                          style={{ background: color.hexPreview }}
                        />
                        <span className={`text-xs font-bold ${color.textClass}`}>
                          {color.name}
                        </span>
                      </div>

                      <div>
                        {isSelected ? (
                          <div className="w-5 h-5 rounded-full bg-brand-primary text-black flex items-center justify-center">
                            <Check size={12} strokeWidth={3} />
                          </div>
                        ) : isUnlocked ? (
                          <span className="text-[10px] font-bold text-emerald-400">Nv.{color.minLevel}</span>
                        ) : (
                          <div className="flex items-center space-x-1 text-[10px] font-bold text-brand-text-muted bg-brand-bg/80 px-1.5 py-0.5 rounded">
                            <Lock size={10} />
                            <span>Nv.{color.minLevel}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB: WINTER TITLES */}
          {activeTab === 'titles' && (
            <div className="space-y-2.5">
              <p className="text-[11px] text-brand-text-muted">
                {t('Elige el título honorífico que acompañará tu nombre según tu nivel.')}
              </p>
              <div className="space-y-2">
                {WINTER_TITLES.map(titleItem => {
                  const isUnlocked = (user.level || 1) >= titleItem.minLevel;
                  const isSelected = selectedTitle === titleItem.name;

                  return (
                    <div 
                      key={titleItem.id}
                      onClick={() => isUnlocked && setSelectedTitle(titleItem.name)}
                      className={`p-3 rounded-2xl border transition-all flex items-center justify-between ${
                        isSelected 
                          ? 'bg-brand-primary/10 border-brand-primary ring-1 ring-brand-primary' 
                          : isUnlocked 
                            ? 'bg-brand-card-sec/50 border-brand-border/60 hover:bg-brand-card-sec cursor-pointer' 
                            : 'bg-brand-card-sec/20 border-brand-border/30 opacity-60 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5">
                        <Crown size={15} className={isSelected ? 'text-brand-primary' : 'text-brand-text-muted'} />
                        <span className="text-xs font-bold text-brand-text">{titleItem.name}</span>
                      </div>

                      <div>
                        {isSelected ? (
                          <div className="w-5 h-5 rounded-full bg-brand-primary text-black flex items-center justify-center">
                            <Check size={12} strokeWidth={3} />
                          </div>
                        ) : isUnlocked ? (
                          <span className="text-[10px] font-bold text-emerald-400">Desbloqueado</span>
                        ) : (
                          <div className="flex items-center space-x-1 text-[10px] font-bold text-brand-text-muted bg-brand-bg/80 px-1.5 py-0.5 rounded">
                            <Lock size={10} />
                            <span>Nv.{titleItem.minLevel}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* Save Footer */}
        <div className="p-4 border-t border-brand-border/60 bg-brand-card flex-shrink-0 flex items-center justify-between">
          <button 
            onClick={onClose}
            className="px-4 py-2.5 text-xs font-bold text-brand-text-muted hover:text-brand-text transition-colors cursor-pointer"
          >
            {t('Cancelar')}
          </button>

          <button 
            onClick={handleSave}
            disabled={isSaved}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center space-x-1.5 transition-all shadow-md active:scale-95 cursor-pointer ${
              isSaved 
                ? 'bg-emerald-500 text-white' 
                : 'bg-brand-primary hover:bg-brand-primary-active text-black font-extrabold'
            }`}
          >
            {isSaved ? (
              <>
                <Check size={16} />
                <span>{t('¡Guardado!')}</span>
              </>
            ) : (
              <>
                <Save size={16} />
                <span>{t('Guardar Cambios')}</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
