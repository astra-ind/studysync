export type SlotType = 'free' | 'studying' | 'busy' | 'maybe';

export interface CalendarEvent {
  id: string;
  userId: string; // 'user_a' | 'user_b'
  title: string;
  type: SlotType;
  start: string; // ISO string
  end: string;   // ISO string
  recurrence: 'none' | 'daily' | 'weekly' | 'monthly';
  timezone: string;
  topic?: string;
  checklist?: { id: string; text: string; done: boolean }[];
  notes?: string;
  createdAt: string;
}

export interface MatchSlot {
  id: string;
  dateStr: string; // YYYY-MM-DD
  start: Date;
  end: Date;
  type: 'free' | 'studying' | 'mixed'; // mixed = one free, one studying
  label: string; // e.g. "Both Free", "Study Together", "Longest Shared Slot"
}

export interface StudyGoal {
  dailyHours: number;
  streakDays: number;
}

export interface NotificationMsg {
  id: string;
  text: string;
  timestamp: string; // ISO string
  unread: boolean;
  type: 'info' | 'success' | 'warning' | 'alert';
}
