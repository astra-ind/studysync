import React, { useState, useMemo } from 'react';
import { CalendarEvent } from '../types';
import { USERS, HardcodedUser, DAILY_STUDY_GOAL_HOURS } from '../config';
import { db, doc, updateDoc } from '../lib/firebase';
import { expandEvents, findMatches, getLocalDateString, formatDuration } from '../utils/calendarUtils';
import { downloadICS } from '../utils/icsUtils';
import { BookOpen, Calendar as CalendarIcon, Sparkles, Plus, Clock, TrendingUp, Flame, Download, CheckSquare, Square, Notebook } from 'lucide-react';

interface DashboardProps {
  currentUser: HardcodedUser;
  partner: HardcodedUser;
  events: CalendarEvent[];
  onAddSlotClick: () => void;
}

export default function Dashboard({ currentUser, partner, events, onAddSlotClick }: DashboardProps) {
  const [activeTaskFilter, setActiveTaskFilter] = useState<'all' | 'pending' | 'completed'>('all');

  // Expand events for the current week (Sunday to Saturday)
  const expandedEvents = useMemo(() => {
    const start = new Date();
    start.setDate(start.getDate() - start.getDay()); // start of week
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 7); // end of week
    end.setHours(23, 59, 59, 999);

    return expandEvents(events, start, end);
  }, [events]);

  // Current user's expanded events
  const userEvents = useMemo(() => {
    return expandedEvents.filter((e) => e.userId === currentUser.id);
  }, [expandedEvents, currentUser]);

  // Partner's expanded events
  const partnerEvents = useMemo(() => {
    return expandedEvents.filter((e) => e.userId === partner.id);
  }, [expandedEvents, partner]);

  // Total events for match finding
  const allEventsForMatch = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setDate(end.getDate() + 7); // Scan 7 days
    end.setHours(23, 59, 59, 999);

    return expandEvents(events, start, end);
  }, [events]);

  const matches = useMemo(() => {
    const userAEvs = allEventsForMatch.filter((e) => e.userId === currentUser.id);
    const userBEvs = allEventsForMatch.filter((e) => e.userId === partner.id);
    return findMatches(userAEvs, userBEvs, 7);
  }, [allEventsForMatch, currentUser, partner]);

  // Today's schedule for current user
  const todaySchedule = useMemo(() => {
    const todayStr = getLocalDateString(new Date());
    return userEvents
      .filter((e) => {
        const dStr = getLocalDateString(new Date(e.start));
        return dStr === todayStr;
      })
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }, [userEvents]);

  // Total study hours this week for current user
  const weeklyStudyHours = useMemo(() => {
    let totalMs = 0;
    userEvents.forEach((e) => {
      if (e.type === 'studying') {
        const start = new Date(e.start);
        const end = new Date(e.end);
        totalMs += end.getTime() - start.getTime();
      }
    });
    return Math.round((totalMs / (1000 * 60 * 60)) * 10) / 10;
  }, [userEvents]);

  // Total study hours this week for partner
  const partnerWeeklyStudyHours = useMemo(() => {
    let totalMs = 0;
    partnerEvents.forEach((e) => {
      if (e.type === 'studying') {
        const start = new Date(e.start);
        const end = new Date(e.end);
        totalMs += end.getTime() - start.getTime();
      }
    });
    return Math.round((totalMs / (1000 * 60 * 60)) * 10) / 10;
  }, [partnerEvents]);

  // Today's study hours progress towards goal
  const todayStudyHours = useMemo(() => {
    const todayStr = getLocalDateString(new Date());
    let totalMs = 0;
    userEvents.forEach((e) => {
      const dStr = getLocalDateString(new Date(e.start));
      if (dStr === todayStr && e.type === 'studying') {
        totalMs += new Date(e.end).getTime() - new Date(e.start).getTime();
      }
    });
    return Math.round((totalMs / (1000 * 60 * 60)) * 10) / 10;
  }, [userEvents]);

  const goalPercentage = Math.min(100, Math.round((todayStudyHours / DAILY_STUDY_GOAL_HOURS) * 100));

  // Study Streak Days
  const studyStreak = useMemo(() => {
    const studyDays = new Set<string>();
    events.forEach((e) => {
      if (e.userId === currentUser.id && e.type === 'studying') {
        studyDays.add(getLocalDateString(new Date(e.start)));
      }
    });

    let streak = 0;
    const checkDate = new Date();
    const todayStr = getLocalDateString(checkDate);
    checkDate.setDate(checkDate.getDate() - 1);
    const yesterdayStr = getLocalDateString(checkDate);

    const hasToday = studyDays.has(todayStr);
    const hasYesterday = studyDays.has(yesterdayStr);

    if (!hasToday && !hasYesterday) return 0;

    const activeDate = new Date();
    if (!hasToday && hasYesterday) {
      activeDate.setDate(activeDate.getDate() - 1);
    }

    while (true) {
      const checkStr = getLocalDateString(activeDate);
      if (studyDays.has(checkStr)) {
        streak++;
        activeDate.setDate(activeDate.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  }, [events, currentUser]);

  // Next shared study or free slot (earliest matching slot starting now or in the future)
  const nextSharedSlot = useMemo(() => {
    const now = new Date().getTime();
    return matches
      .filter((m) => m.start.getTime() >= now)
      .sort((a, b) => a.start.getTime() - b.start.getTime())[0] || null;
  }, [matches]);

  // Study hours for the past 7 days (for heatmap statistics)
  const studyHeatmap = useMemo(() => {
    const list = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date();
      day.setDate(day.getDate() - i);
      const dateStr = getLocalDateString(day);

      let totalMs = 0;
      userEvents.forEach((e) => {
        const dStr = getLocalDateString(new Date(e.start));
        if (dStr === dateStr && e.type === 'studying') {
          totalMs += new Date(e.end).getTime() - new Date(e.start).getTime();
        }
      });

      const hours = Math.round((totalMs / (1000 * 60 * 60)) * 10) / 10;
      list.push({
        dateStr,
        dayName: day.toLocaleDateString([], { weekday: 'narrow' }),
        hours,
        label: day.toLocaleDateString([], { month: 'short', day: 'numeric' }),
      });
    }
    return list;
  }, [userEvents]);

  // Handle Export ICS
  const handleExportICS = () => {
    downloadICS(userEvents, currentUser.name);
  };

  // Toggle checklist item
  const handleToggleTask = async (eventId: string, taskId: string, currentDone: boolean) => {
    try {
      const eventRef = doc(db, 'events', eventId);
      const rawEvent = events.find((e) => e.id === eventId);
      if (!rawEvent) return;

      const updatedChecklist = rawEvent.checklist?.map((item) =>
        item.id === taskId ? { ...item, done: !currentDone } : item
      ) || [];

      await updateDoc(eventRef, { checklist: updatedChecklist });
    } catch (err) {
      console.error('Error toggling checklist item:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Intro Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl border-2 border-[#D9D1C0] bg-white shadow-[4px_4px_0px_0px_rgba(217,209,192,0.4)] relative overflow-hidden">
        <div className="space-y-1.5 relative z-10">
          <h2 className="text-2xl font-serif font-black tracking-tight text-stone-900 flex items-center gap-2">
            Welcome back, <span className="underline decoration-[#B59F74] decoration-2">{currentUser.name}</span>! {currentUser.avatar}
          </h2>
          <p className="text-xs text-stone-500 font-sans">
            You are synced in real-time with <strong className="text-stone-800 font-bold">{partner.name}</strong>. Start booking overlapping study slots.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5 relative z-10">
          <button
            onClick={onAddSlotClick}
            className="flex items-center gap-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-50 px-4.5 py-2.5 text-xs font-bold uppercase tracking-wider shadow-sm transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4 text-amber-200" />
            <span>Schedule A Slot</span>
          </button>
          <button
            onClick={handleExportICS}
            className="flex items-center gap-1.5 rounded-xl border-2 border-stone-200 bg-white hover:bg-stone-50 text-stone-700 px-4 py-2.5 text-xs font-bold uppercase tracking-wider shadow-sm transition-all cursor-pointer"
          >
            <Download className="h-4 w-4 text-stone-500" />
            <span>Export Calendar (.ics)</span>
          </button>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Weekly Study Hours */}
        <div className="p-5 rounded-xl border-2 border-[#D9D1C0] bg-white shadow-[4px_4px_0px_0px_rgba(217,209,192,0.3)] flex items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest block font-mono">Weekly Logs</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-stone-900">{weeklyStudyHours}h</span>
              <span className="text-xs text-stone-400 font-mono">/ 15h goal</span>
            </div>
            <p className="text-[10px] text-stone-500 font-medium">
              {partner.name} logged <span className="text-indigo-800 font-bold">{partnerWeeklyStudyHours}h</span>
            </p>
          </div>
          <div className="h-12 w-12 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
            <BookOpen className="h-5 w-5" />
          </div>
        </div>

        {/* Longest Streak */}
        <div className="p-5 rounded-xl border-2 border-[#D9D1C0] bg-white shadow-[4px_4px_0px_0px_rgba(217,209,192,0.3)] flex items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest block font-mono">Study Streak</span>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black text-stone-900">{studyStreak}</span>
              <span className="text-xs text-amber-800 font-bold uppercase tracking-wider font-mono">days</span>
            </div>
            <p className="text-[10px] text-stone-500">
              Study daily to expand streaks!
            </p>
          </div>
          <div className="h-12 w-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
            <Flame className="h-5 w-5 animate-pulse" />
          </div>
        </div>

        {/* Daily Study Goal Gauge */}
        <div className="p-5 rounded-xl border-2 border-[#D9D1C0] bg-white shadow-[4px_4px_0px_0px_rgba(217,209,192,0.3)] space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest font-mono">Daily Target</span>
            <span className="text-xs font-bold text-emerald-800 font-mono">{goalPercentage}%</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-stone-900">{todayStudyHours}</span>
            <span className="text-xs text-stone-500">/ {DAILY_STUDY_GOAL_HOURS} hrs today</span>
          </div>
          <div className="w-full bg-stone-100 rounded-full h-2 overflow-hidden border border-stone-200">
            <div
              className="bg-emerald-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${goalPercentage}%` }}
            />
          </div>
        </div>

        {/* Next Shared Free/Study Slot */}
        <div className="p-5 rounded-xl border-2 border-[#D9D1C0] bg-white shadow-[4px_4px_0px_0px_rgba(217,209,192,0.3)] flex items-center justify-between gap-4">
          <div className="space-y-1 flex-1 min-w-0">
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest block font-mono">Matched Slot</span>
            {nextSharedSlot ? (
              <>
                <p className="text-sm font-black text-stone-900 truncate">
                  {nextSharedSlot.label.split('(')[0].trim()}
                </p>
                <p className="text-[10px] text-stone-500 font-bold">
                  {new Date(nextSharedSlot.start).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                </p>
                <p className="text-[10px] text-[#A58D56] flex items-center gap-1 font-mono">
                  <Clock className="h-3 w-3" />
                  {new Date(nextSharedSlot.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(nextSharedSlot.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-bold text-stone-400">None Discovered</p>
                <p className="text-[10px] text-stone-500">Add free hours to sync!</p>
              </>
            )}
          </div>
          <div className="h-12 w-12 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700 shrink-0">
            <Sparkles className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Two-Column Mid-Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Today's Schedule timeline */}
        <div className="lg:col-span-2 p-5 rounded-xl border-2 border-[#D9D1C0] bg-white shadow-[4px_4px_0px_0px_rgba(217,209,192,0.3)] space-y-4">
          <div className="flex items-center justify-between border-b-2 border-stone-100 pb-3">
            <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wider flex items-center gap-2 font-mono">
              <CalendarIcon className="h-4 w-4 text-stone-500" />
              Your Study Timeline Today
            </h3>
            <span className="text-xs font-serif italic text-stone-500">
              {new Date().toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
            </span>
          </div>

          <div className="space-y-4">
            {todaySchedule.length === 0 ? (
              <div className="py-12 text-center rounded-xl border-2 border-dashed border-stone-200 bg-stone-50/50">
                <Notebook className="h-8 w-8 text-stone-400 mx-auto mb-2" />
                <p className="text-xs text-stone-500 font-serif italic">Your journal has no slots booked for today.</p>
                <button
                  onClick={onAddSlotClick}
                  className="mt-3 text-xs font-bold text-stone-700 hover:text-stone-900 underline transition cursor-pointer"
                >
                  Create a study block +
                </button>
              </div>
            ) : (
              todaySchedule.map((item) => {
                const sTime = new Date(item.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const eTime = new Date(item.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                let typeColor = 'border-emerald-200 bg-emerald-50/40 text-emerald-950';
                if (item.type === 'studying') typeColor = 'border-sky-200 bg-sky-50/40 text-sky-950';
                if (item.type === 'busy') typeColor = 'border-stone-200 bg-stone-50 text-stone-900';
                if (item.type === 'maybe') typeColor = 'border-amber-200 bg-amber-50/40 text-amber-950';

                const totalTasks = item.checklist?.length || 0;
                const doneTasks = item.checklist?.filter((t) => t.done).length || 0;

                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-xl border-2 transition ${typeColor} space-y-3 shadow-xs`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black">{item.title}</span>
                          {item.topic && (
                            <span className="text-[10px] font-bold uppercase tracking-wider font-mono bg-white border px-2 py-0.5 rounded text-stone-600">
                              📚 {item.topic}
                            </span>
                          )}
                        </div>
                        {item.notes && <p className="text-xs text-stone-600 italic font-serif leading-relaxed">{item.notes}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-black block font-mono">{sTime} - {eTime}</span>
                        <span className="text-[9px] uppercase font-bold tracking-widest font-mono opacity-80">{item.type}</span>
                      </div>
                    </div>

                    {/* Interactive Checklist directly on the Dashboard! */}
                    {item.checklist && item.checklist.length > 0 && (
                      <div className="border-t border-stone-200/50 pt-3 mt-2 space-y-1.5 bg-white/60 p-3 rounded-lg border">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500 font-mono flex justify-between">
                          <span>🎯 Target Checklist Tasks</span>
                          <span>{doneTasks}/{totalTasks} Done</span>
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1.5">
                          {item.checklist.map((task) => (
                            <button
                              key={task.id}
                              onClick={() => handleToggleTask(item.id, task.id, task.done)}
                              className="flex items-center gap-2 text-left text-xs text-stone-700 hover:text-stone-950 transition-all cursor-pointer p-1 rounded hover:bg-white"
                            >
                              {task.done ? (
                                <CheckSquare className="h-4 w-4 text-indigo-700 shrink-0" />
                              ) : (
                                <Square className="h-4 w-4 text-stone-400 shrink-0" />
                              )}
                              <span className={`truncate ${task.done ? 'line-through text-stone-400' : ''}`}>
                                {task.text}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Weekly Heatmap and Statistics */}
        <div className="p-5 rounded-xl border-2 border-[#D9D1C0] bg-white shadow-[4px_4px_0px_0px_rgba(217,209,192,0.3)] space-y-4">
          <div className="border-b-2 border-stone-100 pb-3">
            <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wider flex items-center gap-2 font-mono">
              <TrendingUp className="h-4 w-4 text-stone-500" />
              Weekly Heatmap
            </h3>
          </div>

          <p className="text-xs text-stone-500 font-serif italic leading-relaxed">
            Pencil-filled blocks indicating hours studied. Aim to complete your daily {DAILY_STUDY_GOAL_HOURS}h goals.
          </p>

          <div className="grid grid-cols-7 gap-2 pt-2">
            {studyHeatmap.map((day) => {
              // Decide intensity class
              let colorClass = 'bg-stone-50 border-stone-200 text-stone-400';
              if (day.hours > 0 && day.hours <= 2) colorClass = 'bg-emerald-50 border-emerald-200 text-emerald-800';
              if (day.hours > 2 && day.hours <= 4) colorClass = 'bg-sky-50 border-sky-200 text-sky-800';
              if (day.hours > 4) colorClass = 'bg-indigo-900 border-indigo-700 text-white';

              return (
                <div key={day.dateStr} className="flex flex-col items-center gap-1.5" title={`${day.label}: ${day.hours} study hours`}>
                  <div className={`h-11 w-full rounded-lg border-2 flex items-center justify-center text-xs font-black transition-all shadow-xs ${colorClass}`}>
                    {day.hours > 0 ? `${Math.round(day.hours)}` : '•'}
                  </div>
                  <span className="text-[10px] text-stone-400 font-bold uppercase font-mono">{day.dayName}</span>
                </div>
              );
            })}
          </div>

          {/* Quick Info details */}
          <div className="mt-4 pt-4 border-t-2 border-stone-100 space-y-2 text-xs font-mono">
            <div className="flex items-center justify-between text-stone-500">
              <span>Goal Consistency Status:</span>
              <span className={`font-bold uppercase ${studyStreak > 0 ? 'text-amber-800' : 'text-stone-400'}`}>
                {studyStreak > 0 ? '🔥 Active Streak' : '😴 Rest State'}
              </span>
            </div>
            <div className="flex items-center justify-between text-stone-500">
              <span>Total Hours Synced:</span>
              <span className="font-bold text-stone-900">{weeklyStudyHours} hrs</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
