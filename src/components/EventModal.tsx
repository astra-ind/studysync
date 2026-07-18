import React, { useState, useEffect } from 'react';
import { CalendarEvent, SlotType } from '../types';
import { SLOT_TYPES } from '../config';
import { X, Trash2, Copy, Calendar, Clock, RotateCw, AlignLeft } from 'lucide-react';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (eventData: Omit<CalendarEvent, 'id' | 'createdAt'>) => void;
  onDelete?: (eventId: string) => void;
  onDuplicate?: (event: CalendarEvent) => void;
  event?: CalendarEvent | null; // If editing
  defaultDate?: string; // YYYY-MM-DD
  defaultStartHour?: string; // HH:MM
  userId: string;
}

export default function EventModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  onDuplicate,
  event,
  defaultDate,
  defaultStartHour,
  userId,
}: EventModalProps) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<SlotType>('free');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [recurrence, setRecurrence] = useState<'none' | 'daily' | 'weekly' | 'monthly'>('none');
  const [notes, setNotes] = useState('');
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');

  useEffect(() => {
    if (event) {
      setTitle(event.title || '');
      setType(event.type);
      const startD = new Date(event.start);
      const endD = new Date(event.end);
      
      const year = startD.getFullYear();
      const month = String(startD.getMonth() + 1).padStart(2, '0');
      const day = String(startD.getDate()).padStart(2, '0');
      setDate(`${year}-${month}-${day}`);
      
      setStartTime(`${String(startD.getHours()).padStart(2, '0')}:${String(startD.getMinutes()).padStart(2, '0')}`);
      setEndTime(`${String(endD.getHours()).padStart(2, '0')}:${String(endD.getMinutes()).padStart(2, '0')}`);
      setRecurrence(event.recurrence);
      setNotes(event.notes || '');
      setTimezone(event.timezone || 'UTC');
    } else {
      setTitle('');
      setType('free');
      setDate(defaultDate || new Date().toISOString().slice(0, 10));
      setStartTime(defaultStartHour || '09:00');
      
      // Default end time is 1 hour later
      if (defaultStartHour) {
        const [h, m] = defaultStartHour.split(':').map(Number);
        const endH = String((h + 1) % 24).padStart(2, '0');
        setEndTime(`${endH}:${String(m).padStart(2, '0')}`);
      } else {
        setEndTime('10:00');
      }
      setRecurrence('none');
      setNotes('');
      setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
    }
  }, [event, defaultDate, defaultStartHour, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const startISO = new Date(`${date}T${startTime}:00`).toISOString();
    const endISO = new Date(`${date}T${endTime}:00`).toISOString();

    onSave({
      userId,
      title: title.trim(),
      type,
      start: startISO,
      end: endISO,
      recurrence,
      timezone,
      notes: notes.trim(),
    });
    onClose();
  };

  const handleDuplicateClick = () => {
    if (event && onDuplicate) {
      onDuplicate(event);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Box */}
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/90 p-6 text-slate-100 shadow-2xl backdrop-blur-md transition-all">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <h3 className="text-lg font-semibold tracking-tight text-white flex items-center gap-2">
            <Calendar className="h-5 w-5 text-indigo-400" />
            {event ? 'Edit Time Slot' : 'Add Time Slot'}
          </h3>
          <button 
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">
              Slot Title / Activity
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Chemistry Prep, Reading, Available"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
            />
          </div>

          {/* Type Selector */}
          <div>
            <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
              Availability State
            </label>
            <div className="grid grid-cols-2 gap-2">
              {SLOT_TYPES.map((st) => (
                <button
                  key={st.value}
                  type="button"
                  onClick={() => setType(st.value as SlotType)}
                  className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition cursor-pointer ${
                    type === st.value
                      ? 'bg-slate-800 text-white border-indigo-500 shadow-indigo-500/10 shadow-lg'
                      : 'bg-slate-950/40 text-slate-400 border-slate-800/80 hover:bg-slate-800/40'
                  }`}
                >
                  <span>{st.indicator}</span>
                  <span>{st.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Date & Times */}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-1">
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
                Date
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
                Start Time
              </label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
                End Time
              </label>
              <input
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
              />
            </div>
          </div>

          {/* Recurrence & Timezone */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <RotateCw className="h-3 w-3" /> Repeat
              </label>
              <select
                value={recurrence}
                onChange={(e: any) => setRecurrence(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none transition"
              >
                <option value="none">No repeat</option>
                <option value="daily">Every day</option>
                <option value="weekly">Every week</option>
                <option value="monthly">Every month</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Clock className="h-3 w-3" /> Timezone
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none transition overflow-hidden text-ellipsis"
              >
                <option value={Intl.DateTimeFormat().resolvedOptions().timeZone}>Local Time</option>
                <option value="UTC">UTC</option>
                <option value="America/New_York">New York (EST)</option>
                <option value="Europe/London">London (GMT)</option>
                <option value="Asia/Tokyo">Tokyo (JST)</option>
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <AlignLeft className="h-3 w-3" /> Notes
            </label>
            <textarea
              placeholder="Add optional notes or descriptions..."
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none transition resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between border-t border-slate-800 pt-4 mt-6">
            <div className="flex gap-2">
              {event && onDelete && (
                <button
                  type="button"
                  onClick={() => {
                    onDelete(event.id);
                    onClose();
                  }}
                  className="rounded-xl bg-rose-500/10 p-2.5 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 transition"
                  title="Delete Event"
                >
                  <Trash2 className="h-4.5 w-4.5" />
                </button>
              )}
              {event && onDuplicate && (
                <button
                  type="button"
                  onClick={handleDuplicateClick}
                  className="rounded-xl bg-slate-800 p-2.5 text-slate-300 hover:bg-slate-700 hover:text-white transition flex items-center gap-1 text-xs font-medium"
                  title="Duplicate Event"
                >
                  <Copy className="h-4 w-4" />
                  <span>Duplicate</span>
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/20 hover:from-indigo-600 hover:to-purple-700 transition"
              >
                Save Slot
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
