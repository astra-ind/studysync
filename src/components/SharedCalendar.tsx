import React, { useState, useMemo, useEffect } from 'react';
import { CalendarEvent, SlotType } from '../types';
import { USERS, HardcodedUser } from '../config';
import { calculateSharedGrid, getLocalDateString, TimeInterval } from '../utils/calendarUtils';
import { Users, ChevronLeft, ChevronRight, Info, ShieldAlert, Sparkles, AlertTriangle } from 'lucide-react';

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

  // Helper to resolve colors
  const getMergedStyle = (status: string) => {
    switch (status) {
      case 'green':
        return 'bg-emerald-500/30 border-emerald-500/50 text-emerald-300';
      case 'blue':
        return 'bg-sky-500/30 border-sky-500/50 text-sky-300 animate-pulse';
      case 'orange':
        return 'bg-amber-500/30 border-amber-500/50 text-amber-300 font-bold';
      case 'red':
        return 'bg-rose-500/30 border-rose-500/50 text-rose-300';
      case 'grey':
        return 'bg-slate-700/30 border-slate-700/50 text-slate-400';
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
    
    if (mergedStatus === 'green') return `🎉 BOTH FREE (${desc})`;
    if (mergedStatus === 'blue') return `⚡ STUDY TOGETHER (${desc})`;
    if (mergedStatus === 'orange') return `🤝 OPPORTUNITY: One Free, One Studying (${desc})`;
    if (mergedStatus === 'red') return `🔴 BUSY: Someone is busy (${desc})`;
    if (mergedStatus === 'grey') return `⚠️ MISMATCH / CONFLICT (${desc})`;
    return desc;
  };

  return (
    <div className="space-y-4">
      {/* Overview Intro Card */}
      <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/30 backdrop-blur-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg text-white">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Merged Sync Schedule</h3>
            <p className="text-xs text-slate-400">
              Visualizing schedules for <span className="font-semibold text-slate-200">{userA.name}</span> &amp; <span className="font-semibold text-slate-200">{userB.name}</span> combined.
            </p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-[10px] font-bold">
          <div className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>Both Free</span>
          </div>
          <div className="flex items-center gap-1 bg-sky-500/10 border border-sky-500/20 px-2 py-1 rounded text-sky-400">
            <span className="h-2 w-2 rounded-full bg-sky-500" />
            <span>Both Study</span>
          </div>
          <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded text-amber-400">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            <span>1 Free + 1 Study</span>
          </div>
          <div className="flex items-center gap-1 bg-rose-500/10 border border-rose-500/20 px-2 py-1 rounded text-rose-400">
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            <span>Busy</span>
          </div>
          <div className="flex items-center gap-1 bg-slate-700/20 border border-slate-700/30 px-2 py-1 rounded text-slate-400">
            <span className="h-2 w-2 rounded-full bg-slate-500" />
            <span>Conflict</span>
          </div>
        </div>
      </div>

      {/* Shared Calendar Core */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/30 backdrop-blur-md overflow-hidden flex flex-col">
        {/* Sync control header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800/80 bg-slate-950/20">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold uppercase tracking-wider text-white">
              {view === 'week' ? `Shared Week of ${weekDates[0].toLocaleDateString([], { month: 'short', day: 'numeric' })}` : `Shared Date: ${currentDate.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}`}
            </h4>
            <div className="flex items-center gap-1 rounded-lg bg-slate-950 border border-slate-800 p-0.5 ml-2">
              <button
                onClick={handlePrev}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-900 transition cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={handleToday}
                className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-300 hover:text-white transition cursor-pointer"
              >
                Today
              </button>
              <button
                onClick={handleNext}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-900 transition cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg p-0.5">
            {(['week', 'day'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1 text-xs font-semibold uppercase tracking-wider rounded-md transition cursor-pointer ${
                  view === v
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* 30-minute interval scheduler matrix */}
        <div className="flex h-[720px] overflow-y-auto relative custom-scrollbar bg-slate-900/5">
          {/* Hour indicators */}
          <div className="w-14 sm:w-16 flex-none border-r border-slate-800/60 bg-slate-950/40 sticky left-0 z-20">
            {hoursArray.map((h) => (
              <div key={h} className="h-[60px] relative">
                <span className="absolute -top-2.5 right-2 text-[9px] font-bold text-slate-500 uppercase">
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
                className="absolute left-0 right-0 border-b border-slate-800/40 pointer-events-none"
                style={{ top: `${h * 60}px`, height: '60px' }}
              />
            ))}

            {/* Render columns */}
            {activeDates.map((colDate, colIdx) => {
              const colDateStr = getLocalDateString(colDate);
              const gridIntervals = mergedGridsByDate[colDateStr] || [];

              return (
                <div key={colIdx} className="relative border-r border-slate-800/60 min-h-[1440px]">
                  {/* Column Header (Sticky top) */}
                  <div className="sticky top-0 bg-slate-950/90 border-b border-slate-800/80 p-2 text-center z-10 backdrop-blur-md">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                      {colDate.toLocaleDateString([], { weekday: 'short' })}
                    </span>
                    <span className="text-xs font-black text-slate-100">
                      {colDate.getDate()}
                    </span>
                  </div>

                  {/* Render 48 interval blocks stack */}
                  <div className="absolute inset-0 pt-10" style={{ height: '1440px' }}>
                    {gridIntervals.map((interval, intIdx) => {
                      const topPx = intIdx * 30 + 10; // offset
                      if (interval.mergedStatus === 'none') return null;

                      return (
                        <div
                          key={intIdx}
                          style={{ top: `${topPx}px`, height: '30px' }}
                          className={`absolute left-0.5 right-0.5 rounded-md px-1.5 py-1 border text-[9px] font-black flex items-center justify-between overflow-hidden shadow transition-all duration-150 group cursor-default z-10 ${getMergedStyle(
                            interval.mergedStatus
                          )}`}
                          title={getMergedLabel(interval)}
                        >
                          <div className="flex items-center gap-1 truncate">
                            <span className="uppercase text-[8px] font-black opacity-80">
                              {interval.mergedStatus === 'green' && '🟢 both free'}
                              {interval.mergedStatus === 'blue' && '🔵 study!'}
                              {interval.mergedStatus === 'orange' && '🤝 overlap'}
                              {interval.mergedStatus === 'red' && '🔴 busy'}
                              {interval.mergedStatus === 'grey' && '⚠️ mismatch'}
                            </span>
                          </div>
                          <span className="text-[8px] opacity-70 group-hover:opacity-100 transition shrink-0">
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
