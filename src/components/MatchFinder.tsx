import React, { useState, useMemo } from 'react';
import { CalendarEvent, MatchSlot } from '../types';
import { db, collection, addDoc } from '../lib/firebase';
import { HardcodedUser } from '../config';
import { expandEvents, findMatches, getLocalDateString, formatDuration } from '../utils/calendarUtils';
import { Sparkles, Clock, Zap, Check } from 'lucide-react';

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
      <div className="p-5 rounded-xl border-2 border-[#D9D1C0] bg-white shadow-[4px_4px_0px_0px_rgba(217,209,192,0.4)] flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
        <div className="space-y-1.5 z-10">
          <h3 className="text-base font-serif font-black text-stone-900 flex items-center gap-2">
            <Sparkles className="h-4.5 w-4.5 text-amber-600 animate-bounce" />
            Automatic Overlap Matcher
          </h3>
          <p className="text-xs text-stone-500 font-sans leading-relaxed">
            Study Sync scans both agendas in real-time to find continuous windows where you both are free or studying.
          </p>
        </div>

        {/* Sort selector */}
        <div className="flex items-center gap-2 z-10">
          <span className="text-[10px] font-bold text-stone-400 uppercase font-mono tracking-wider">Sort:</span>
          <div className="flex bg-stone-100 border border-stone-200 rounded-lg p-0.5 shadow-inner">
            {(['earliest', 'duration', 'today', 'week'] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => setSortBy(opt)}
                className={`px-3 py-1 text-[10px] font-bold uppercase rounded-md transition cursor-pointer ${
                  sortBy === opt
                    ? 'bg-white text-stone-900 shadow-xs border border-stone-200/50'
                    : 'text-stone-500 hover:text-stone-800'
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
          <div className="md:col-span-2 py-16 text-center border-2 border-dashed border-stone-200 rounded-2xl bg-stone-50/40">
            <Sparkles className="h-8 w-8 text-stone-300 mx-auto mb-3" />
            <p className="text-xs font-serif italic text-stone-500">No shared study windows discovered in current ledger diaries.</p>
            <p className="text-[11px] text-stone-400 mt-1 max-w-sm mx-auto font-sans">
              Add some 'Free Space' or 'Studying' availability blocks to your calendars and watch Study Sync find overlaps instantly!
            </p>
          </div>
        ) : (
          matches.map((match) => {
            const status = bookingStatus[match.id] || 'idle';
            const durationStr = formatDuration(match.start, match.end);
            
            let badgeStyle = 'bg-emerald-50 text-emerald-950 border-emerald-300';
            if (match.type === 'studying') badgeStyle = 'bg-sky-50 text-sky-950 border-sky-300';
            if (match.type === 'mixed') badgeStyle = 'bg-amber-50 text-amber-950 border-amber-300';

            const startStr = match.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const endStr = match.end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            return (
              <div
                key={match.id}
                className="p-4 rounded-xl border-2 border-stone-200 bg-white hover:border-stone-400 hover:shadow-xs transition flex items-center justify-between gap-4"
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-stone-400 font-bold uppercase font-mono tracking-wider">
                      {getDayLabel(match.dateStr)}
                    </span>
                    <span className={`text-[9px] font-bold uppercase border-2 px-2 py-0.5 rounded-full ${badgeStyle}`}>
                      {match.label}
                    </span>
                  </div>

                  <p className="text-base font-black text-stone-900 flex items-center gap-1.5 font-mono">
                    <Clock className="h-4 w-4 text-stone-400 shrink-0" />
                    <span>{startStr} - {endStr}</span>
                  </p>

                  <p className="text-[10px] text-stone-500">
                    Continuous Duration: <strong className="text-stone-800 font-bold">{durationStr}</strong>
                  </p>
                </div>

                <button
                  disabled={status !== 'idle'}
                  onClick={() => handleBookSession(match)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shrink-0 border-2 ${
                    status === 'booked'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : status === 'booking'
                      ? 'bg-stone-100 text-stone-400 border-stone-200 cursor-not-allowed'
                      : 'bg-stone-900 hover:bg-stone-800 text-white border-stone-900 shadow-xs'
                  }`}
                >
                  {status === 'booked' ? (
                    <span className="flex items-center gap-1">
                      <Check className="h-4 w-4 text-emerald-700" />
                      <span>Booked!</span>
                    </span>
                  ) : status === 'booking' ? (
                    <span>Syncing...</span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <Zap className="h-3.5 w-3.5 text-amber-300" />
                      <span>Lock Study</span>
                    </span>
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
