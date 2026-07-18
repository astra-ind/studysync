import React, { useState, useMemo } from 'react';
import { CalendarEvent, MatchSlot } from '../types';
import { db, collection, addDoc } from '../lib/firebase';
import { USERS, HardcodedUser } from '../config';
import { expandEvents, findMatches, getLocalDateString, formatDuration } from '../utils/calendarUtils';
import { Sparkles, Calendar, Clock, ArrowRight, Zap, CheckCircle2, ChevronDown, Check } from 'lucide-react';

interface MatchFinderProps {
  currentUser: HardcodedUser;
  partner: HardcodedUser;
  events: CalendarEvent[];
}

export default function MatchFinder({ currentUser, partner, events }: MatchFinderProps) {
  const [sortBy, setSortBy] = useState<'duration' | 'earliest' | 'today' | 'week'>('earliest');
  const [bookingStatus, setBookingStatus] = useState<Record<string, 'idle' | 'booking' | 'booked'>>({});

  // Expand and find matches for the next 14 days to provide plenty of options
  const matches = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setDate(end.getDate() + 14); // Scan up to 14 days
    end.setHours(23, 59, 59, 999);

    const activeEvents = expandEvents(events, start, end);
    const userAEvents = activeEvents.filter((e) => e.userId === currentUser.id);
    const userBEvents = activeEvents.filter((e) => e.userId === partner.id);

    const rawMatches = findMatches(userAEvents, userBEvents, 14);

    // Apply sorting
    return [...rawMatches].sort((a, b) => {
      if (sortBy === 'earliest') {
        return a.start.getTime() - b.start.getTime();
      }
      if (sortBy === 'duration') {
        const durA = a.end.getTime() - a.start.getTime();
        const durB = b.end.getTime() - b.start.getTime();
        return durB - durA; // Longest first
      }
      if (sortBy === 'today') {
        const todayStr = getLocalDateString(new Date());
        const isTodayA = a.dateStr === todayStr ? 1 : 0;
        const isTodayB = b.dateStr === todayStr ? 1 : 0;
        if (isTodayA !== isTodayB) return isTodayB - isTodayA;
        return a.start.getTime() - b.start.getTime();
      }
      if (sortBy === 'week') {
        const now = new Date();
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay())).getTime();
        const endOfWeek = startOfWeek + 7 * 24 * 60 * 60 * 1000;
        
        const inWeekA = (a.start.getTime() >= startOfWeek && a.start.getTime() <= endOfWeek) ? 1 : 0;
        const inWeekB = (b.start.getTime() >= startOfWeek && b.start.getTime() <= endOfWeek) ? 1 : 0;
        if (inWeekA !== inWeekB) return inWeekB - inWeekA;
        return a.start.getTime() - b.start.getTime();
      }
      return 0;
    });
  }, [events, currentUser, partner, sortBy]);

  // Handle book session
  const handleBookSession = async (match: MatchSlot) => {
    setBookingStatus((prev) => ({ ...prev, [match.id]: 'booking' }));

    try {
      // 1. Create matching booked sessions for both users in Firebase
      const sessionTitle = `Locked Study Session: ${currentUser.name} + ${partner.name}`;
      
      const newEventA = {
        userId: currentUser.id,
        title: sessionTitle,
        type: 'studying' as const,
        start: match.start.toISOString(),
        end: match.end.toISOString(),
        recurrence: 'none' as const,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        notes: `Automatically booked from Match Finder overlap on ${match.dateStr}. Let's study!`,
        createdAt: new Date().toISOString(),
      };

      const newEventB = {
        userId: partner.id,
        title: sessionTitle,
        type: 'studying' as const,
        start: match.start.toISOString(),
        end: match.end.toISOString(),
        recurrence: 'none' as const,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        notes: `Automatically booked from Match Finder overlap on ${match.dateStr}. Let's study!`,
        createdAt: new Date().toISOString(),
      };

      // Push to Firestore
      await addDoc(collection(db, 'events'), newEventA);
      await addDoc(collection(db, 'events'), newEventB);

      // Create standard real-time notifications so partner sees the study lock
      await addDoc(collection(db, 'notifications'), {
        text: `🎉 Booked Shared Session! ${currentUser.name} locked-in study with ${partner.name} for ${match.dateStr} at ${match.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
        timestamp: new Date().toISOString(),
        unread: true,
        type: 'success',
      });

      setBookingStatus((prev) => ({ ...prev, [match.id]: 'booked' }));
    } catch (err) {
      console.error(err);
      setBookingStatus((prev) => ({ ...prev, [match.id]: 'idle' }));
    }
  };

  // Convert dateStr to readable label
  const getDayLabel = (dateStr: string) => {
    const today = getLocalDateString(new Date());
    const tomorrow = getLocalDateString(new Date(new Date().setDate(new Date().getDate() + 1)));
    
    if (dateStr === today) return 'Today';
    if (dateStr === tomorrow) return 'Tomorrow';
    
    const d = new Date(`${dateStr}T00:00:00`);
    return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
  };

  return (
    <div className="space-y-4">
      {/* Intro Match Card */}
      <div className="p-5 rounded-xl border border-slate-800 bg-gradient-to-br from-indigo-950/20 to-purple-950/20 backdrop-blur-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
        {/* Decorative glow */}
        <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-purple-500/10 blur-2xl pointer-events-none" />

        <div className="space-y-1">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-400 animate-bounce" />
            Automatic Overlap Matcher
          </h3>
          <p className="text-xs text-slate-400">
            Study Sync scans schedules in real-time to find continuous windows where you both are free or studying.
          </p>
        </div>

        {/* Sort selector */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-500 uppercase">Sort By:</span>
          <div className="flex bg-slate-950 border border-slate-800 rounded-lg p-0.5">
            {(['earliest', 'duration', 'today', 'week'] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => setSortBy(opt)}
                className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded transition cursor-pointer ${
                  sortBy === opt
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Matches Grid List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {matches.length === 0 ? (
          <div className="md:col-span-2 py-16 text-center border border-dashed border-slate-800 rounded-2xl bg-slate-900/5">
            <Sparkles className="h-8 w-8 text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-400 font-semibold">No Shared Study Windows Discovered</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Add some 'Free' or 'Studying' availability slots to your calendars and watch Study Sync find overlaps instantly!
            </p>
          </div>
        ) : (
          matches.map((match) => {
            const status = bookingStatus[match.id] || 'idle';
            const durationStr = formatDuration(match.start, match.end);
            
            let badgeStyle = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
            if (match.type === 'studying') badgeStyle = 'bg-sky-500/10 text-sky-400 border-sky-500/20';
            if (match.type === 'mixed') badgeStyle = 'bg-amber-500/10 text-amber-400 border-amber-500/20';

            const startStr = match.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const endStr = match.end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            return (
              <div
                key={match.id}
                className="p-4 rounded-xl border border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-950/70 transition flex items-center justify-between gap-4"
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">
                      {getDayLabel(match.dateStr)}
                    </span>
                    <span className={`text-[9px] font-bold uppercase border px-2 py-0.5 rounded-full ${badgeStyle}`}>
                      {match.label}
                    </span>
                  </div>

                  <p className="text-sm font-bold text-white flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-indigo-400 shrink-0" />
                    <span>{startStr} - {endStr}</span>
                  </p>

                  <p className="text-[10px] text-slate-400 font-medium">
                    Continuous Duration: <span className="text-slate-200 font-bold">{durationStr}</span>
                  </p>
                </div>

                <button
                  disabled={status !== 'idle'}
                  onClick={() => handleBookSession(match)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
                    status === 'booked'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : status === 'booking'
                      ? 'bg-slate-800 text-slate-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow shadow-indigo-500/10'
                  }`}
                >
                  {status === 'booked' ? (
                    <>
                      <Check className="h-4 w-4" />
                      <span>Booked!</span>
                    </>
                  ) : status === 'booking' ? (
                    <span>Syncing...</span>
                  ) : (
                    <>
                      <Zap className="h-4 w-4" />
                      <span>Lock Study</span>
                    </>
                  )}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
