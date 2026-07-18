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
  name: 'A',
  avatar: '🎒',
  color: 'text-indigo-700',
  accentColor: 'indigo',
  gradientFrom: 'from-indigo-600',
  gradientTo: 'to-blue-700',
};

export const USER_B: HardcodedUser = {
  id: 'user_b',
  name: 'G',
  avatar: '🧠',
  color: 'text-rose-800',
  accentColor: 'rose',
  gradientFrom: 'from-rose-600',
  gradientTo: 'to-amber-700',
};

export const USERS = [USER_A, USER_B];

export const SLOT_TYPES = [
  { value: 'free', label: 'Free Space', color: 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100', indicator: '🟢' },
  { value: 'studying', label: 'Focused Studying', color: 'bg-sky-50 text-sky-800 border-sky-300 hover:bg-sky-100', indicator: '🔵' },
  { value: 'busy', label: 'Busy / Unavailable', color: 'bg-stone-100 text-stone-800 border-stone-300 hover:bg-stone-200', indicator: '🔴' },
  { value: 'maybe', label: 'Maybe Available', color: 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100', indicator: '🟡' },
];

export const DAILY_STUDY_GOAL_HOURS = 4; // Daily study goal hours
