import { CalendarEvent } from '../types';

export function downloadICS(events: CalendarEvent[], userName: string) {
  let icsContent = 'BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//StudySync//Study Partner Scheduler//EN\n';

  events.forEach((event) => {
    const startStr = new Date(event.start).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const endStr = new Date(event.end).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const uid = `${event.id}@studysync.app`;
    
    icsContent += 'BEGIN:VEVENT\n';
    icsContent += `UID:${uid}\n`;
    icsContent += `DTSTAMP:${startStr}\n`;
    icsContent += `DTSTART:${startStr}\n`;
    icsContent += `DTEND:${endStr}\n`;
    icsContent += `SUMMARY:[StudySync] ${event.title} (${event.type.toUpperCase()})\n`;
    if (event.notes) {
      icsContent += `DESCRIPTION:${event.notes.replace(/\n/g, '\\n')}\n`;
    }
    icsContent += `COMMENT:Created by ${userName}\n`;
    icsContent += 'END:VEVENT\n';
  });

  icsContent += 'END:VCALENDAR';

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `study_sync_${userName.toLowerCase()}_schedule.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
