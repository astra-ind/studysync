import { CalendarEvent, MatchSlot, SlotType } from '../types';

// Helper to expand recurring events for a specific date range
export function expandEvents(
  events: CalendarEvent[],
  rangeStart: Date,
  rangeEnd: Date
): CalendarEvent[] {
  const expanded: CalendarEvent[] = [];
  const startMs = rangeStart.getTime();
  const endMs = rangeEnd.getTime();

  events.forEach((event) => {
    const origStart = new Date(event.start);
    const origEnd = new Date(event.end);
    const duration = origEnd.getTime() - origStart.getTime();

    if (event.recurrence === 'none') {
      if (origEnd.getTime() >= startMs && origStart.getTime() <= endMs) {
        expanded.push(event);
      }
      return;
    }

    // Handle recurring events
    let currentStart = new Date(origStart);

    // To handle daily/weekly/monthly recurrences
    // Loop and generate instances
    while (currentStart.getTime() <= endMs) {
      const instanceStart = new Date(currentStart);
      const instanceEnd = new Date(currentStart.getTime() + duration);

      if (instanceEnd.getTime() >= startMs && instanceStart.getTime() <= endMs) {
        expanded.push({
          ...event,
          id: `${event.id}_rec_${instanceStart.toISOString().slice(0, 10)}`,
          start: instanceStart.toISOString(),
          end: instanceEnd.toISOString(),
        });
      }

      if (event.recurrence === 'daily') {
        currentStart.setDate(currentStart.getDate() + 1);
      } else if (event.recurrence === 'weekly') {
        currentStart.setDate(currentStart.getDate() + 7);
      } else if (event.recurrence === 'monthly') {
        currentStart.setMonth(currentStart.getMonth() + 1);
      } else {
        break; // Guard
      }

      // Safeguard to prevent infinite loops if something goes wrong
      if (currentStart.getTime() === instanceStart.getTime()) {
        break;
      }
    }
  });

  return expanded;
}

// Convert Date to YYYY-MM-DD
export function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Parse timezone-adjusted dates
export function getAdjustedDate(dateStr: string, timeStr: string, timezone: string): Date {
  // Use current system timezone or specified timezone to create a correct Date object
  const date = new Date(`${dateStr}T${timeStr}`);
  return date;
}

// 30-minute interval matching for a specific date
export interface TimeInterval {
  timeStr: string; // "09:00"
  minutes: number; // 540
  statusA: SlotType | 'none';
  statusB: SlotType | 'none';
  mergedStatus: 'green' | 'blue' | 'orange' | 'red' | 'grey' | 'none';
}

export function calculateSharedGrid(
  eventsA: CalendarEvent[],
  eventsB: CalendarEvent[],
  dateStr: string
): TimeInterval[] {
  const grid: TimeInterval[] = [];

  // Parse day start/end in local timezone
  const startOfDay = new Date(`${dateStr}T00:00:00`);
  
  // Expand events for this day
  const endOfDay = new Date(`${dateStr}T23:59:59`);
  const activeA = expandEvents(eventsA, startOfDay, endOfDay);
  const activeB = expandEvents(eventsB, startOfDay, endOfDay);

  // Generate 48 half-hour slots
  for (let i = 0; i < 48; i++) {
    const totalMinutes = i * 30;
    const hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    const hourStr = String(hour).padStart(2, '0');
    const minStr = String(minute).padStart(2, '0');
    const timeStr = `${hourStr}:${minStr}`;

    const slotStart = new Date(`${dateStr}T${timeStr}:00`);
    const slotEnd = new Date(slotStart.getTime() + 30 * 60 * 1000);

    // Helper to see if any event overlaps this 30-min slot
    const getStatus = (activeEvents: CalendarEvent[]): SlotType | 'none' => {
      let currentStatus: SlotType | 'none' = 'none';
      for (const event of activeEvents) {
        const estart = new Date(event.start);
        const eend = new Date(event.end);
        
        // Overlap condition
        if (estart < slotEnd && eend > slotStart) {
          // Priority ordering if multiple events overlap (busy > studying > free > maybe)
          if (event.type === 'busy') return 'busy';
          if (event.type === 'studying') currentStatus = 'studying';
          if (event.type === 'free' && currentStatus !== 'studying') currentStatus = 'free';
          if (event.type === 'maybe' && currentStatus === 'none') currentStatus = 'maybe';
        }
      }
      return currentStatus;
    };

    const statusA = getStatus(activeA);
    const statusB = getStatus(activeB);

    let mergedStatus: 'green' | 'blue' | 'orange' | 'red' | 'grey' | 'none' = 'none';

    if (statusA !== 'none' || statusB !== 'none') {
      if (statusA === 'busy' || statusB === 'busy') {
        mergedStatus = 'red'; // Someone busy
      } else if (statusA === 'studying' && statusB === 'studying') {
        mergedStatus = 'blue'; // Both studying
      } else if (statusA === 'free' && statusB === 'free') {
        mergedStatus = 'green'; // Both free
      } else if (
        (statusA === 'free' && statusB === 'studying') ||
        (statusA === 'studying' && statusB === 'free')
      ) {
        mergedStatus = 'orange'; // One free, one studying
      } else if (statusA === 'none' || statusB === 'none') {
        // Just one has schedule, other is none - let's treat as muted display or conflict?
        // Wait, legend says: Grey Conflict. If one is studying and one is maybe, or they don't match, or if only one has slot.
        // Let's call it 'none' or 'grey' depending on active statuses.
        // If there's a status, let's show it or make it grey. Let's make differing active states grey.
        // If one is none, let's keep it clean or make it a conflict if one is busy/maybe/etc.
        // Let's do grey for mismatched non-overlapping or partial.
        mergedStatus = 'grey';
      } else {
        mergedStatus = 'grey'; // Conflict
      }
    }

    grid.push({
      timeStr,
      minutes: totalMinutes,
      statusA,
      statusB,
      mergedStatus,
    });
  }

  return grid;
}

