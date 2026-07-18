// Study Sync Application Configuration
// Change these names to easily customize User A and User B.

export interface HardcodedUser {
  id: string;
  name: string;
  avatar: string; // Emoji or visual representation
  color: string;  // Primary theme color class
  accentColor: string; // Tailwind color name (e.g. 'indigo', 'rose')
  gradientFrom: string; // Gradient start
  gradientTo: string; // Gradient end
}

export const USER_A: HardcodedUser = {
  id: 'user_a',
  name: 'Alex',
  avatar: '🎒',
  color: 'text-cyan-400',
  accentColor: 'cyan',
  gradientFrom: 'from-cyan-500',
  gradientTo: 'to-blue-600',
};

export const USER_B: HardcodedUser = {
  id: 'user_b',
  name: 'Blake',
  avatar: '🧠',
  color: 'text-fuchsia-400',
  accentColor: 'fuchsia',
  gradientFrom: 'from-fuchsia-500',
  gradientTo: 'to-purple-600',
};

export const USERS = [USER_A, USER_B];

export const SLOT_TYPES = [
  { value: 'free', label: 'Free', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30', indicator: '🟢' },
  { value: 'studying', label: 'Studying', color: 'bg-sky-500/20 text-sky-400 border-sky-500/30 hover:bg-sky-500/30', indicator: '🔵' },
  { value: 'busy', label: 'Busy', color: 'bg-rose-500/20 text-rose-400 border-rose-500/30 hover:bg-rose-500/30', indicator: '🔴' },
  { value: 'maybe', label: 'Maybe Available', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30', indicator: '🟡' },
];

export const DAILY_STUDY_GOAL_HOURS = 4; // Daily study goal hours
