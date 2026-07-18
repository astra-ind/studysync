import React, { useState, useMemo, useEffect } from 'react';
import { CalendarEvent, SlotType } from '../types';
import { getLocalDateString, getMonthDays, expandEvents } from '../utils/calendarUtils';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, Filter, Search, BookOpen, CheckSquare } from 'lucide-react';

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
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  // Track current time for red line indicator
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
        const matchesTopic = e.topic ? e.topic.toLowerCase().includes(query) : false;
        if (!matchesTitle && !matchesNotes && !matchesTopic) return false;
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
      case 'free': return 'bg-emerald-50 text-emerald-950 border-2 border-emerald-300 hover:bg-emerald-100';
      case 'studying': return 'bg-sky-50 text-sky-950 border-2 border-sky-300 hover:bg-sky-100';
      case 'busy': return 'bg-stone-50 text-stone-900 border-2 border-stone-200 hover:bg-stone-100';
      case 'maybe': return 'bg-amber-50 text-amber-950 border-2 border-amber-300 hover:bg-amber-100';
    }
  };

  return (
    <div className="space-y-4">
      {/* Search / Filter bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-xl border-2 border-[#D9D1C0] bg-white shadow-sm">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-stone-400" />
          <input
            type="text"
            placeholder="Search focus topic, notes, or titles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-stone-200 bg-stone-50 pl-9 pr-4 py-1.5 text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-stone-800 transition"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Slot Type Filter */}
          <div className="flex items-center gap-1.5 bg-stone-50 px-3 py-1.5 rounded-lg border border-stone-200">
            <Filter className="h-3 w-3 text-stone-500" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-transparent border-none text-[10px] font-bold text-stone-700 focus:outline-none uppercase tracking-wider font-mono cursor-pointer"
            >
              <option value="all">ALL TYPES</option>
              <option value="free">🟢 FREE SPACE</option>
              <option value="studying">🔵 STUDYING</option>
              <option value="busy">🔴 BUSY</option>
              <option value="maybe">🟡 MAYBE</option>
            </select>
          </div>

          {/* Timezone display */}
          <div className="flex items-center gap-1 bg-stone-50 px-3 py-1.5 rounded-lg border border-stone-200 text-[10px] font-bold text-stone-500 font-mono">
            <Clock className="h-3.5 w-3.5 text-stone-400" />
            <span>ZONE: {timezone.split('/').pop()?.replace('_', ' ')}</span>
          </div>
        </div>
      </div>

      {/* Main Calendar Frame */}
      <div className="rounded-2xl border-2 border-[#D9D1C0] bg-white shadow-[4px_4px_0px_0px_rgba(217,209,192,0.4)] overflow-hidden flex flex-col">
        
        {/* Calendar Header Control */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border-b-2 border-[#E3DEC3] bg-stone-50/50">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-serif font-black text-stone-900 flex items-center gap-2">
              <CalendarIcon className="h-4.5 w-4.5 text-stone-500" />
              {view === 'month' && currentDate.toLocaleDateString([], { month: 'long', year: 'numeric' })}
              {view === 'week' && `Week of ${weekDates[0].toLocaleDateString([], { month: 'short', day: 'numeric' })}`}
              {view === 'day' && currentDate.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
            </h2>
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

          {/* View Toggles */}
          <div className="flex items-center gap-1 bg-stone-100 border border-stone-200 rounded-lg p-0.5 shadow-inner">
            {(['day', 'week', 'month'] as const).map((v) => (
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

        {/* Calendar Body views */}
        {view === 'month' ? (
          /* MONTH GRID VIEW */
          <div className="grid grid-cols-7 border-b border-stone-100 bg-[#FCFBF8]">
            {/* Weekday headers */}
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="py-2.5 text-center border-r border-b border-stone-200 bg-stone-50/50 text-[10px] font-bold text-stone-400 uppercase tracking-widest font-mono">
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
                    className={`min-h-[110px] border-r border-b border-stone-200 p-1.5 flex flex-col gap-1 transition-colors cursor-pointer ${
                      day.isCurrentMonth ? 'bg-white hover:bg-stone-50/40' : 'bg-stone-50/30 opacity-40'
                    } ${day.isToday ? 'bg-[#FCFAF2] border-amber-300' : ''}`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className={`text-[10px] font-bold ${day.isToday ? 'text-[#8C6D1F] bg-[#FAF3D1] px-1.5 py-0.5 rounded-full' : 'text-stone-400'}`}>
                        {day.date.getDate()}
                      </span>
                    </div>

                    {/* Day events */}
                    <div className="space-y-1 overflow-y-auto max-h-[75px] custom-scrollbar">
                      {day.events.slice(0, 3).map((e) => {
                        const sTime = new Date(e.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        return (
                          <div
                            key={e.id}
                            onClick={(clickEvent) => {
                              clickEvent.stopPropagation();
                              onEditSlotClick(e);
                            }}
                            className={`px-1.5 py-0.5 rounded-md border text-[9px] font-bold truncate transition ${getSlotStyle(e.type)}`}
                            title={`${e.title} (${sTime})`}
                          >
                            {e.title}
                          </div>
                        );
                      })}
                      {day.events.length > 3 && (
                        <div className="text-[8px] text-[#A58D56] font-bold text-center font-mono">
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
          <div className="flex h-[800px] overflow-y-auto relative custom-scrollbar bg-[#FCFBF8]">
            {/* Time labels column */}
            <div className="w-14 sm:w-16 flex-none border-r border-stone-200 bg-stone-50/40 sticky left-0 z-20">
              {hoursArray.map((h) => (
                <div key={h} className="h-[60px] relative">
                  <span className="absolute -top-2.5 right-2 text-[9px] font-bold text-stone-400 uppercase font-mono">
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
                  className="absolute left-0 right-0 border-b border-stone-200/50 pointer-events-none"
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
                    className={`relative border-r border-stone-200 min-h-[1440px] transition-colors ${
                      isTodayCol ? 'bg-amber-500/[0.015]' : ''
                    }`}
                  >
                    {/* Column Header label (Sticky top) */}
                    <div className="sticky top-0 bg-white border-b-2 border-stone-200 p-2 text-center z-10 shadow-xs">
                      <span className="text-[10px] uppercase font-bold text-stone-400 block tracking-widest font-mono">
                        {colDate.toLocaleDateString([], { weekday: 'short' })}
                      </span>
                      <span className={`text-sm font-black ${isTodayCol ? 'text-[#8C6D1F] underline decoration-wavy' : 'text-stone-800'}`}>
                        {colDate.getDate()}
                      </span>
                    </div>

                    {/* Quick click-to-add layer across hours */}
                    {hoursArray.map((h) => (
                      <div
                        key={h}
                        onClick={() => onAddSlotClick(colDateStr, `${String(h).padStart(2, '0')}:00`)}
                        className="absolute left-0 right-0 h-[60px] hover:bg-stone-200/30 transition-colors cursor-pointer"
                        style={{ top: `${h * 60 + 44}px` }} // shift for header block
                      />
                    ))}

                    {/* Column absolute events */}
                    {colEvents.map((e) => {
                      const startD = new Date(e.start);
                      const endD = new Date(e.end);

                      const startMin = startD.getHours() * 60 + startD.getMinutes();
                      const endMin = endD.getHours() * 60 + endD.getMinutes();
                      
                      const topPx = startMin + 44; // offset for column header
                      const heightPx = Math.max(34, endMin - startMin); // minimum 34px height

                      const totalTasks = e.checklist?.length || 0;
                      const doneTasks = e.checklist?.filter((t) => t.done).length || 0;

                      return (
                        <div
                          key={e.id}
                          onClick={() => onEditSlotClick(e)}
                          style={{ top: `${topPx}px`, height: `${heightPx}px` }}
                          className={`absolute left-0.5 right-0.5 rounded-xl p-2 border-2 text-[10px] font-bold overflow-hidden shadow-sm hover:scale-[1.01] transition-all cursor-pointer z-10 flex flex-col justify-between ${getSlotStyle(
                            e.type
                          )}`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1">
                              <p className="truncate text-stone-900 font-bold text-xs">{e.title}</p>
                              {totalTasks > 0 && (
                                <span className="text-[8px] font-mono font-bold bg-white/80 border border-stone-200 rounded px-1 shrink-0 flex items-center gap-0.5">
                                  ✓ {doneTasks}/{totalTasks}
                                </span>
                              )}
                            </div>
                            <p className="opacity-80 text-[9px] font-medium font-mono mt-0.5">
                              {startD.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {endD.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          
                          {/* Show topic & notes if block has space */}
                          {heightPx > 65 && (
                            <div className="mt-1 space-y-0.5 border-t border-stone-200/40 pt-1">
                              {e.topic && (
                                <p className="text-[8px] font-bold uppercase truncate font-mono text-stone-600">
                                  📚 {e.topic}
                                </p>
                              )}
                              {e.notes && (
                                <p className="text-[8px] font-normal opacity-70 italic truncate font-serif">
                                  {e.notes}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Current Time Indicator line */}
                    {isTodayCol && (
                      <div
                        className="absolute left-0 right-0 flex items-center pointer-events-none z-20"
                        style={{ top: `${timeIndicatorTop + 44}px` }}
                      >
                        <div className="h-1.5 w-1.5 rounded-full bg-rose-600 -ml-1 shadow-sm" />
                        <div className="h-[1.5px] flex-1 bg-rose-500" />
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
      <div className="flex flex-wrap items-center gap-4 p-4 rounded-xl border-2 border-stone-200 bg-white text-xs">
        <span className="font-bold text-stone-400 uppercase tracking-widest text-[9px] font-mono">Legend:</span>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          <span className="text-stone-700 font-bold">🟢 Free Space</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
          <span className="text-stone-700 font-bold">🔵 Focused Studying</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-stone-500" />
          <span className="text-stone-700 font-bold">🔴 Busy / Unavailable</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
          <span className="text-stone-700 font-bold">🟡 Maybe Available</span>
        </div>
      </div>
    </div>
  );
}