// Find matches for next N days
export function findMatches(
  eventsA: CalendarEvent[],
  eventsB: CalendarEvent[],
  numDays: number = 7
): MatchSlot[] {
  const matches: MatchSlot[] = [];
  const today = new Date();

  for (let d = 0; d < numDays; d++) {
    const checkDate = new Date();
    checkDate.setDate(today.getDate() + d);
    const dateStr = getLocalDateString(checkDate);

    const grid = calculateSharedGrid(eventsA, eventsB, dateStr);

    // Group adjacent intervals with the same combined high-value match (green, blue, orange)
    let currentMatchStart: TimeInterval | null = null;
    let currentType: 'green' | 'blue' | 'orange' | null = null;

    const flushMatch = (endInterval: TimeInterval) => {
      if (currentMatchStart && currentType) {
        const startHourMin = currentMatchStart.timeStr;
        // end time is endInterval's end time (start + 30 min)
        const startParts = startHourMin.split(':').map(Number);
        const startDate = new Date(`${dateStr}T${startHourMin}:00`);
        
        const endParts = endInterval.timeStr.split(':').map(Number);
        const endDate = new Date(`${dateStr}T${endInterval.timeStr}:00`);
        endDate.setMinutes(endDate.getMinutes() + 30); // add 30 min for the end of the slot

        let type: 'free' | 'studying' | 'mixed' = 'free';
        let label = 'Both Free';
        if (currentType === 'blue') {
          type = 'studying';
          label = 'Study Together';
        } else if (currentType === 'orange') {
          type = 'mixed';
          label = 'One Free, One Studying';
        }

        matches.push({
          id: `${dateStr}_${startHourMin}_${currentType}`,
          dateStr,
          start: startDate,
          end: endDate,
          type,
          label,
        });
      }
      currentMatchStart = null;
      currentType = null;
    };

    for (let i = 0; i < grid.length; i++) {
      const interval = grid[i];
      const mStatus = interval.mergedStatus;

      // Only interested in green (both free), blue (both studying), or orange (one free, one studying)
      if (mStatus === 'green' || mStatus === 'blue' || mStatus === 'orange') {
        if (currentType === mStatus) {
          // continue existing match grouping
        } else {
          // flush previous
          if (currentMatchStart) {
            flushMatch(grid[i - 1]);
          }
          currentMatchStart = interval;
          currentType = mStatus;
        }
      } else {
        // non-matching status, flush any active match
        if (currentMatchStart) {
          flushMatch(grid[i - 1]);
        }
      }
    }

    // Flush last interval at end of day
    if (currentMatchStart) {
      flushMatch(grid[grid.length - 1]);
    }
  }

  // Highlight longest shared slot in label
  if (matches.length > 0) {
    let longestIdx = 0;
    let maxDur = 0;
    matches.forEach((m, idx) => {
      const dur = m.end.getTime() - m.start.getTime();
      if (dur > maxDur) {
        maxDur = dur;
        longestIdx = idx;
      }
    });
    matches[longestIdx].label = `${matches[longestIdx].label} (Longest Shared Slot)`;
  }

  return matches;
}

// Format duration cleanly
export function formatDuration(start: Date, end: Date): string {
  const diffMs = end.getTime() - start.getTime();
  const diffHrs = Math.floor(diffMs / (3600 * 1000));
  const diffMins = Math.floor((diffMs % (3600 * 1000)) / (60 * 1000));

  let res = '';
  if (diffHrs > 0) res += `${diffHrs}h `;
  if (diffMins > 0) res += `${diffMins}m`;
  return res.trim() || '30m';
}

// Calendar Month View Generation Helper
export interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: CalendarEvent[];
}

export function getMonthDays(date: Date, events: CalendarEvent[]): CalendarDay[] {
  const year = date.getFullYear();
  const month = date.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const startDayOfWeek = firstDayOfMonth.getDay(); // 0 is Sunday, 6 is Saturday

  // Start with previous month's padding days
  const startOfCalendar = new Date(firstDayOfMonth);
  startOfCalendar.setDate(startOfCalendar.getDate() - startDayOfWeek);

  const days: CalendarDay[] = [];
  const todayStr = getLocalDateString(new Date());

  // Generate 42 calendar grid cells (6 rows x 7 columns)
  const tempDate = new Date(startOfCalendar);
  for (let i = 0; i < 42; i++) {
    const dayDate = new Date(tempDate);
    const dayStr = getLocalDateString(dayDate);

    // Expand events for this specific day
    const dayStart = new Date(`${dayStr}T00:00:00`);
    const dayEnd = new Date(`${dayStr}T23:59:59`);
    const dayEvents = expandEvents(events, dayStart, dayEnd);

    days.push({
      date: dayDate,
      isCurrentMonth: dayDate.getMonth() === month,
      isToday: dayStr === todayStr,
      events: dayEvents,
    });

    tempDate.setDate(tempDate.getDate() + 1);
  }

  return days;
}
