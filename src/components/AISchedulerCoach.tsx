import React, { useState } from 'react';
import { HardcodedUser } from '../config';
import { db, collection, addDoc } from '../lib/firebase';
import { Sparkles, Calendar, Send, CheckCircle2, RotateCw, Check, Loader2, Info } from 'lucide-react';

interface AISchedulerCoachProps {
  currentUser: HardcodedUser;
  partner: HardcodedUser;
}

interface AIEvent {
  title: string;
  type: 'free' | 'studying' | 'busy' | 'maybe';
  start: string;
  end: string;
  topic?: string;
  notes?: string;
}

interface AIResponse {
  schedule: AIEvent[];
  advice: string;
}

export default function AISchedulerCoach({ currentUser, partner }: AISchedulerCoachProps) {
  const [goalInput, setGoalInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [aiResult, setAiResult] = useState<AIResponse | null>(null);
  const [isProgrammed, setIsProgrammed] = useState(false);

  // Submit request to Express API route
  const handleGeneratePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalInput.trim()) return;

    setIsLoading(true);
    setAiResult(null);
    setIsProgrammed(false);

    try {
      const response = await fetch('/api/scheduler/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: goalInput.trim(),
          currentLocalDate: new Date().toISOString().slice(0, 10),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          userName: currentUser.name,
        }),
      });

      if (!response.ok) {
        throw new Error('API server returned error');
      }

      const data: AIResponse = await response.json();
      setAiResult(data);
    } catch (err) {
      console.error('Error generating study schedule:', err);
      // Fallback advice so it never crashes
      setAiResult({
        schedule: [
          {
            title: `Joint Study Session: ${currentUser.name} + ${partner.name}`,
            type: 'studying',
            start: new Date().toISOString(),
            end: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
            topic: 'Core Review',
            notes: 'AI fall-back block. Programmed to sync schedules instantly.',
          }
        ],
        advice: '⚠️ The AI Sync engine is currently offline or running in transient mode, but we\'ve loaded a safe fallback study plan for you. Let\'s make this session count!',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Program schedule directly into Firestore
  const handleProgramToDatabase = async () => {
    if (!aiResult || aiResult.schedule.length === 0) return;

    try {
      for (const ev of aiResult.schedule) {
        await addDoc(collection(db, 'events'), {
          userId: currentUser.id,
          title: ev.title,
          type: ev.type,
          start: ev.start,
          end: ev.end,
          recurrence: 'none' as const,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          topic: ev.topic || '',
          notes: ev.notes || '',
          createdAt: new Date().toISOString(),
        });
      }

      // Add standard notifications so partner sees the study lock
      await addDoc(collection(db, 'notifications'), {
        text: `🤖 AI Study Sync: ${currentUser.name} asked the AI Planner Coach to customize their schedule based on goal: "${goalInput.substring(0, 45)}...". Programmed ${aiResult.schedule.length} slots!`,
        timestamp: new Date().toISOString(),
        unread: true,
        type: 'success',
      });

      setIsProgrammed(true);
      setGoalInput('');
    } catch (err) {
      console.error('Error programming events:', err);
    }
  };

  return (
    <div className="p-5 rounded-xl border-2 border-[#D9D1C0] bg-white shadow-[4px_4px_0px_0px_rgba(217,209,192,0.3)] space-y-4">
      {/* Intro Header */}
      <div className="space-y-1">
        <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wider flex items-center gap-2 font-mono">
          <Sparkles className="h-4.5 w-4.5 text-amber-600 animate-pulse" />
          AI Study Planner Coach
        </h3>
        <p className="text-xs text-stone-500 font-sans leading-relaxed">
          Ask the AI coach to outline a daily, weekly, or monthly calendar schedule suited to your personal study goals and constraints. It programs them directly into the synced ledger.
        </p>
      </div>

      {/* Input Prompt Form */}
      <form onSubmit={handleGeneratePlan} className="space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            required
            disabled={isLoading}
            placeholder="e.g., I have a Physics Exam next Thursday. Schedule 3 hours of studying every evening, plus free slots on Saturday"
            value={goalInput}
            onChange={(e) => setGoalInput(e.target.value)}
            className="flex-1 rounded-xl border-2 border-stone-200 bg-stone-50 px-4 py-2.5 text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-stone-800 focus:bg-white transition"
          />
          <button
            type="submit"
            disabled={isLoading || !goalInput.trim()}
            className="px-4.5 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-amber-300" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            <span>{isLoading ? 'Thinking' : 'Plan'}</span>
          </button>
        </div>
      </form>

      {/* Reassuring Loader Messages */}
      {isLoading && (
        <div className="p-4 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/20 text-center space-y-1.5 animate-pulse">
          <p className="text-xs font-serif italic text-stone-700">"Consulting textbook syllabus and cross-checking partner diaries..."</p>
          <p className="text-[10px] text-stone-400 font-sans">Gemini is curating blocks that optimize collaboration without causing burnout.</p>
        </div>
      )}

      {/* AI Success Presentation Card */}
      {aiResult && (
        <div className="p-4 rounded-xl border-2 border-stone-200 bg-[#FCFBF8] space-y-4 animate-in fade-in slide-in-from-top-3 duration-300">
          {/* Coach Advice Bubble */}
          <div className="p-3.5 rounded-lg border-2 border-[#D9D1C0] bg-white text-xs font-serif text-stone-800 leading-relaxed italic relative">
            <span className="text-xs font-black uppercase tracking-widest font-mono text-[#A58D56] block not-italic mb-1">
              🎓 Coach's Study Strategy Advice:
            </span>
            {aiResult.advice}
          </div>

          {/* Schedule Preview Checklist */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block font-mono">
              Proposed Calendar Slots:
            </span>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
              {aiResult.schedule.map((slot, idx) => {
                let badge = 'bg-stone-100 text-stone-700 border-stone-200';
                if (slot.type === 'studying') badge = 'bg-sky-50 text-sky-800 border-sky-200';
                if (slot.type === 'free') badge = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                if (slot.type === 'maybe') badge = 'bg-amber-50 text-amber-800 border-amber-200';

                return (
                  <div key={idx} className="p-2.5 rounded-lg border border-stone-200 bg-white flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <p className="font-bold text-stone-900 truncate">{slot.title}</p>
                      {slot.topic && <p className="text-[10px] text-[#A58D56] font-mono">📚 {slot.topic}</p>}
                      <p className="text-[10px] text-stone-500 font-mono mt-0.5">
                        {new Date(slot.start).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} at{' '}
                        {new Date(slot.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                        {new Date(slot.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded border shrink-0 ${badge}`}>
                      {slot.type}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Commit Actions */}
          <div className="flex gap-2">
            {isProgrammed ? (
              <div className="w-full text-center p-3 rounded-xl border bg-emerald-50 border-emerald-200 text-emerald-950 text-xs font-bold flex items-center justify-center gap-1.5">
                <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600" />
                <span>Programmed in Study Sync Ledger Diary!</span>
              </div>
            ) : (
              <button
                onClick={handleProgramToDatabase}
                className="w-full flex items-center justify-center gap-1.5 bg-stone-900 hover:bg-stone-800 text-white font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-widest transition shadow-md cursor-pointer border-2 border-stone-900"
              >
                <Calendar className="h-4 w-4 text-amber-200" />
                <span>Program Schedule into Ledger</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
