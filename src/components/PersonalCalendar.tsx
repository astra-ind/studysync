import React, { useState, useMemo, useEffect } from 'react';
import { CalendarEvent, SlotType } from '../types';
import { SLOT_TYPES } from '../config';
import { getLocalDateString, getMonthDays, expandEvents } from '../utils/calendarUtils';
import { Calendar, ChevronLeft, ChevronRight, Clock, MapPin, Grid, Layers, Filter, Search } from 'lucide-react';

interface PersonalCalendarProps {
  userId: string;
  userName: string;
  events: CalendarEvent[];
  onAddSlotClick: (dateStr?: string, startHour?: string) => void;
  onEditSlotClick: (event: CalendarEvent) => void;
}

export default function PersonalCalendar({
  userId,
  userName,
  events,
  onAddSlotClick,
  onEditSlotClick,
}: PersonalCalendarProps) {
  const [view, setView] = useState<'day' | 'week' | 'month'>('week');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  
  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  
  // Timezone Override
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');

  // Track current time for line indicator
  const [nowTime, setNowTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNowTime(new Date()), 60000); // update every min
    return () => clearInterval(timer);
  }, []);

  // Filter and compute active user events
  const userEvents = useMemo(() => {
    return events.filter((e) => e.userId === userId);
  }, [events, userId]);

  // Navigate dates
  const handlePrev = () => {
    const next = new Date(currentDate);
    if (view === 'month') {
      next.setMonth(next.getMonth() - 1);
    } else if (view === 'week') {
      next.setDate(next.getDate() - 7);
    } else {
      next.setDate(next.getDate() - 1);
    }
    setCurrentDate(next);
  };

  const handleNext = () => {
    const next = new Date(currentDate);
    if (view === 'month') {
      next.setMonth(next.getMonth() + 1);
    } else if (view === 'week') {
      next.setDate(next.getDate() + 7);
    } else {
      next.setDate(next.getDate() + 1);
    }
    setCurrentDate(next);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

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

  // Get active range for event expansion
  const range = useMemo(() => {
    const start = new Date(currentDate);
    const end = new Date(currentDate);

    if (view === 'month') {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
      end.setHours(23, 59, 59, 999);
    } else if (view === 'week') {
      start.setDate(start.getDate() - start.getDay());
      start.setHours(0, 0, 0, 0);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    }

    return { start, end };
  }, [currentDate, view]);

  // Expanded and Filtered Events
  const filteredExpandedEvents = useMemo(() => {
    const expanded = expandEvents(userEvents, range.start, range.end);
    
    return expanded.filter((e) => {
      // Apply type filter
      if (typeFilter !== 'all' && e.type !== typeFilter) return false;
      
      // Apply search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = e.title.toLowerCase().includes(query);
        const matchesNotes = e.notes ? e.notes.toLowerCase().includes(query) : false;
        if (!matchesTitle && !matchesNotes) return false;
      }
      
      return true;
    });
  }, [userEvents, range, typeFilter, searchQuery]);

  // Map of hours 0 to 23
  const hoursArray = Array.from({ length: 24 }, (_, i) => i);

  // Calculate current time line positioning for week/day views
  const timeIndicatorTop = useMemo(() => {
    const hours = nowTime.getHours();
    const minutes = nowTime.getMinutes();
    const totalMinutes = hours * 60 + minutes;
    // Each hour in our CSS is 60px, so 1 minute is 1px
    return totalMinutes; // returns height in px
  }, [nowTime]);

  // Month Days
  const monthDays = useMemo(() => {
    if (view !== 'month') return [];
    return getMonthDays(currentDate, filteredExpandedEvents);
  }, [currentDate, view, filteredExpandedEvents]);

  // Helper to format slot background in grids
  const getSlotStyle = (type: SlotType) => {
    switch (type) {
      case 'free': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30';
      case 'studying': return 'bg-sky-500/20 text-sky-400 border-sky-500/30 hover:bg-sky-500/30';
      case 'busy': return 'bg-rose-500/20 text-rose-400 border-rose-500/30 hover:bg-rose-500/30';
      case 'maybe': return 'bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30';
    }
  };

  return (
    <div className="space-y-4">
      {/* Search / Filter bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-xl border border-slate-800 bg-slate-900/30 backdrop-blur-sm">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search slots..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-800 bg-slate-950 pl-9 pr-4 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Slot Type Filter */}
          <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
            <Filter className="h-3 w-3 text-indigo-400" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-transparent border-none text-[10px] font-semibold text-slate-300 focus:outline-none uppercase tracking-wider"
            >
              <option value="all">ALL TYPES</option>
              <option value="free">🟢 FREE</option>
              <option value="studying">🔵 STUDYING</option>
              <option value="busy">🔴 BUSY</option>
              <option value="maybe">🟡 MAYBE</option>
            </select>
          </div>

          {/* Timezone display */}
          <div className="flex items-center gap-1 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-[10px] font-semibold text-slate-400">
            <Clock className="h-3 w-3 text-purple-400" />
            <span>TZ: {timezone.split('/').pop()?.replace('_', ' ')}</span>
          </div>
        </div>
      </div>

      {/* Main Calendar Frame */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/30 backdrop-blur-md overflow-hidden flex flex-col">
        {/* Calendar Header Control */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border-b border-slate-800/80 bg-slate-950/20">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">
              {view === 'month' && currentDate.toLocaleDateString([], { month: 'long', year: 'numeric' })}
              {view === 'week' && `Week of ${weekDates[0].toLocaleDateString([], { month: 'short', day: 'numeric' })}`}
              {view === 'day' && currentDate.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
            </h2>
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

          {/* View Toggles */}
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg p-0.5">
            {(['day', 'week', 'month'] as const).map((v) => (
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

        {/* Calendar Body views */}
        {view === 'month' ? (
          /* MONTH GRID VIEW */
          <div className="grid grid-cols-7 border-b border-slate-800">
            {/* Weekday headers */}
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="py-2.5 text-center border-r border-slate-800 bg-slate-950/40 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {d}
              </div>
            ))}

            {/* Grid Days */}
            <div className="contents">
              {monthDays.map((day, idx) => {
                const dateStr = getLocalDateString(day.date);
                return (
                  <div
                    key={idx}
                    onClick={() => onAddSlotClick(dateStr)}
                    className={`min-h-[100px] border-r border-b border-slate-800 p-1.5 flex flex-col gap-1 transition-colors cursor-pointer ${
                      day.isCurrentMonth ? 'bg-slate-900/10 hover:bg-slate-900/30' : 'bg-slate-950/20 opacity-40'
                    } ${day.isToday ? 'bg-indigo-500/5 border-indigo-500/40' : ''}`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className={`text-[10px] font-bold ${day.isToday ? 'text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded-full' : 'text-slate-400'}`}>
                        {day.date.getDate()}
                      </span>
                    </div>

                    {/* Day events */}
                    <div className="space-y-1 overflow-y-auto max-h-[70px] custom-scrollbar">
                      {day.events.slice(0, 3).map((e) => {
                        const sTime = new Date(e.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        return (
                          <div
                            key={e.id}
                            onClick={(clickEvent) => {
                              clickEvent.stopPropagation();
                              onEditSlotClick(e);
                            }}
                            className={`px-1.5 py-0.5 rounded border text-[9px] font-bold truncate transition ${getSlotStyle(e.type)}`}
                            title={`${e.title} (${sTime})`}
                          >
                            {e.title}
                          </div>
                        );
                      })}
                      {day.events.length > 3 && (
                        <div className="text-[8px] text-indigo-400 font-bold text-center">
                          + {day.events.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* WEEK / DAY VIEW SCHEDULERS (Absolute positioning grids) */
          <div className="flex h-[800px] overflow-y-auto relative custom-scrollbar bg-slate-900/5">
            {/* Time labels column */}
            <div className="w-14 sm:w-16 flex-none border-r border-slate-800/60 bg-slate-950/40 sticky left-0 z-20">
              {hoursArray.map((h) => (
                <div key={h} className="h-[60px] relative">
                  <span className="absolute -top-2.5 right-2 text-[9px] font-bold text-slate-500 uppercase">
                    {h === 0 ? '12 AM' : h === 12 ? '12 PM' : h > 12 ? `${h - 12} PM` : `${h} AM`}
                  </span>
                </div>
              ))}
            </div>

            {/* Grid columns */}
            <div className="flex-1 grid relative" style={{ gridTemplateColumns: view === 'week' ? 'repeat(7, 1fr)' : '1fr' }}>
              
              {/* Day background column boundaries & grid lines */}
              {hoursArray.map((h) => (
                <div
                  key={h}
                  className="absolute left-0 right-0 border-b border-slate-800/40 pointer-events-none"
                  style={{ top: `${h * 60}px`, height: '60px' }}
                />
              ))}

              {/* Day Columns */}
              {(view === 'week' ? weekDates : [currentDate]).map((colDate, colIdx) => {
                const colDateStr = getLocalDateString(colDate);
                const isTodayCol = colDateStr === getLocalDateString(new Date());

                // Filter events starting on this column's date
                const colEvents = filteredExpandedEvents.filter((e) => {
                  return getLocalDateString(new Date(e.start)) === colDateStr;
                });

                return (
                  <div
                    key={colIdx}
                    className={`relative border-r border-slate-800/60 min-h-[1440px] transition-colors ${
                      isTodayCol ? 'bg-indigo-500/[0.01]' : ''
                    }`}
                  >
                    {/* Column Header label (Sticky top) */}
                    <div className="sticky top-0 bg-slate-950/90 border-b border-slate-800/80 p-2 text-center z-10 backdrop-blur-md">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                        {colDate.toLocaleDateString([], { weekday: 'short' })}
                      </span>
                      <span className={`text-xs font-black ${isTodayCol ? 'text-indigo-400' : 'text-slate-100'}`}>
                        {colDate.getDate()}
                      </span>
                    </div>

                    {/* Quick click-to-add layer across hours */}
                    {hoursArray.map((h) => (
                      <div
                        key={h}
                        onClick={() => onAddSlotClick(colDateStr, `${String(h).padStart(2, '0')}:00`)}
                        className="absolute left-0 right-0 h-[60px] hover:bg-indigo-500/[0.03] transition-colors cursor-pointer"
                        style={{ top: `${h * 60 + 38}px` }} // shift for header block
                      />
                    ))}

                    {/* Column absolute events */}
                    {colEvents.map((e) => {
                      const startD = new Date(e.start);
                      const endD = new Date(e.end);

                      const startMin = startD.getHours() * 60 + startD.getMinutes();
                      const endMin = endD.getHours() * 60 + endD.getMinutes();
                      
                      const topPx = startMin + 38; // offset for column header
                      const heightPx = Math.max(30, endMin - startMin); // minimum 30px height

                      return (
                        <div
                          key={e.id}
                          onClick={() => onEditSlotClick(e)}
                          style={{ top: `${topPx}px`, height: `${heightPx}px` }}
                          className={`absolute left-1 right-1 rounded-xl p-2 border text-[10px] font-bold overflow-hidden shadow-md backdrop-blur-sm hover:scale-[1.01] transition-all cursor-pointer z-10 ${getSlotStyle(
                            e.type
                          )}`}
                        >
                          <p className="truncate text-white text-xs">{e.title}</p>
                          <p className="opacity-80 text-[9px] mt-0.5">
                            {startD.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {endD.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          {e.notes && (
                            <p className="text-[8px] font-normal opacity-70 italic line-clamp-1 mt-1">
                              {e.notes}
                            </p>
                          )}
                        </div>
                      );
                    })}

                    {/* Current Time Indicator line */}
                    {isTodayCol && (
                      <div
                        className="absolute left-0 right-0 flex items-center pointer-events-none z-20"
                        style={{ top: `${timeIndicatorTop + 38}px` }}
                      >
                        <div className="h-1.5 w-1.5 rounded-full bg-rose-500 -ml-1 shadow-rose-500 shadow-md" />
                        <div className="h-[1.5px] flex-1 bg-rose-500/80 shadow-rose-500 shadow-sm" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Legend Card */}
      <div className="flex flex-wrap items-center gap-4 p-4 rounded-xl border border-slate-800 bg-slate-900/20 text-xs">
        <span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">Legend:</span>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          <span className="text-slate-300">🟢 Free</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
          <span className="text-slate-300">🔵 Studying</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
          <span className="text-slate-300">🔴 Busy</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
          <span className="text-slate-300">🟡 Maybe Available</span>
        </div>
      </div>
    </div>
  );
}
