import React, { useState, useEffect, useRef } from 'react';
import { HardcodedUser } from '../config';
import { db, collection, addDoc } from '../lib/firebase';
import { Play, Pause, RotateCcw, Flame, Check, Coffee } from 'lucide-react';
import { CustomStudyGoal } from '../types';
import { useToast } from './Toast';

interface PomodoroTimerProps {
  currentUser: HardcodedUser;
  partner: HardcodedUser;
  goals: CustomStudyGoal[];
  onIncrementGoal: (goalId: string, hours: number) => void;
}

export default function PomodoroTimer({ currentUser, partner, goals, onIncrementGoal }: PomodoroTimerProps) {
  const { toast } = useToast();
  const [mode, setMode] = useState<'focus' | 'break'>('focus');
  const [timeLeft, setTimeLeft] = useState(mode === 'focus' ? 25 * 60 : 5 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState<string>('');
  const [sessionCompleted, setSessionCompleted] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Switch modes
  const handleModeChange = (newMode: 'focus' | 'break') => {
    setIsRunning(false);
    setMode(newMode);
    setTimeLeft(newMode === 'focus' ? 25 * 60 : 5 * 60);
    setSessionCompleted(false);
    toast(`Switched to ${newMode === 'focus' ? 'Focus Mode (25m)' : 'Break Mode (5m)'}.`, 'info');
  };

  // Timer Effect
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            setIsRunning(false);
            handleTimerComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, mode]);

  // Handle timer completion
  const handleTimerComplete = async () => {
    setSessionCompleted(true);
    
    // Play a gentle notification sound
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5 note
      osc.frequency.setValueAtTime(880.00, audioCtx.currentTime + 0.15); // A5 note
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.4);
    } catch (e) {
      // Ignored if browser blocks audio
    }

    if (mode === 'focus') {
      const durationHours = 0.4; // 25 minutes = ~0.4 hours
      
      // Auto-increment selected goal if applicable
      if (selectedGoalId) {
        onIncrementGoal(selectedGoalId, durationHours);
      }

      // Add a real-time ledger notification
      const activeGoalText = selectedGoalId 
        ? ` toward the goal "${goals.find(g => g.id === selectedGoalId)?.title || ''}"` 
        : '';
        
      await addDoc(collection(db, 'notifications'), {
        text: `🎉 Pomodoro Done! ${currentUser.name} completed a 25-minute focus session${activeGoalText}! ${currentUser.avatar}`,
        timestamp: new Date().toISOString(),
        unread: true,
        type: 'success',
      });

      // Automatically log a study block in events database for history tracking!
      try {
        const startISO = new Date(Date.now() - 25 * 60 * 1000).toISOString();
        const endISO = new Date().toISOString();
        
        await addDoc(collection(db, 'events'), {
          userId: currentUser.id,
          title: `🔴 Pomodoro Session: ${selectedGoalId ? (goals.find(g => g.id === selectedGoalId)?.title || 'Focused Block') : 'Focused Focus'}`,
          type: 'studying',
          start: startISO,
          end: endISO,
          recurrence: 'none',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          notes: 'Completed Pomodoro Study sync focus block.',
          createdAt: new Date().toISOString(),
        });
      } catch (err) {
        console.error('Error logging Pomodoro session:', err);
      }
      toast('🎉 Outstanding! You completed a 25-minute focus session!', 'success');
    } else {
      await addDoc(collection(db, 'notifications'), {
        text: `☕ Break finished! ${currentUser.name} is ready to dive back into focus blocks.`,
        timestamp: new Date().toISOString(),
        unread: true,
        type: 'info',
      });
      toast('☕ Break completed! Ready to dive back in?', 'success');
    }
  };

  const handleReset = () => {
    setIsRunning(false);
    setTimeLeft(mode === 'focus' ? 25 * 60 : 5 * 60);
    setSessionCompleted(false);
    toast('Timer reset successfully.', 'info');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // SVG parameters for the pocket-watch ring indicator
  const totalDuration = mode === 'focus' ? 25 * 60 : 5 * 60;
  const percentage = (timeLeft / totalDuration) * 100;
  const strokeDashoffset = 251.2 - (251.2 * percentage) / 100;

  return (
    <div className="p-5 rounded-xl border-2 border-[#D9D1C0] bg-white shadow-[4px_4px_0px_0px_rgba(217,209,192,0.3)] flex flex-col items-center justify-between gap-4">
      <div className="w-full flex items-center justify-between border-b border-stone-100 pb-2.5">
        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest font-mono">
          ⏱️ Pocket Pomodoro
        </span>
        <div className="flex bg-stone-100 p-0.5 rounded-lg border border-stone-200">
          <button
            onClick={() => handleModeChange('focus')}
            className={`px-2.5 py-1 text-[9px] font-bold uppercase rounded transition cursor-pointer ${
              mode === 'focus' ? 'bg-stone-900 text-white' : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            Focus
          </button>
          <button
            onClick={() => handleModeChange('break')}
            className={`px-2.5 py-1 text-[9px] font-bold uppercase rounded transition cursor-pointer ${
              mode === 'break' ? 'bg-stone-900 text-white' : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            Break
          </button>
        </div>
      </div>

      {/* Main Pocket-Watch Interface */}
      <div className="relative flex items-center justify-center my-1.5">
        {/* SVG Circular Progress Ring */}
        <svg className="w-28 h-28 transform -rotate-90">
          <circle
            cx="56"
            cy="56"
            r="40"
            className="stroke-stone-100 fill-none"
            strokeWidth="6"
          />
          <circle
            cx="56"
            cy="56"
            r="40"
            className={`fill-none transition-all duration-1000 ${
              mode === 'focus' ? 'stroke-indigo-600' : 'stroke-emerald-600'
            }`}
            strokeWidth="6"
            strokeDasharray="251.2"
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>

        {/* Central Display */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black font-mono text-stone-900 tracking-tight">
            {formatTime(timeLeft)}
          </span>
          <span className="text-[8px] uppercase tracking-widest font-mono font-bold text-stone-400">
            {isRunning ? 'Ticking' : 'Idle'}
          </span>
        </div>
      </div>

      {/* Goal Attribution Dropdown */}
      {mode === 'focus' && goals.length > 0 && !sessionCompleted && (
        <div className="w-full space-y-1">
          <label className="block text-[9px] font-bold text-stone-400 uppercase tracking-wider font-mono">
            Link to Study Goal
          </label>
          <select
            value={selectedGoalId}
            onChange={(e) => setSelectedGoalId(e.target.value)}
            className="w-full text-[10px] bg-stone-50 border border-stone-200 rounded-lg p-1.5 focus:outline-none focus:border-stone-500 text-stone-700"
          >
            <option value="">-- No goal linked --</option>
            {goals.filter(g => !g.completed).map((g) => (
              <option key={g.id} value={g.id}>
                🎯 {g.title} ({Math.round(g.currentHours * 10) / 10}/{g.targetHours}h)
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Completion Banner */}
      {sessionCompleted && (
        <div className="w-full text-center p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-950 flex flex-col items-center justify-center gap-0.5 animate-bounce">
          <span className="text-xs font-black flex items-center gap-1">
            <Check className="h-3.5 w-3.5 text-emerald-600" />
            Session Done!
          </span>
          <p className="text-[9px] text-emerald-700 leading-tight">
            {mode === 'focus' ? 'Logged 0.4h of focus time.' : 'Ready to focus again.'}
          </p>
        </div>
      )}

      {/* Timer Controls */}
      <div className="flex items-center gap-2 w-full">
        <button
          onClick={() => {
            const nextIsRunning = !isRunning;
            setIsRunning(nextIsRunning);
            if (nextIsRunning) {
              toast(mode === 'focus' ? 'Focus timer started! Keep working!' : 'Break timer started! Rest well.', 'success');
            } else {
              toast('Timer paused.', 'info');
            }
          }}
          className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer border-2 ${
            isRunning
              ? 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
              : 'bg-stone-900 border-stone-900 text-white hover:bg-stone-800'
          }`}
        >
          {isRunning ? (
            <>
              <Pause className="h-3.5 w-3.5" />
              <span>Pause</span>
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>Start</span>
            </>
          )}
        </button>

        <button
          onClick={handleReset}
          className="p-2 border-2 border-stone-200 bg-white hover:bg-stone-50 text-stone-600 hover:text-stone-900 rounded-xl transition cursor-pointer"
          title="Reset Clock"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
