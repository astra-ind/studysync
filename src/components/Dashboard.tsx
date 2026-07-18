import React, { useState, useMemo } from 'react';
import { CalendarEvent, MatchSlot } from '../types';
import { USERS, HardcodedUser, DAILY_STUDY_GOAL_HOURS } from '../config';
import { expandEvents, findMatches, getLocalDateString, formatDuration } from '../utils/calendarUtils';
import { downloadICS } from '../utils/icsUtils';
import { BookOpen, Calendar, Award, Sparkles, Plus, Clock, TrendingUp, CheckCircle, Flame, Download } from 'lucide-react';

interface DashboardProps {
  currentUser: HardcodedUser;
  partner: HardcodedUser;
  events: CalendarEvent[];
  onAddSlotClick: () => void;
}

export default function Dashboard({ currentUser, partner, events, onAddSlotClick }: DashboardProps) {
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

  // Total events (for match finding)
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
    // We scan all events, not just this week, to compute an accurate streak
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

  return (
    <div className="space-y-6">
      {/* Intro Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-md relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute -left-12 -bottom-12 h-40 w-40 rounded-full bg-purple-500/10 blur-3xl" />

        <div className="space-y-1 relative z-10">
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            Welcome back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">{currentUser.name}</span>! {currentUser.avatar}
          </h2>
          <p className="text-sm text-slate-400">
            You are synced in real-time with <span className="font-semibold text-slate-200">{partner.name}</span>. Start booking overlapping slots.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5 relative z-10">
          <button
            onClick={onAddSlotClick}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-500/20 hover:from-indigo-600 hover:to-purple-700 transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Add Availability Slot</span>
          </button>
          <button
            onClick={handleExportICS}
            className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-900 hover:text-white transition cursor-pointer"
          >
            <Download className="h-4 w-4" />
            <span>Export ICS</span>
          </button>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Weekly Study Hours */}
        <div className="p-5 rounded-2xl border border-slate-800/80 bg-slate-900/20 backdrop-blur-sm flex items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block">Weekly Study Hours</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-white">{weeklyStudyHours}h</span>
              <span className="text-[10px] text-indigo-400 font-semibold">Goal: 15h</span>
            </div>
            <p className="text-[10px] text-slate-500">
              {partner.name} has logged <span className="text-slate-300 font-semibold">{partnerWeeklyStudyHours}h</span>
            </p>
          </div>
          <div className="h-12 w-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
            <BookOpen className="h-6 w-6" />
          </div>
        </div>

        {/* Longest Streak */}
        <div className="p-5 rounded-2xl border border-slate-800/80 bg-slate-900/20 backdrop-blur-sm flex items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block">Longest Streak</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-white">{studyStreak}</span>
              <span className="text-xs text-orange-400 font-bold">days</span>
            </div>
            <p className="text-[10px] text-slate-500">
              Keep checking in daily to expand!
            </p>
          </div>
          <div className="h-12 w-12 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-400">
            <Flame className="h-6 w-6 animate-pulse" />
          </div>
        </div>

        {/* Daily Study Goal Gauge */}
        <div className="p-5 rounded-2xl border border-slate-800/80 bg-slate-900/20 backdrop-blur-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Daily Study Goal</span>
            <span className="text-xs font-bold text-emerald-400">{goalPercentage}%</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-white">{todayStudyHours}</span>
            <span className="text-xs text-slate-400">/ {DAILY_STUDY_GOAL_HOURS} hrs</span>
          </div>
          <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-emerald-400 to-teal-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${goalPercentage}%` }}
            />
          </div>
        </div>

        {/* Next Shared Free/Study Slot */}
        <div className="p-5 rounded-2xl border border-slate-800/80 bg-slate-900/20 backdrop-blur-sm flex items-center justify-between gap-4">
          <div className="space-y-1.5 flex-1 min-w-0">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block">Next Shared Slot</span>
            {nextSharedSlot ? (
              <>
                <p className="text-sm font-bold text-indigo-300 truncate">
                  {nextSharedSlot.label.split('(')[0].trim()}
                </p>
                <p className="text-[10px] text-slate-300 font-medium">
                  {new Date(nextSharedSlot.start).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                </p>
                <p className="text-[10px] text-slate-500 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(nextSharedSlot.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(nextSharedSlot.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-bold text-slate-500">None Scheduled</p>
                <p className="text-[10px] text-slate-600">No overlap detected yet</p>
              </>
            )}
          </div>
          <div className="h-12 w-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 shrink-0">
            <Sparkles className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Two-Column Mid-Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Today's Schedule timeline */}
        <div className="lg:col-span-2 p-5 rounded-2xl border border-slate-800 bg-slate-950/40 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
              <Calendar className="h-4 w-4 text-indigo-400" />
              Your Schedule Today
            </h3>
            <span className="text-xs font-medium text-slate-400">
              {new Date().toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
            </span>
          </div>

          <div className="space-y-3">
            {todaySchedule.length === 0 ? (
              <div className="py-12 text-center rounded-xl border border-dashed border-slate-900 bg-slate-950/20">
                <p className="text-sm text-slate-500">Your schedule is empty today</p>
                <button
                  onClick={onAddSlotClick}
                  className="mt-3 text-xs font-bold text-indigo-400 hover:text-indigo-300 transition cursor-pointer"
                >
                  Create a study slot +
                </button>
              </div>
            ) : (
              todaySchedule.map((item) => {
                const sTime = new Date(item.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const eTime = new Date(item.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                
                let typeColor = 'border-emerald-500/40 bg-emerald-500/5 text-emerald-400';
                if (item.type === 'studying') typeColor = 'border-sky-500/40 bg-sky-500/5 text-sky-400';
                if (item.type === 'busy') typeColor = 'border-rose-500/40 bg-rose-500/5 text-rose-400';
                if (item.type === 'maybe') typeColor = 'border-amber-500/40 bg-amber-500/5 text-amber-400';

                return (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-xl border flex items-center justify-between gap-4 transition ${typeColor}`}
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-slate-100">{item.title}</p>
                      {item.notes && <p className="text-xs text-slate-400 italic line-clamp-1">{item.notes}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-bold block text-slate-300">{sTime} - {eTime}</span>
                      <span className="text-[10px] uppercase font-bold tracking-wider opacity-80">{item.type}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Weekly Heatmap and Statistics */}
        <div className="p-5 rounded-2xl border border-slate-800 bg-slate-950/40 space-y-4">
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-purple-400" />
            Study Heatmap (Past 7 Days)
          </h3>

          <div className="grid grid-cols-7 gap-2 pt-2">
            {studyHeatmap.map((day) => {
              // Decide intensity class
              let colorClass = 'bg-slate-900 border-slate-800 text-slate-600';
              if (day.hours > 0 && day.hours <= 2) colorClass = 'bg-indigo-950 border-indigo-900 text-indigo-400';
              if (day.hours > 2 && day.hours <= 4) colorClass = 'bg-indigo-900 border-indigo-700 text-indigo-300';
              if (day.hours > 4) colorClass = 'bg-gradient-to-br from-indigo-600 to-purple-600 border-indigo-500 text-white';

              return (
                <div key={day.dateStr} className="flex flex-col items-center gap-1" title={`${day.label}: ${day.hours} study hours`}>
                  <div className={`h-10 w-full rounded-lg border flex items-center justify-center text-xs font-black transition-all ${colorClass}`}>
                    {day.hours > 0 ? `${Math.round(day.hours)}` : '•'}
                  </div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase">{day.dayName}</span>
                </div>
              );
            })}
          </div>

          {/* Quick Info */}
          <div className="mt-4 pt-4 border-t border-slate-900 space-y-2 text-xs">
            <div className="flex items-center justify-between text-slate-400">
              <span>Goal consistency streak:</span>
              <span className="font-semibold text-white">{studyStreak > 0 ? '🔥 Active' : '😴 Dormant'}</span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>Total hours studied:</span>
              <span className="font-semibold text-white">{weeklyStudyHours} hrs</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
