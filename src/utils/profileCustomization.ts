export interface AvatarFrame {
  id: string;
  name: string;
  minLevel: number;
  borderClass: string;
  glowClass: string;
  badgeColor: string;
  description: string;
}

export interface NameColor {
  id: string;
  name: string;
  minLevel: number;
  textClass: string;
  hexPreview: string;
}

export interface WinterTitle {
  id: string;
  name: string;
  minLevel: number;
}

export interface PresetAvatar {
  id: string;
  label: string;
  cssGradient: string;
  url: string;
}

function createGradientSvg(c1: string, c2: string, c3?: string): string {
  const stops = c3
    ? `<stop offset="0%" stop-color="${c1}"/><stop offset="50%" stop-color="${c2}"/><stop offset="100%" stop-color="${c3}"/>`
    : `<stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">${stops}</linearGradient></defs><rect width="100" height="100" fill="url(#g)"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const AVATAR_FRAMES: AvatarFrame[] = [
  {
    id: 'default',
    name: 'Iniciado',
    minLevel: 1,
    borderClass: 'border-2 border-brand-border',
    glowClass: '',
    badgeColor: 'bg-zinc-500/20 text-zinc-400',
    description: 'Borde limpio y sobrio'
  },
  {
    id: 'bronze',
    name: 'Bronce Forjado',
    minLevel: 3,
    borderClass: 'border-2 border-amber-700/80 ring-2 ring-amber-600/30',
    glowClass: 'shadow-[0_0_12px_rgba(180,83,9,0.35)]',
    badgeColor: 'bg-amber-800/30 text-amber-500 border border-amber-700/40',
    description: 'Forjado en los primeros pasos'
  },
  {
    id: 'silver',
    name: 'Plata Invernal',
    minLevel: 5,
    borderClass: 'border-2 border-slate-300 ring-2 ring-slate-400/40',
    glowClass: 'shadow-[0_0_15px_rgba(203,213,225,0.4)]',
    badgeColor: 'bg-slate-700/30 text-slate-200 border border-slate-500/40',
    description: 'Resplandor frío y constante'
  },
  {
    id: 'gold',
    name: 'Oro Ártico',
    minLevel: 8,
    borderClass: 'border-2 border-[#FFD700] ring-2 ring-[#FFD700]/50',
    glowClass: 'shadow-[0_0_18px_rgba(255,215,0,0.45)]',
    badgeColor: 'bg-amber-400/20 text-[#FFD700] border border-amber-400/40',
    description: 'Dorado puro para los disciplinados'
  },
  {
    id: 'ice',
    name: 'Hielo Winter Arc',
    minLevel: 12,
    borderClass: 'border-2 border-cyan-400 ring-4 ring-cyan-500/30',
    glowClass: 'shadow-[0_0_22px_rgba(6,182,212,0.55)]',
    badgeColor: 'bg-cyan-500/20 text-cyan-400 border border-cyan-400/40',
    description: 'Escarcha polar indestructible'
  },
  {
    id: 'fire',
    name: 'Fuego de Voluntad',
    minLevel: 16,
    borderClass: 'border-2 border-rose-500 ring-4 ring-rose-500/30',
    glowClass: 'shadow-[0_0_24px_rgba(244,63,94,0.55)]',
    badgeColor: 'bg-rose-500/20 text-rose-400 border border-rose-400/40',
    description: 'Llama inextinguible en el frío'
  },
  {
    id: 'purple',
    name: 'Sombra del Abismo',
    minLevel: 20,
    borderClass: 'border-2 border-purple-500 ring-4 ring-purple-500/30',
    glowClass: 'shadow-[0_0_25px_rgba(168,85,247,0.55)]',
    badgeColor: 'bg-purple-500/20 text-purple-400 border border-purple-400/40',
    description: 'Místico y temido por la pereza'
  },
  {
    id: 'legend',
    name: 'Monolito Supremo',
    minLevel: 25,
    borderClass: 'border-2 border-amber-300 ring-4 ring-amber-400/60 animate-pulse',
    glowClass: 'shadow-[0_0_30px_rgba(251,191,36,0.7)]',
    badgeColor: 'bg-gradient-to-r from-amber-500/30 to-yellow-500/30 text-amber-300 border border-amber-300/60',
    description: 'La cumbre del Winter Arc'
  }
];

export const NAME_COLORS: NameColor[] = [
  {
    id: 'default',
    name: 'Titanio Nórdico',
    minLevel: 1,
    textClass: 'text-brand-text font-bold',
    hexPreview: 'linear-gradient(135deg, #94a3b8, #475569)'
  },
  {
    id: 'cyan',
    name: 'Azul Glaciar Escarcha',
    minLevel: 3,
    textClass: 'text-cyan-400 font-extrabold drop-shadow-[0_0_8px_rgba(34,211,238,0.4)]',
    hexPreview: 'linear-gradient(135deg, #38bdf8, #06b6d4)'
  },
  {
    id: 'gold',
    name: 'Oro Imperial 24K',
    minLevel: 5,
    textClass: 'bg-gradient-to-r from-amber-300 via-yellow-300 to-amber-500 bg-clip-text text-transparent font-extrabold drop-shadow-[0_0_8px_rgba(245,158,11,0.4)]',
    hexPreview: 'linear-gradient(135deg, #fde047, #d97706)'
  },
  {
    id: 'emerald',
    name: 'Verde Esmeralda Titán',
    minLevel: 8,
    textClass: 'bg-gradient-to-r from-emerald-300 via-teal-400 to-emerald-500 bg-clip-text text-transparent font-extrabold drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]',
    hexPreview: 'linear-gradient(135deg, #6ee7b7, #059669)'
  },
  {
    id: 'purple',
    name: 'Púrpura Amatista Real',
    minLevel: 12,
    textClass: 'bg-gradient-to-r from-purple-400 via-fuchsia-400 to-indigo-400 bg-clip-text text-transparent font-extrabold drop-shadow-[0_0_8px_rgba(168,85,247,0.4)]',
    hexPreview: 'linear-gradient(135deg, #c084fc, #9333ea)'
  },
  {
    id: 'rose',
    name: 'Rubí Fuego Carmesí',
    minLevel: 16,
    textClass: 'bg-gradient-to-r from-rose-400 via-red-500 to-orange-500 bg-clip-text text-transparent font-extrabold drop-shadow-[0_0_8px_rgba(244,63,94,0.4)]',
    hexPreview: 'linear-gradient(135deg, #f43f5e, #dc2626)'
  },
  {
    id: 'legend',
    name: 'Diamante Celestial Cósmico',
    minLevel: 20,
    textClass: 'bg-gradient-to-r from-cyan-300 via-indigo-300 to-fuchsia-300 bg-clip-text text-transparent font-black tracking-wide drop-shadow-[0_0_10px_rgba(168,85,247,0.6)]',
    hexPreview: 'linear-gradient(135deg, #67e8f9, #a855f7, #f43f5e)'
  }
];

export const WINTER_TITLES: WinterTitle[] = [
  { id: 'iniciado', name: 'Iniciado del Frío', minLevel: 1 },
  { id: 'constancia', name: 'Constancia de Hierro', minLevel: 3 },
  { id: 'disciplina', name: 'Disciplina de Acero', minLevel: 5 },
  { id: 'guerrero', name: 'Guerrero Polar', minLevel: 8 },
  { id: 'monolito', name: 'Monolito Inquebrantable', minLevel: 12 },
  { id: 'fuerza', name: 'Fuerza del Invierno', minLevel: 16 },
  { id: 'leyenda', name: 'Leyenda del Winter Arc', minLevel: 20 }
];

export const PRESET_AVATARS: PresetAvatar[] = [
  {
    id: 'burgundy_abyss',
    label: 'Rojo Burdeos',
    cssGradient: 'linear-gradient(135deg, #881337 0%, #4c0519 50%, #1f0408 100%)',
    url: createGradientSvg('#881337', '#4c0519', '#1f0408')
  },
  {
    id: 'arctic_glacier',
    label: 'Azul Glaciar',
    cssGradient: 'linear-gradient(135deg, #0284c7 0%, #0369a1 40%, #0f172a 100%)',
    url: createGradientSvg('#0284c7', '#0369a1', '#0f172a')
  },
  {
    id: 'solar_amber',
    label: 'Amarillo Ámbar',
    cssGradient: 'linear-gradient(135deg, #d97706 0%, #b45309 50%, #451a03 100%)',
    url: createGradientSvg('#d97706', '#b45309', '#451a03')
  },
  {
    id: 'royal_amethyst',
    label: 'Morado Obsidiana',
    cssGradient: 'linear-gradient(135deg, #7e22ce 0%, #581c87 50%, #1e1b4b 100%)',
    url: createGradientSvg('#7e22ce', '#581c87', '#1e1b4b')
  },
  {
    id: 'emerald_titan',
    label: 'Verde Esmeralda',
    cssGradient: 'linear-gradient(135deg, #059669 0%, #065f46 50%, #022c22 100%)',
    url: createGradientSvg('#059669', '#065f46', '#022c22')
  },
  {
    id: 'stealth_carbon',
    label: 'Negro Carbón',
    cssGradient: 'linear-gradient(135deg, #3f3f46 0%, #18181b 50%, #09090b 100%)',
    url: createGradientSvg('#3f3f46', '#18181b', '#09090b')
  },
  {
    id: 'electric_azure',
    label: 'Azul Eléctrico',
    cssGradient: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 50%, #0f172a 100%)',
    url: createGradientSvg('#3b82f6', '#1d4ed8', '#0f172a')
  },
  {
    id: 'magma_crimson',
    label: 'Fuego Magma',
    cssGradient: 'linear-gradient(135deg, #ea580c 0%, #c2410c 50%, #431407 100%)',
    url: createGradientSvg('#ea580c', '#c2410c', '#431407')
  },
  {
    id: 'cosmic_aurora',
    label: 'Rosa Cósmico',
    cssGradient: 'linear-gradient(135deg, #be185d 0%, #831843 50%, #18030e 100%)',
    url: createGradientSvg('#be185d', '#831843', '#18030e')
  }
];

export function getAvatarFrame(frameId?: string): AvatarFrame {
  return AVATAR_FRAMES.find(f => f.id === frameId) || AVATAR_FRAMES[0];
}

export function getNameColor(colorId?: string): NameColor {
  return NAME_COLORS.find(c => c.id === colorId) || NAME_COLORS[0];
}

export function getAvatarFrameClasses(frameId?: string): string {
  const frame = getAvatarFrame(frameId);
  return `${frame.borderClass} ${frame.glowClass}`.trim();
}

export function getNameColorClass(colorId?: string): string {
  const color = getNameColor(colorId);
  return color.textClass;
}
