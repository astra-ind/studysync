import React, { useState, useEffect } from 'react';
import { CalendarEvent, SlotType } from '../types';
import { SLOT_TYPES } from '../config';
import { X, Trash2, Copy, Calendar, Clock, RotateCw, AlignLeft, CheckSquare, Plus, BookOpen, Check, ListChecks } from 'lucide-react';

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
  
  // Custom tracking expansions
  const [topic, setTopic] = useState('');
  const [checklist, setChecklist] = useState<{ id: string; text: string; done: boolean }[]>([]);
  const [newTaskText, setNewTaskText] = useState('');

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
      setTopic(event.topic || '');
      setChecklist(event.checklist || []);
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
      setTopic('');
      setChecklist([]);
    }
    setNewTaskText('');
  }, [event, defaultDate, defaultStartHour, isOpen]);

  if (!isOpen) return null;

  const handleAddTask = () => {
    if (!newTaskText.trim()) return;
    const newItem = {
      id: Math.random().toString(36).substr(2, 9),
      text: newTaskText.trim(),
      done: false,
    };
    setChecklist([...checklist, newItem]);
    setNewTaskText('');
  };

  const handleRemoveTask = (taskId: string) => {
    setChecklist(checklist.filter((t) => t.id !== taskId));
  };

  const handleToggleTaskState = (taskId: string) => {
    setChecklist(
      checklist.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t))
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const [year, month, day] = date.split('-').map(Number);
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);

    const startISO = new Date(year, month - 1, day, startH, startM, 0).toISOString();
    const endISO = new Date(year, month - 1, day, endH, endM, 0).toISOString();

    onSave({
      userId,
      title: title.trim(),
      type,
      start: startISO,
      end: endISO,
      recurrence,
      timezone,
      notes: notes.trim(),
      topic: topic.trim() || undefined,
      checklist: checklist.length > 0 ? checklist : undefined,
    });
    onClose();
  };

  const handleDuplicateClick = () => {
    if (event && onDuplicate) {
      onDuplicate({
        ...event,
        topic: topic.trim() || undefined,
        checklist: checklist.length > 0 ? checklist : undefined,
      });
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-stone-900/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Box */}
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border-2 border-[#D9D1C0] bg-white p-6 text-stone-800 shadow-2xl transition-all">
        {/* Ring Binder Decor on Left Edge */}
        <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-stone-100 border-r border-stone-200" />
        
        <div className="flex items-center justify-between border-b-2 border-stone-100 pb-4 pl-2">
          <h3 className="text-lg font-serif font-black text-stone-900 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-stone-500" />
            {event ? 'Modify Calendar Block' : 'Schedule Study Block'}
          </h3>
          <button 
            onClick={onClose}
            className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-50 hover:text-stone-800 transition cursor-pointer"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 pl-2 max-h-[80vh] overflow-y-auto pr-1 custom-scrollbar">
          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5 font-mono">
              Event Title / Activity Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Physics Homework, Pre-calculus, General Avail"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm text-stone-900 placeholder-stone-400 focus:border-stone-800 focus:outline-none transition"
            />
          </div>

          {/* Type Selector */}
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2 font-mono">
              Availability State
            </label>
            <div className="grid grid-cols-2 gap-2">
              {SLOT_TYPES.map((st) => (
                <button
                  key={st.value}
                  type="button"
                  onClick={() => setType(st.value as SlotType)}
                  className={`flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-2 text-xs font-bold transition cursor-pointer ${
                    type === st.value
                      ? 'bg-stone-900 text-white border-stone-900 shadow-sm'
                      : 'bg-stone-50 text-stone-500 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  <span>{st.indicator}</span>
                  <span>{st.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Optional Topic - Advanced tracking */}
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5 font-mono flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5" /> Topic of Focus (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Electromagnetism, Chapter 3 proofs, Vocab List A"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2 text-xs text-stone-900 placeholder-stone-400 focus:border-stone-800 focus:outline-none transition"
            />
          </div>

          {/* Date & Times */}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-1">
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1 font-mono">
                Date
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-900 focus:border-stone-800 focus:outline-none transition"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1 font-mono">
                Start Time
              </label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-900 focus:border-stone-800 focus:outline-none transition"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1 font-mono">
                End Time
              </label>
              <input
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-900 focus:border-stone-800 focus:outline-none transition"
              />
            </div>
          </div>

          {/* Checklist Builder */}
          <div className="border border-stone-200 rounded-xl p-3 bg-stone-50/50 space-y-2">
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1 flex items-center gap-1 font-mono">
              <ListChecks className="h-4 w-4" /> Goal Checklist / Tasks
            </label>
            
            {/* Input row */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Add task goal (e.g. Read 5 pages, Solve problem 1)..."
                value={newTaskText}
                onChange={(e) => setNewTaskText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTask();
                  }
                }}
                className="flex-1 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-stone-800"
              />
              <button
                type="button"
                onClick={handleAddTask}
                className="p-1.5 rounded-lg bg-stone-900 text-stone-50 hover:bg-stone-800 flex items-center justify-center cursor-pointer transition"
              >
                <Plus className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* List */}
            {checklist.length > 0 ? (
              <div className="space-y-1.5 pt-1 max-h-32 overflow-y-auto custom-scrollbar">
                {checklist.map((task) => (
                  <div key={task.id} className="flex items-center justify-between gap-2 p-1.5 bg-white rounded border border-stone-100">
                    <button
                      type="button"
                      onClick={() => handleToggleTaskState(task.id)}
                      className="flex items-center gap-2 text-left text-xs text-stone-700 font-medium cursor-pointer"
                    >
                      <CheckSquare className={`h-4 w-4 shrink-0 ${task.done ? 'text-indigo-600' : 'text-stone-300'}`} />
                      <span className={task.done ? 'line-through text-stone-400' : ''}>{task.text}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveTask(task.id)}
                      className="text-stone-400 hover:text-rose-700 transition cursor-pointer p-0.5"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-stone-400 italic">No checklist targets added to this study block yet.</p>
            )}
          </div>

          {/* Recurrence & Timezone */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1 flex items-center gap-1 font-mono">
                <RotateCw className="h-3 w-3" /> Repeat Schedule
              </label>
              <select
                value={recurrence}
                onChange={(e: any) => setRecurrence(e.target.value)}
                className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-900 focus:outline-none transition"
              >
                <option value="none">No repeat</option>
                <option value="daily">Every day</option>
                <option value="weekly">Every week</option>
                <option value="monthly">Every month</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1 flex items-center gap-1 font-mono">
                <Clock className="h-3 w-3" /> Timezone
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-900 focus:outline-none transition overflow-hidden text-ellipsis"
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
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5 flex items-center gap-1 font-mono">
              <AlignLeft className="h-3 w-3" /> Notes & Descriptions
            </label>
            <textarea
              placeholder="Add optional notes, textbook chapters, resource links..."
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2 text-xs text-stone-900 placeholder-stone-400 focus:outline-none transition resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between border-t border-stone-100 pt-4 mt-6">
            <div className="flex gap-2">
              {event && onDelete && (
                <button
                  type="button"
                  onClick={() => {
                    onDelete(event.id);
                    onClose();
                  }}
                  className="rounded-xl bg-rose-50 text-rose-700 border border-rose-200 p-2.5 hover:bg-rose-100 hover:text-rose-800 transition cursor-pointer"
                  title="Delete Event"
                >
                  <Trash2 className="h-4.5 w-4.5" />
                </button>
              )}
              {event && onDuplicate && (
                <button
                  type="button"
                  onClick={handleDuplicateClick}
                  className="rounded-xl bg-stone-100 hover:bg-stone-200 border border-stone-200 p-2.5 text-stone-700 transition flex items-center gap-1 text-xs font-bold cursor-pointer"
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
                className="rounded-xl bg-stone-100 hover:bg-stone-200 border border-stone-200 px-4 py-2.5 text-xs font-bold text-stone-600 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-stone-900 hover:bg-stone-800 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition cursor-pointer"
              >
                Save Schedule
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
