import React, { useState, useMemo } from 'react';
import { CalendarEvent } from '../types';
import { HardcodedUser } from '../config';
import { calculateSharedGrid, getLocalDateString, TimeInterval } from '../utils/calendarUtils';
import { Users, ChevronLeft, ChevronRight, Sparkles, Clock, Calendar } from 'lucide-react';

interface SharedCalendarProps {
  userA: HardcodedUser;
  userB: HardcodedUser;
  events: CalendarEvent[];
}

export default function SharedCalendar({ userA, userB, events }: SharedCalendarProps) {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [view, setView] = useState<'week' | 'day'>('week');

  // Load events for both users
  const eventsA = useMemo(() => events.filter((e) => e.userId === userA.id), [events, userA]);
  const eventsB = useMemo(() => events.filter((e) => e.userId === userB.id), [events, userB]);

  // Generate week dates (Sunday to Saturday)
  const weekDates = useMemo(() => {
    const start = new Date(currentDate);
    start.setDate(start.getDate() - start.getDay());
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    return days;
  }, [currentDate]);

  const handlePrev = () => {
    const next = new Date(currentDate);
    next.setDate(next.getDate() - (view === 'week' ? 7 : 1));
    setCurrentDate(next);
  };

  const handleNext = () => {
    const next = new Date(currentDate);
    next.setDate(next.getDate() + (view === 'week' ? 7 : 1));
    setCurrentDate(next);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Pre-calculate merged grids for each date in active view
  const activeDates = view === 'week' ? weekDates : [currentDate];
  
  const mergedGridsByDate = useMemo(() => {
    const map: Record<string, TimeInterval[]> = {};
    activeDates.forEach((d) => {
      const dateStr = getLocalDateString(d);
      map[dateStr] = calculateSharedGrid(eventsA, eventsB, dateStr);
    });
    return map;
  }, [activeDates, eventsA, eventsB]);

  const hoursArray = Array.from({ length: 24 }, (_, i) => i);

  // Helper to resolve styles for merged status
  const getMergedStyle = (status: string) => {
    switch (status) {
      case 'green':
        return 'bg-emerald-50 border-2 border-emerald-300 text-emerald-950 font-bold';
      case 'blue':
        return 'bg-sky-50 border-2 border-sky-300 text-sky-950 font-bold';
      case 'orange':
        return 'bg-amber-50 border-2 border-amber-300 text-amber-950 font-black';
      case 'red':
        return 'bg-rose-50 border-2 border-rose-200 text-rose-950 font-bold';
      case 'grey':
        return 'bg-stone-100 border-2 border-stone-300 text-stone-800';
      default:
        return 'bg-transparent border-transparent';
    }
  };

  // Resolve human label for merged state
  const getMergedLabel = (interval: TimeInterval) => {
    const { statusA, statusB, mergedStatus } = interval;
    if (mergedStatus === 'none') return 'Unscheduled';

    const labelA = statusA === 'none' ? 'No Schedule' : statusA.toUpperCase();
    const labelB = statusB === 'none' ? 'No Schedule' : statusB.toUpperCase();

    let desc = `${userA.name}: ${labelA} | ${userB.name}: ${labelB}`;
    
    if (mergedStatus === 'green') return `🎉 BOTH CHILLING / FREE (${desc})`;
    if (mergedStatus === 'blue') return `⚡ BOTH STUDYING NOW (${desc})`;
    if (mergedStatus === 'orange') return `🤝 OPPORTUNITY: One Free, One Study (${desc})`;
    if (mergedStatus === 'red') return `🔴 BUSY: Someone is busy (${desc})`;
    if (mergedStatus === 'grey') return `⚠️ MISMATCH / CONFLICT (${desc})`;
    return desc;
  };

  return (
    <div className="space-y-4">
      {/* Overview Intro Card */}
      <div className="p-4 rounded-xl border-2 border-[#D9D1C0] bg-white shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-stone-100 border border-stone-200 rounded-lg text-stone-800 shrink-0">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wider font-mono">Ledger Synchronization</h3>
            <p className="text-xs text-stone-500 font-serif leading-relaxed">
              Comparison overlay for <strong className="text-stone-700 font-bold">{userA.name}</strong> &amp; <strong className="text-stone-700 font-bold">{userB.name}</strong>.
            </p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-2 text-[9px] font-bold font-mono uppercase tracking-wider">
          <div className="flex items-center gap-1 bg-emerald-50 border-2 border-emerald-300 px-2 py-1 rounded-md text-emerald-900">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>Both Free</span>
          </div>
          <div className="flex items-center gap-1 bg-sky-50 border-2 border-sky-300 px-2 py-1 rounded-md text-sky-900">
            <span className="h-2 w-2 rounded-full bg-sky-500" />
            <span>Both Studying</span>
          </div>
          <div className="flex items-center gap-1 bg-amber-50 border-2 border-amber-300 px-2 py-1 rounded-md text-amber-900">
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            <span>1 Free + 1 Study</span>
          </div>
          <div className="flex items-center gap-1 bg-rose-50 border-2 border-rose-200 px-2 py-1 rounded-md text-rose-900">
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            <span>Busy State</span>
          </div>
        </div>
      </div>

      {/* Shared Calendar Core */}
      <div className="rounded-2xl border-2 border-[#D9D1C0] bg-white shadow-[4px_4px_0px_0px_rgba(217,209,192,0.4)] overflow-hidden flex flex-col">
        {/* Sync control header */}
        <div className="flex items-center justify-between p-4 border-b-2 border-[#E3DEC3] bg-stone-50/50">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold uppercase tracking-wider text-stone-900 flex items-center gap-2 font-mono">
              <Calendar className="h-4.5 w-4.5 text-stone-500" />
              {view === 'week' ? `Shared Week of ${weekDates[0].toLocaleDateString([], { month: 'short', day: 'numeric' })}` : `Shared Date: ${currentDate.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}`}
            </h4>
            <div className="flex items-center gap-0.5 rounded-lg bg-white border border-stone-200 p-0.5 ml-2 shadow-xs">
              <button
                onClick={handlePrev}
                className="p-1 rounded text-stone-500 hover:text-stone-900 hover:bg-stone-50 transition cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={handleToday}
                className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-stone-600 hover:text-stone-900 transition cursor-pointer font-mono"
              >
                Today
              </button>
              <button
                onClick={handleNext}
                className="p-1 rounded text-stone-500 hover:text-stone-900 hover:bg-stone-50 transition cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-stone-100 border border-stone-200 rounded-lg p-0.5 shadow-inner">
            {(['week', 'day'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wide rounded-md transition cursor-pointer ${
                  view === v
                    ? 'bg-stone-900 text-stone-50 shadow-sm'
                    : 'text-stone-500 hover:text-stone-900'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* 30-minute interval scheduler matrix */}
        <div className="flex h-[720px] overflow-y-auto relative custom-scrollbar bg-[#FCFBF8]">
          {/* Hour indicators */}
          <div className="w-14 sm:w-16 flex-none border-r border-stone-200 bg-stone-50/40 sticky left-0 z-20">
            {hoursArray.map((h) => (
              <div key={h} className="h-[60px] relative">
                <span className="absolute -top-2.5 right-2 text-[9px] font-bold text-stone-400 uppercase font-mono">
                  {h === 0 ? '12 AM' : h === 12 ? '12 PM' : h > 12 ? `${h - 12} PM` : `${h} AM`}
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          <div className="flex-1 grid relative" style={{ gridTemplateColumns: view === 'week' ? 'repeat(7, 1fr)' : '1fr' }}>
            {/* Grid line rows */}
            {hoursArray.map((h) => (
              <div
                key={h}
                className="absolute left-0 right-0 border-b border-stone-200/50 pointer-events-none"
                style={{ top: `${h * 60}px`, height: '60px' }}
              />
            ))}

            {/* Render columns */}
            {activeDates.map((colDate, colIdx) => {
              const colDateStr = getLocalDateString(colDate);
              const gridIntervals = mergedGridsByDate[colDateStr] || [];

              return (
                <div key={colIdx} className="relative border-r border-stone-200 min-h-[1440px]">
                  {/* Column Header (Sticky top) */}
                  <div className="sticky top-0 bg-white border-b-2 border-stone-200 p-2 text-center z-10 shadow-xs">
                    <span className="text-[10px] uppercase font-bold text-stone-400 block tracking-widest font-mono">
                      {colDate.toLocaleDateString([], { weekday: 'short' })}
                    </span>
                    <span className="text-xs font-black text-stone-800">
                      {colDate.getDate()}
                    </span>
                  </div>

                  {/* Render 48 interval blocks stack */}
                  <div className="absolute inset-0 pt-10" style={{ height: '1440px' }}>
                    {gridIntervals.map((interval, intIdx) => {
                      const topPx = intIdx * 30 + 12; // offset
                      if (interval.mergedStatus === 'none') return null;

                      return (
                        <div
                          key={intIdx}
                          style={{ top: `${topPx}px`, height: '28px' }}
                          className={`absolute left-0.5 right-0.5 rounded-lg px-2 py-1 text-[9px] font-bold flex items-center justify-between overflow-hidden shadow-xs transition-all duration-150 group cursor-default z-10 ${getMergedStyle(
                            interval.mergedStatus
                          )}`}
                          title={getMergedLabel(interval)}
                        >
                          <div className="flex items-center gap-1 truncate">
                            <span className="uppercase text-[8px] font-bold tracking-wider font-mono">
                              {interval.mergedStatus === 'green' && '🟢 BOTH FREE'}
                              {interval.mergedStatus === 'blue' && '🔵 STUDYING'}
                              {interval.mergedStatus === 'orange' && '🤝 OVERLAP'}
                              {interval.mergedStatus === 'red' && '🔴 BUSY'}
                              {interval.mergedStatus === 'grey' && '⚠️ CONFLICT'}
                            </span>
                          </div>
                          <span className="text-[8px] font-mono opacity-80 group-hover:opacity-100 transition shrink-0">
                            {interval.timeStr}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
