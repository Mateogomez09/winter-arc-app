import { User, Goal, Habit, Task, Friendship, Tribe, TribeMember, Challenge, ChallengeParticipant, Badge, UserBadge, Notification, Masterclass, SaleTransaction } from '../types';

export const SEED_USERS: User[] = [];

export const SEED_BADGES: Badge[] = [
  {
    id: 'badge_first_streak',
    name: 'Iniciación',
    description: 'Completaste tu primer hábito y comenzaste una racha.',
    icon: 'Zap',
    rarity: 'common'
  },
  {
    id: 'badge_streak_7',
    name: 'Semana de Fuego',
    description: 'Mantén una racha de consistencia de 7 días.',
    icon: 'Flame',
    rarity: 'common'
  },
  {
    id: 'badge_streak_30',
    name: 'Hábito de Acero',
    description: 'Alcanza una racha de consistencia de 30 días.',
    icon: 'Shield',
    rarity: 'rare'
  },
  {
    id: 'badge_streak_100',
    name: 'Mente Indomable',
    description: 'Consigue una racha de consistencia de 100 días.',
    icon: 'Crown',
    rarity: 'epic'
  },
  {
    id: 'badge_streak_365',
    name: 'El Camino del Guerrero',
    description: 'Completa 365 días de consistencia ininterrumpida.',
    icon: 'Award',
    rarity: 'legendary'
  },
  {
    id: 'badge_first_challenge',
    name: 'Primer Logro',
    description: 'Gana tu primer desafío privado con amigos.',
    icon: 'Trophy',
    rarity: 'common'
  },
  {
    id: 'badge_challenges_10',
    name: 'Competidor Elite',
    description: 'Gana 10 desafíos privados.',
    icon: 'Sparkles',
    rarity: 'epic'
  },
  {
    id: 'badge_tribe_created',
    name: 'Líder de Tribu',
    description: 'Crea tu primera tribu para avanzar en grupo.',
    icon: 'Users',
    rarity: 'common'
  },
  {
    id: 'badge_tribe_streak_30',
    name: 'Sinergia Pura',
    description: 'Racha de tribu de 30 días consecutivos.',
    icon: 'TrendingUp',
    rarity: 'rare'
  },
  {
    id: 'badge_tribe_streak_365',
    name: 'Un Año de Tribu',
    description: 'Mantén una racha grupal de 365 días.',
    icon: 'Heart',
    rarity: 'legendary'
  },
  {
    id: 'badge_first_friend',
    name: 'Pacto de Disciplina',
    description: 'Agrega a tu primer amigo.',
    icon: 'UserPlus',
    rarity: 'common'
  },
  {
    id: 'badge_perfect_week',
    name: 'Semana Perfecta',
    description: 'Completa todos tus hábitos cada día durante una semana completa.',
    icon: 'CheckSquare',
    rarity: 'rare'
  },
  {
    id: 'badge_perfect_month',
    name: 'Mes Imparable',
    description: 'Consigue un mes 100% perfecto de consistencia.',
    icon: 'Calendar',
    rarity: 'epic'
  }
];

export const SEED_USER_BADGES: UserBadge[] = [];
export const SEED_GOALS: Goal[] = [];
export const SEED_HABITS: Habit[] = [];
export const SEED_TASKS: Task[] = [];
export const SEED_FRIENDSHIPS: Friendship[] = [];
export const SEED_TRIBES: Tribe[] = [];
export const SEED_TRIBE_MEMBERS: TribeMember[] = [];
export const SEED_CHALLENGES: Challenge[] = [];
export const SEED_CHALLENGE_PARTICIPANTS: ChallengeParticipant[] = [];
export const SEED_NOTIFICATIONS: Notification[] = [];
export const SEED_MASTERCLASSES: Masterclass[] = [];
export const SEED_TRANSACTIONS: SaleTransaction[] = [];
